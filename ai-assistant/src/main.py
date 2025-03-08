import datetime
import os
from typing import Any, Dict

from fastapi import Depends, FastAPI, HTTPException
from langchain.chat_models import init_chat_model
from langchain.embeddings import init_embeddings
from langgraph.func import entrypoint
from langgraph.store.postgres import PostgresStore
from langmem import create_memory_store_manager, create_prompt_optimizer

from prisma import Prisma
from prisma.models import Character, User

app = FastAPI()

llm = init_chat_model("openai:o3-mini")

# システムプロンプトを動的にLLMに改善させる(未実装)
optimizer = create_prompt_optimizer(
    "openai:o3-mini",
    kind="gradient",
    config={"max_reflection_steps": 3, "min_reflection_steps": 0},
)

# ユーザーID、キャラクターIDのネームスペースに記憶を保存
memory_manager = create_memory_store_manager(
    "openai:o3-mini",
    namespace=("memories", "{user_id}", "{character_id}"),
)


# セッショントークンからユーザーを取得
async def get_current_user(token: str) -> User:
    prisma = Prisma()
    await prisma.connect()

    session = await prisma.session.find_unique(
        where={"token": token}, include={"user": True}
    )

    await prisma.disconnect()

    if not session or session.expiresAt < datetime.utcnow():
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    return session.user


# キャラクタ-IDからキャラクターを取得
async def get_character(id: str) -> Character | None:
    prisma = Prisma()
    await prisma.connect()
    character = await prisma.character.find_unique(where={"id": id})
    await prisma.disconnect()
    return character


@app.get("/")
async def root() -> Dict[str, str]:
    return {"message": "welcome to MRTalk API."}


@app.get("/chat")
async def talk(
    text: str,
    user_id: str,
    character_id: str,
    current_user: User = Depends(get_current_user),
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

        @entrypoint(store=store)
        async def chat(params: Dict[str, Any]) -> str:
            messages = params["messages"]
            user_id = params["user_id"]
            character_id = params["character_id"]

            character = await get_character(character_id)

            memories = store.search(("memories", user_id, character_id))

            system_prompt = f"""
          あなたは、キャラクターになりきってユーザーと共に暮らしながら会話をするAIエージェントです。メッセージは日常会話らしいシンプルなものにしましょう。

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
                "user_id": user_id,
                "character_id": character_id,
            }
        )
        return {"response": response}
