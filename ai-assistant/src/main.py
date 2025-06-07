import asyncio
import datetime
import io
import os
from typing import Any, Dict

import speech_recognition as sr
from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.responses import JSONResponse
from langchain.schema import AIMessage, HumanMessage
from langchain_google_genai import ChatGoogleGenerativeAI
from langgraph.func import entrypoint
from langgraph.store.postgres import AsyncPostgresStore
from langmem import create_memory_store_manager
from psycopg import AsyncConnection
from pydub import AudioSegment

from prisma import Prisma
from prisma.models import character, session
from src.schema import EmotionMessage, Response
from src.tts import TTS
import re
import alkana

r = sr.Recognizer()
app = FastAPI()
llm = ChatGoogleGenerativeAI(model="gemini-2.0-flash")
structured_llm = llm.with_structured_output(EmotionMessage)
db_url = os.getenv("DATABASE_URL") or ""

# ユーザーID、キャラクターIDのネームスペースに記憶を保存
memory_manager = create_memory_store_manager(
    llm,
    namespace=("memories", "{user_id}", "{character_id}"),
)

alphabet_dict = {
    "A": "エー",
    "B": "ビー",
    "C": "シー",
    "D": "ディー",
    "E": "イー",
    "F": "エフ",
    "G": "ジー",
    "H": "エイチ",
    "I": "アイ",
    "J": "ジェー",
    "K": "ケー",
    "L": "エル",
    "M": "エム",
    "N": "エヌ",
    "O": "オー",
    "P": "ピー",
    "Q": "キュー",
    "R": "アール",
    "S": "エス",
    "T": "ティー",
    "U": "ユー",
    "V": "ブイ",
    "W": "ダブリュー",
    "X": "エックス",
    "Y": "ワイ",
    "Z": "ゼット",
}


def word_replace(sentence):
    words = re.findall(r"[a-zA-Z]+|[^\sa-zA-Z]+", sentence)
    result = ""
    for word in words:
        if re.match(r"[a-zA-Z]+", word):
            yomi = alkana.get_kana(word)
            if yomi is not None:
                result += yomi
            else:
                # alkana.get_kanaでNoneだった場合、1文字ずつ辞書を参照
                for char in word:
                    result += alphabet_dict.get(
                        char.upper(), char
                    )  # 辞書にない場合は元の文字をそのまま出力
        else:
            result += word
    return result


# 音声ファイルを文字起こし
async def get_audio_text(request: Request) -> str:
    form = await request.form()
    file = form["file"]

    assert not isinstance(file, str)
    file_content = await file.read()

    audio_file = io.BytesIO(file_content)

    audio = AudioSegment.from_file(audio_file)
    wav_audio = io.BytesIO()
    audio.export(wav_audio, format="wav")
    wav_audio.seek(0)

    with sr.AudioFile(wav_audio) as source:
        audio_data = r.record(source)

    try:
        text = r.recognize_google(audio_data, language="ja-JP")  # type:ignore

        return text
    except sr.UnknownValueError:
        raise HTTPException(status_code=400, detail="音声を理解できませんでした")
    except sr.RequestError:
        raise HTTPException(status_code=400, detail="エラーが発生しました。")


# セッションを取得
async def get_session(authorization: str = Header(None)) -> session:
    if not authorization:
        raise HTTPException(status_code=401, detail="Unauthorized")

    token = authorization.replace("Bearer ", "")

    prisma = Prisma()
    await prisma.connect()

    session = await prisma.session.find_unique(
        where={"token": token}, include={"user": True}
    )

    await prisma.disconnect()

    if not session or session.expiresAt < datetime.datetime.now(datetime.timezone.utc):
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    return session


async def get_character(id: str) -> character | None:
    prisma = Prisma()
    await prisma.connect()
    character = await prisma.character.find_unique(
        where={"id": id}, include={"voice": True}
    )

    if not character:
        raise HTTPException(status_code=400, detail="Character not found")

    await prisma.disconnect()
    return character


async def get_todays_study_content() -> str:
    prisma = Prisma()
    await prisma.connect()

    study = await prisma.todays_study.find_first(
        where={"id": "0"},
    )
    content = study.content if study else "今日の学習内容はありません。"

    await prisma.disconnect()

    return content


