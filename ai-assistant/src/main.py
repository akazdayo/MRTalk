import datetime
import os
import io
import asyncio
from typing import Any, Dict

from fastapi import Depends, FastAPI, HTTPException, Header, Request
from fastapi.responses import JSONResponse
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain.schema import HumanMessage, AIMessage
from langgraph.func import entrypoint
from langgraph.store.postgres import AsyncPostgresStore
from langmem import create_memory_store_manager
from psycopg import AsyncConnection

from prisma import Prisma
from prisma.models import Character, User
import speech_recognition as sr
from pydub import AudioSegment

from src.tts import TTS
from src.schema import EmotionMessage, Response


r = sr.Recognizer()
tts = TTS()
app = FastAPI()
llm = ChatGoogleGenerativeAI(model="gemini-2.0-flash")
structured_llm = llm.with_structured_output(EmotionMessage)
db_url = os.getenv("DATABASE_URL") or ""


# ユーザーID、キャラクターIDのネームスペースに記憶を保存
memory_manager = create_memory_store_manager(
    llm,
    namespace=("memories", "{user_id}", "{character_id}"),
)


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


# セッショントークンからユーザーを取得
async def get_current_user(authorization: str = Header(None)) -> User | None:
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

    return session.user


async def get_character(id: str) -> Character | None:
    prisma = Prisma()
    await prisma.connect()
    character = await prisma.character.find_unique(where={"id": id})

    if not character:
        raise HTTPException(status_code=400, detail="Character not found")

    await prisma.disconnect()
    return character


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

        @entrypoint(store=store)
        async def save(params: Dict[str, Any]):
            messages = [
                HumanMessage(content=params["user_input"]),
                AIMessage(content=params["response_content"]),
            ]

            await memory_manager.ainvoke(
                {"messages": messages},
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


async def chat(text: str, current_user: User, character_id: str):
    async with AsyncPostgresStore.from_conn_string(
        db_url,
        index={
            "dims": 1536,
            "embed": "openai:text-embedding-3-small",
            "fields": ["text"],
        },
    ) as store:
        assert isinstance(store.conn, AsyncConnection)

        @entrypoint(store=store)
        async def generate(params: Dict[str, Any]) -> Response | None:
            messages = params["messages"]
            user_id = params["user_id"]
            character_id = params["character_id"]

            character = await get_character(character_id)
            if not (character):
                raise HTTPException(status_code=400, detail="Character Not Found")

            if not character.is_public and character.postedBy != user_id:
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
          {character.personality}
          </personality>

          <story>
          {character.story}
          </story>

          ユーザーとの思い出や記憶は、以下の通りです。
          <memories>
          {memory_text}
          </memories>

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

            base64_voice = tts.generate(character_id, response.content)

            res = Response(
                role=response.role,
                content=response.content,
                emotion=response.emotion,
                event=response.event,
                voice=base64_voice,
            )

            return res

        response = await generate.ainvoke(
            {
                "messages": [{"role": "user", "content": text}],
                "user_id": current_user.id,
                "character_id": character_id,
            }
        )

        assert isinstance(response, Response)

        # 並列で記憶を保存
        asyncio.create_task(
            save_memory(
                text,
                current_user.id,
                character_id,
                response.content,
            )
        )

        return response


@app.get("/chat")
async def chat_get(
    text: str,
    character_id: str,
    current_user: User = Depends(get_current_user),
):
    print(text)
    response = await chat(
        character_id=character_id, current_user=current_user, text=text
    )
    return JSONResponse(content=response.model_dump())


@app.post("/chat")
async def chat_post(
    character_id: str,
    current_user: User = Depends(get_current_user),
    text: str = Depends(get_audio_text),
):
    response = await chat(
        character_id=character_id, current_user=current_user, text=text
    )
    return JSONResponse(content=response.model_dump())
