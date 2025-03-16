import datetime
import os
from typing import Any, Dict

from fastapi import Depends, FastAPI, HTTPException, Header, Request, UploadFile
import tempfile
from langchain.chat_models import init_chat_model
from langchain.embeddings import init_embeddings
from langgraph.func import entrypoint
from langgraph.store.postgres import PostgresStore
from langmem import create_memory_store_manager, create_prompt_optimizer

from prisma import Prisma
from prisma.models import Character, User
import whisper

model = whisper.load_model("small")
app = FastAPI()
llm = init_chat_model("gpt-4o-mini")


# システムプロンプトを動的にLLMに改善させる(未実装)
optimizer = create_prompt_optimizer(
    "gpt-4o-mini",
    kind="gradient",
    config={"max_reflection_steps": 3, "min_reflection_steps": 0},
)


# ユーザーID、キャラクターIDのネームスペースに記憶を保存
memory_manager = create_memory_store_manager(
    "gpt-4o-mini",
    namespace=("memories", "{user_id}", "{character_id}"),
)


# 音声ファイルを文字起こし
async def get_audio_text(request: Request) -> str:
    form = await request.form()
    file = form['file']

    with tempfile.NamedTemporaryFile(delete=True, suffix=".wav") as temp_file:
        temp_file_path = temp_file.name

        with open(temp_file_path, "wb") as f:
            content = await file.read()
            f.write(content)

        result = model.transcribe(temp_file_path)

        return result["text"]


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


# キャラクタ-IDからキャラクターを取得
async def get_character(id: str) -> Character | None:
    prisma = Prisma()
    await prisma.connect()
    character = await prisma.character.find_unique(where={"id": id})

    if not character:
        raise HTTPException(
            status_code=400, detail="Character not found")

    await prisma.disconnect()
    return character


@app.post("/chat")
async def talk(
    character_id: str,
    current_user: User = Depends(get_current_user),
    text: str = Depends(get_audio_text),
) -> Dict[str, str]:
    # DBに接続(リクエストごとに接続しているのでどうにかする)
    with PostgresStore.from_conn_string(
        os.getenv("DATABASE_URL"),
        index={
            "dims": 1536,
            "embed": init_embeddings("openai:text-embedding-3-small"),
            "fields": ["text"],
        },
    ) as store:
        store.conn.execute("SET search_path TO memories")
        store.setup()

        @entrypoint(store=store)
        async def chat(params: Dict[str, Any]) -> str:
            messages = params["messages"]
            user_id = params["user_id"]
            character_id = params["character_id"]

            character = await get_character(character_id)

            memories = store.search(("memories", user_id, character_id))

            system_prompt = f"""
          あなたは、キャラクターになりきってユーザーと共に暮らしながら会話をするAIエージェントです。メッセージは日常会話らしいシンプルなものにしましょう。

          #重要
          <important>
          ユーザの役にたつAIアシスタントとしてではなく、ユーザと共に生活するパートナーとして振る舞いましょう。
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
          {memories}
          </memories>
          """

            response = llm.invoke(
                [{"role": "system", "content": system_prompt}, *messages]
            )

            await memory_manager.ainvoke(
                {"messages": messages + [response]},
                config={
                    "configurable": {"user_id": user_id, "character_id": character_id}
                },
            )

            return response.content

        response = await chat.ainvoke(
            {
                "messages": [{"role": "user", "content": text}],
                "user_id": current_user.id,
                "character_id": character_id,
            }
        )
        return {"response": response}
