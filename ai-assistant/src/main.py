import asyncio
import datetime
import io
import logging
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

# ログ設定
logging.basicConfig(
    level=logging.DEBUG,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[logging.FileHandler("chat_debug.log"), logging.StreamHandler()],
)
logger = logging.getLogger(__name__)

r = sr.Recognizer()
app = FastAPI()
llm = ChatGoogleGenerativeAI(model="gemini-2.0-flash")
structured_llm = llm.with_structured_output(EmotionMessage)
db_url = os.getenv("DATABASE_URL") or ""

# グローバルPrismaインスタンス
prisma = Prisma()


# FastAPIイベントハンドラ
@app.on_event("startup")
async def startup():
    await prisma.connect()
    logger.info("データベース接続が確立されました")
    logger.info("チャットバックエンドが初期化されました")


@app.on_event("shutdown")
async def shutdown():
    await prisma.disconnect()
    logger.info("データベース接続が切断されました")


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
    logger.info("音声ファイルの文字起こし処理を開始")

    try:
        form = await request.form()
        file = form["file"]
        logger.debug(
            f"受信したファイル: {file.filename if hasattr(file, 'filename') else 'unknown'}"
        )

        assert not isinstance(file, str)
        file_content = await file.read()
        logger.debug(f"ファイルサイズ: {len(file_content)} bytes")

        audio_file = io.BytesIO(file_content)

        audio = AudioSegment.from_file(audio_file)
        wav_audio = io.BytesIO()
        audio.export(wav_audio, format="wav")
        wav_audio.seek(0)
        logger.debug("音声ファイルをWAV形式に変換完了")

        with sr.AudioFile(wav_audio) as source:
            audio_data = r.record(source)

        logger.info("Google Speech Recognition APIに送信中...")
        text = r.recognize_google(audio_data, language="ja-JP")  # type:ignore
        logger.info(f"音声認識結果: {text}")

        return text
    except sr.UnknownValueError:
        logger.warning("音声を理解できませんでした")
        raise HTTPException(status_code=400, detail="音声を理解できませんでした")
    except sr.RequestError as e:
        logger.error(f"Speech Recognition APIエラー: {e}")
        raise HTTPException(status_code=400, detail="エラーが発生しました。")
    except Exception as e:
        logger.error(f"音声処理中に予期しないエラー: {e}")
        raise HTTPException(status_code=500, detail="音声処理中にエラーが発生しました")


# セッションを取得
async def get_session(authorization: str = Header(None)) -> session:
    logger.debug("セッション認証処理を開始")

    if not authorization:
        logger.warning("認証ヘッダーが見つかりません")
        raise HTTPException(status_code=401, detail="Unauthorized")

    token = authorization.replace("Bearer ", "")
    logger.debug(f"トークンを抽出: {token[:10]}..." if len(token) > 10 else token)

    try:
        logger.debug("セッション取得処理中...")

        session = await prisma.session.find_unique(
            where={"token": token}, include={"user": True}
        )

        if not session:
            logger.warning(f"セッションが見つかりません - Token: {token[:10]}...")
            raise HTTPException(status_code=401, detail="Invalid or expired token")

        if session.expiresAt < datetime.datetime.now(datetime.timezone.utc):
            logger.warning(
                f"セッションが期限切れです - User ID: {session.userId}, Expires: {session.expiresAt}"
            )
            raise HTTPException(status_code=401, detail="Invalid or expired token")

        logger.info(f"セッション認証成功 - User ID: {session.userId}")
        return session

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"セッション取得中にエラーが発生: {e}")
        raise HTTPException(
            status_code=500, detail="セッション処理中にエラーが発生しました"
        )


async def get_character(id: str) -> character | None:
    logger.debug(f"キャラクター取得処理を開始 - ID: {id}")

    try:
        character = await prisma.character.find_unique(
            where={"id": id}, include={"voice": True}
        )

        if not character:
            logger.warning(f"キャラクターが見つかりません - ID: {id}")
            raise HTTPException(status_code=400, detail="Character not found")

        logger.info(f"キャラクター取得成功 - Name: {character.name}, ID: {id}")
        return character

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"キャラクター取得中にエラーが発生 - ID: {id}, Error: {e}")
        raise HTTPException(
            status_code=500, detail="キャラクター取得中にエラーが発生しました"
        )


async def get_todays_study_content() -> str:
    logger.debug("今日の学習内容を取得中...")

    try:
        study = await prisma.todays_study.find_first(
            where={"id": "0"},
        )
        content = study.content if study else "今日の学習内容はありません。"

        logger.info(
            f"今日の学習内容取得完了: {content[:50]}..."
            if len(content) > 50
            else content
        )
        return content

    except Exception as e:
        logger.error(f"今日の学習内容取得中にエラーが発生: {e}")
        return "今日の学習内容はありません。"


