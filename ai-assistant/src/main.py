import datetime
import os
import io
import asyncio
import base64
from typing import Any, Dict

from fastapi import Depends, FastAPI, HTTPException, Header, Request
from fastapi.responses import JSONResponse
from langchain_openai import ChatOpenAI
from langchain.embeddings import init_embeddings
from langgraph.func import entrypoint
from langgraph.store.postgres import AsyncPostgresStore
from langmem import create_memory_store_manager

from prisma import Prisma
from prisma.models import Character, User
import speech_recognition as sr
from pydub import AudioSegment
from langchain_google_genai import ChatGoogleGenerativeAI

from pydantic import BaseModel, Field
from typing import Dict, Any

from parler_tts import ParlerTTSForConditionalGeneration
from transformers import AutoTokenizer
import soundfile as sf
from rubyinserter import add_ruby


class Emotion(BaseModel):
    neutral: float = Field(description="ニュートラルの感情値（0〜1の間）")
    happy: float = Field(description="幸せの感情値（0〜1の間）")
    sad: float = Field(description="悲しみの感情値（0〜1の間）")
    angry: float = Field(description="怒りの感情値（0〜1の間）")


class EmotionMessage(BaseModel):
    role: str = Field(description="メッセージの役割（assistant）")
    content: str = Field(description="メッセージ内容")
    emotion: Emotion = Field(description="感情オブジェクト")
    voice: str = Field(description="Base64エンコードされた音声データ", default=None)


model = ParlerTTSForConditionalGeneration.from_pretrained(
    "2121-8/japanese-parler-tts-mini-bate").to("cpu")
tokenizer = AutoTokenizer.from_pretrained(
    "2121-8/japanese-parler-tts-mini-bate")
r = sr.Recognizer()
app = FastAPI()
llm = ChatGoogleGenerativeAI(model='gemini-2.0-flash')
structured_llm = llm.with_structured_output(EmotionMessage)

# ユーザーID、キャラクターIDのネームスペースに記憶を保存
memory_manager = create_memory_store_manager(
    "gpt-4o-mini",
    namespace=("memories", "{user_id}", "{character_id}"),
)


# 音声合成
def generate_voice(prompt: str):
    description = "A female speaker with a slightly high-pitched voice delivers her words at a moderate speed with a quite monotone tone in a confined environment, resulting in a quite clear audio recording."

    prompt = add_ruby(prompt)
    input_ids = tokenizer(description, return_tensors="pt").input_ids.to("cpu")
    prompt_input_ids = tokenizer(
        prompt, return_tensors="pt").input_ids.to("cpu")

    generation = model.generate(
        input_ids=input_ids, prompt_input_ids=prompt_input_ids)
    audio_arr = generation.cpu().numpy().squeeze()
    audio_bytes = audio_arr.tobytes()

    base64_audio = base64.b64encode(audio_bytes).decode('utf-8')

    return base64_audio


# 音声ファイルを文字起こし
async def get_audio_text(request: Request) -> str:
    form = await request.form()
    file = form['file']
    file_content = await file.read()

    audio_file = io.BytesIO(file_content)

    audio = AudioSegment.from_file(audio_file)
    wav_audio = io.BytesIO()
    audio.export(wav_audio, format="wav")
    wav_audio.seek(0)

    with sr.AudioFile(wav_audio) as source:
        audio_data = r.record(source)

    try:
        text = r.recognize_google(audio_data, language='ja-JP')

        return text
    except sr.UnknownValueError:
        raise HTTPException(status_code=400, detail="音声を理解できませんでした")
    except sr.RequestError as e:
        raise HTTPException(status_code=400, detail="エラーが発生しました。")


# セッショントークンからユーザーを取得
async def get_current_user(authorization: str = Header(None)) -> User:
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
        raise HTTPException(
            status_code=400, detail="Character not found")

    await prisma.disconnect()
    return character


# 記憶を保存
async def save_memory(messages, user_id, character_id, response_content):
    async with AsyncPostgresStore.from_conn_string(
        os.getenv("DATABASE_URL"),
        index={
            "dims": 1536,
            "embed": init_embeddings("openai:text-embedding-3-small"),
            "fields": ["text"],
        },
    ) as store:
        await store.conn.execute("SET search_path TO memories")
        await store.setup()

        @entrypoint(store=store)
        async def save_to_memory(params: Dict[str, Any]):
            await memory_manager.ainvoke(
                {"messages": params["messages"] + [{"role": "assistant",
                                                    "content": params["response_content"]}]},
                config={"configurable": {
                    "user_id": params["user_id"], "character_id": params["character_id"]}},
            )

        await save_to_memory.ainvoke({
            "messages": messages,
            "user_id": user_id,
            "character_id": character_id,
            "response_content": response_content
        })


async def talk(text: str, current_user: User, character_id: str):
    async with AsyncPostgresStore.from_conn_string(
        os.getenv("DATABASE_URL"),
        index={
            "dims": 1536,
            "embed": init_embeddings("openai:text-embedding-3-small"),
            "fields": ["text"],
        },
    ) as store:
        await store.conn.execute("SET search_path TO memories")
        await store.setup()

        @entrypoint(store=store)
        async def chat(params: Dict[str, Any]):
            messages = params["messages"]
            user_id = params["user_id"]
            character_id = params["character_id"]

            character = await get_character(character_id)

            memories = await store.asearch(
                ("memories", user_id, character_id))
            memory_text = "\n".join(
                m.value["content"]["content"] for m in memories)

            system_prompt = f"""
          今の時間は <time>{datetime.datetime.now(datetime.timezone.utc)}</time> です。

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

          応答は必ず以下のJSON形式で返してください：
          {{
            "role":"assistant",
            "content": "キャラクターの返答メッセージ",
            "emotion": {{
              "neutral": 0.1から1.0の数値,
              "happy": 0.1から1.0の数値,
              "sad": 0.1から1.0の数値,
              "angry": 0.1から1.0の数値
            }}
          }}
          """

            response = structured_llm.invoke(
                [{"role": "system", "content": system_prompt}, *messages]
            )

            base64_voice = generate_voice(response.content)

            emotion_message = EmotionMessage(
                role=response.role,
                content=response.content,
                emotion=response.emotion,
                voice=base64_voice
            )

            return emotion_message

        response = await chat.ainvoke(
            {
                "messages": [{"role": "user", "content": text}],
                "user_id": current_user.id,
                "character_id": character_id,
            }
        )

        # 並列で記憶を保存
        asyncio.create_task(
            save_memory(
                [{"role": "user", "content": text}],
                current_user.id,
                character_id,
                response.content
            )
        )

        return response


@app.get("/chat")
async def chat_get(
    text: str,
    character_id: str,
    current_user: User = Depends(get_current_user),
) -> Dict[str, str]:
    response = await talk(character_id=character_id,
                          current_user=current_user, text=text)
    return JSONResponse(content=response.dict())


@app.post("/chat")
async def chat_post(
    character_id: str,
    current_user: User = Depends(get_current_user),
    text: str = Depends(get_audio_text),
) -> Dict[str, str]:
    response = await talk(character_id=character_id,
                          current_user=current_user, text=text)
    return JSONResponse(content=response.dict())