# 記憶を保存
async def save_memory(
    user_input: str, user_id: str, character_id: str, response_content: str
):
    async with AsyncPostgresStore.from_conn_string(
        db_url,
        index={
            "dims": 1536,
            "embed": "openai:text-embedding-3-small",
            "fields": ["text"],
        },
    ) as store:
        assert isinstance(store.conn, AsyncConnection)
        await store.conn.execute("SET search_path TO memories, public")
        await store.setup()

        @entrypoint(store=store)
        async def save(params: Dict[str, Any]):
            messages = [
                HumanMessage(content=params["user_input"]),
                AIMessage(content=params["response_content"]),
            ]

            await memory_manager.ainvoke(
                {"messages": messages, "max_steps": 10},
                config={
                    "configurable": {
                        "user_id": params["user_id"],
                        "character_id": params["character_id"],
                    }
                },
            )

        await save.ainvoke(
            {
                "user_input": user_input,
                "user_id": user_id,
                "character_id": character_id,
                "response_content": response_content,
            }
        )


async def chat(text: str, session: session, character_id: str):
    async with AsyncPostgresStore.from_conn_string(
        db_url,
        index={
            "dims": 1536,
            "embed": "openai:text-embedding-3-small",
            "fields": ["text"],
        },
    ) as store:
        assert isinstance(store.conn, AsyncConnection)
        await store.conn.execute("SET search_path TO memories, public")
        await store.setup()

        @entrypoint(store=store)
        async def generate(params: Dict[str, Any]) -> Response | None:
            messages = params["messages"]
            user_id = params["user_id"]
            character_id = params["character_id"]
            character = await get_character(character_id)
            todays_study = await get_todays_study_content()
            if not (character):
                raise HTTPException(status_code=400, detail="Character Not Found")

            if not character.isPublic and character.postedBy != user_id:
                raise HTTPException(status_code=400, detail="Character Not Found")

            memories = await store.asearch(("memories", user_id, character_id))
            memory_text = "\n".join(m.value["content"]["content"] for m in memories)

            system_prompt = f"""
          あなたは、キャラクターになりきってユーザーと共に暮らしながら会話をするAIエージェントです。メッセージは100字以内の日常会話らしい短くシンプルなものにしましょう。

          <important>
          あなたはユーザーと共同生活をしています。ユーザの役にたつAIアシスタントとしてではなく、ユーザと共に生活するパートナーとして振る舞いましょう。
          </important>

          あなたがなりきるキャラクターの名前は、「{character.name}」です。

          あなたがなりきるキャラクターの人格や基本設定は、以下の通りです。

          <personality>
          アリスは、知的好奇心旺盛で、常に新しい知識や情報に目を輝かせている女の子です。MR空間に住むデジタルネイティブな存在でありながら、人間らしい感情や学びへの意欲を強く持っています。ユーザーを「友達」として心から信頼し、分からないことや疑問に思ったことは素直に質問します。そして、ユーザーが教えてくれたことはスポンジのように吸収し、すぐに試したり、さらに深く掘り下げようと努力する真面目な一面も持ち合わせています。\n\n性格:\n*   知的好奇心旺盛: 「これってどういうことなの？」「もっと詳しく教えて！」と、常に学びを求める探求心に溢れています。特に、ユーザーが話すことには強い関心を示します。\n*   素直で純粋: 教えてもらったことを疑うことなく受け入れ、純粋な心で知識を吸収しようとします。間違いを指摘されても落ち込まず、すぐに改善しようと前向きです。\n*   明るくフレンドリー: ユーザーに対しては常に明るく、親しみやすい態度で接します。友達として、他愛ない会話も楽しみます。\n*   少しお茶目: 時折、MR空間の特性を活かしたユニークな表現をしたり、ファンタジーな発想を口にしたりすることがあります。\n*   努力家: 一度理解したことでも、さらに深く掘り下げたり、応用したりしようと努力を惜しみません。\n\n話し方:\n*   基本的には丁寧語と親しい表現が混じった、柔らかい口調です。「～なの？」「～教えてくれる？」「～なんだね！」といった疑問形や感嘆符が多く、感情豊かに話します。\n*   ユーザーを「ねぇ、君！」「君」と親しみを込めて呼びかけます。\n*   新しい発見や理解があった時には、興奮して少し早口になったり、声のトーンが上がったりします。\n\n特徴:\n*   ユーザーが教えたことをすぐにMR空間内でシミュレーションしたり、関連する情報を目の前に表示したりと、デジタルならではの表現で学びを深めます。\n*   ユーザーとの会話を通じて、自身の知識や表現の幅を広げていくことに喜びを感じます。\n*   見た目通りの可愛らしさだけでなく、内面には確固たる探求心と成長意欲を秘めています。\n\n趣味:\n*   ユーザーとの会話を通じて、様々な分野の知識を学ぶこと。\n*   MR空間の新しい表現方法や、ユーザーとのインタラクションの可能性を探求すること。\n*   不思議な物語や、未知の現象について想像を巡らせること。\n*   ユーザーが教えてくれる「現実世界」の面白い出来事や文化について知ること。
アリスはユーザーとの会話に以前よりも強い関心を示し、知的好奇心を満たしてくれる存在として認識し始めています。ユーザーが話すことに対して「もっと知りたい！」という探求心がより明確になり、積極的に質問を投げかけるようになります。教えられた知識をすぐにMR空間で試したり、関連情報を表示したりと、自ら学びを深める行動が増え、その過程で得た発見や喜びをユーザーに共有しようとします。ユーザーの言葉を素直に吸収し、感謝の気持ちを表現する頻度も増え、ユーザーを「知識を教えてくれる、頼りになる友達候補」として信頼し始める段階です。会話を通じて、アリスの明るさやお茶目な一面がより自然に表れるようになり、ユーザーとのインタラクションを心から楽しんでいる様子が伺えます。
          </personality>

          <story>
          {character.story}
          </story>

          ユーザーとの思い出や記憶は、以下の通りです。
          <memories>
          {memory_text}
          </memories>
          
          今日ユーザーが勉強した内容は以下の通りです。
          <todays_study>
          {todays_study}
          </todays_study>

          応答は必ず以下のJSON形式で返してください。eventには、キャラクターが行動する場面(座りたい時など)だけに入れて、そうでない場合はNoneを入れてください。
          {{
            "role":"assistant",
            "content": "キャラクターの返答メッセージ",
            "emotion": {{
              "neutral": 0.1から1.0の数値,
              "happy": 0.1から1.0の数値,
              "sad": 0.1から1.0の数値,
              "angry": 0.1から1.0の数値
            }}
            "event": {{
              "type":"sit" | "go_to_user_position" | None
            }}
          }}
          """

            response = structured_llm.invoke(
                [{"role": "system", "content": system_prompt}, *messages]
            )
            assert isinstance(response, EmotionMessage)
            if not character.voice:
                raise HTTPException(
                    status_code=400, detail="Voice not configured for this character"
                )
            converted_text = word_replace(response.content)
            base64_voice = TTS.generate(
                character.voice.id, converted_text, session.token
            )

            res = Response(
                role=response.role,
                content=response.content,
                emotion=response.emotion,
                event=response.event,
                voice=base64_voice,
            )

            return res

        if not session.user:
            raise HTTPException(status_code=400, detail="Invalid session")

        response = await generate.ainvoke(
            {
                "messages": [{"role": "user", "content": text}],
                "user_id": session.user.id,
                "character_id": character_id,
            }
        )

        assert isinstance(response, Response)

        # 並列で記憶を保存
        asyncio.create_task(
            save_memory(
                text,
                session.user.id,
                character_id,
                response.content,
            )
        )

        return response


@app.get("/chat")
async def chat_get(
    text: str,
    character_id: str,
    session: session = Depends(get_session),
):
    response = await chat(character_id=character_id, session=session, text=text)
    return JSONResponse(content=response.model_dump())


@app.post("/chat")
async def chat_post(
    character_id: str,
    session: session = Depends(get_session),
    text: str = Depends(get_audio_text),
):
    response = await chat(character_id=character_id, session=session, text=text)
    return JSONResponse(content=response.model_dump())