# 記憶を保存
async def save_memory(
    user_input: str, user_id: str, character_id: str, response_content: str
):
    logger.info(f"記憶保存処理を開始 - User: {user_id}, Character: {character_id}")

    try:
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
            logger.debug("メモリストアセットアップ完了")

            @entrypoint(store=store)
            async def save(params: Dict[str, Any]):
                messages = [
                    HumanMessage(content=params["user_input"]),
                    AIMessage(content=params["response_content"]),
                ]
                logger.debug(
                    f"メッセージ保存中 - Input: {params['user_input'][:50]}..., Response: {params['response_content'][:50]}..."
                )

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

            logger.info("記憶保存完了")

    except Exception as e:
        logger.error(
            f"記憶保存中にエラーが発生 - User: {user_id}, Character: {character_id}, Error: {e}"
        )


async def chat(text: str, session: session, character_id: str):
    logger.info(
        f"チャット処理開始 - User: {session.user.id if session.user else 'Unknown'}, Character: {character_id}"
    )
    logger.debug(f"入力テキスト: {text}")

    try:
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
            logger.debug("チャット用メモリストアセットアップ完了")

            @entrypoint(store=store)
            async def generate(params: Dict[str, Any]) -> Response | None:
                messages = params["messages"]
                user_id = params["user_id"]
                character_id = params["character_id"]

                logger.debug(f"レスポンス生成開始 - Messages: {len(messages)}件")

                character = await get_character(character_id)
                todays_study = await get_todays_study_content()

                if not (character):
                    logger.error(f"キャラクターが見つかりません - ID: {character_id}")
                    raise HTTPException(status_code=400, detail="Character Not Found")

                if not character.isPublic and character.postedBy != user_id:
                    logger.warning(
                        f"キャラクターへのアクセス権限がありません - Character: {character_id}, User: {user_id}"
                    )
                    raise HTTPException(status_code=400, detail="Character Not Found")

                # logger.debug("過去の記憶を検索中...")
                # logger.debug(f"記憶検索完了 - {len(memories)}件の記憶を取得")

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

                logger.debug("LLMにプロンプトを送信中...")
                response = structured_llm.invoke(
                    [{"role": "system", "content": system_prompt}, *messages]
                )
                assert isinstance(response, EmotionMessage)
                logger.info(
                    f"LLMレスポンス取得完了 - Content: {response.content[:100]}..."
                )

                if not character.voice:
                    logger.error(
                        f"キャラクターに音声が設定されていません - Character: {character_id}"
                    )
                    raise HTTPException(
                        status_code=400,
                        detail="Voice not configured for this character",
                    )

                logger.debug("テキスト変換処理中...")
                converted_text = word_replace(response.content)
                logger.debug(f"変換後テキスト: {converted_text}")

                logger.debug("TTS音声生成中...")
                # TTS音声生成をコメントアウト
                # base64_voice = TTS.generate(
                #    character.voice.id, converted_text, session.token
                # )
                base64_voice = ""  # 空の音声データ
                logger.info("TTS音声生成完了（コメントアウト済み）")

                res = Response(
                    role=response.role,
                    content=response.content,
                    emotion=response.emotion,
                    event=response.event,
                    voice=base64_voice,
                )

                logger.debug(
                    f"レスポンス生成完了 - Emotion: {response.emotion}, Event: {response.event}"
                )
                return res

        if not session.user:
            logger.error("セッションにユーザー情報がありません")
            raise HTTPException(status_code=400, detail="Invalid session")

        response = await generate.ainvoke(
            {
                "messages": [{"role": "user", "content": text}],
                "user_id": session.user.id,
                "character_id": character_id,
            }
        )

        assert isinstance(response, Response)
        logger.info("チャットレスポンス生成完了")

        # 並列で記憶を保存
        logger.debug("記憶保存タスクを開始...")
        asyncio.create_task(
            save_memory(
                text,
                session.user.id,
                character_id,
                response.content,
            )
        )

        return response

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"チャット処理中に予期しないエラーが発生: {e}")
        raise HTTPException(
            status_code=500, detail="チャット処理中にエラーが発生しました"
        )


@app.get("/chat")
async def chat_get(
    text: str,
    character_id: str,
    session: session = Depends(get_session),
):
    logger.info(
        f"GET /chat エンドポイント呼び出し - Character: {character_id}, User: {session.user.id if session.user else 'Unknown'}"
    )

    try:
        response = await chat(character_id=character_id, session=session, text=text)
        logger.info("GET /chat 正常完了")
        return JSONResponse(content=response.model_dump())
    except Exception as e:
        logger.error(f"GET /chat でエラーが発生: {e}")
        raise


@app.post("/chat")
async def chat_post(
    character_id: str,
    session: session = Depends(get_session),
    text: str = Depends(get_audio_text),
):
    logger.info(
        f"POST /chat エンドポイント呼び出し - Character: {character_id}, User: {session.user.id if session.user else 'Unknown'}"
    )

    try:
        response = await chat(character_id=character_id, session=session, text=text)
        logger.info("POST /chat 正常完了")
        return JSONResponse(content=response.model_dump())
    except Exception as e:
        logger.error(f"POST /chat でエラーが発生: {e}")
        raise
