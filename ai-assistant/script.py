from langchain.chat_models import init_chat_model
from langgraph.func import entrypoint
from langmem import create_memory_store_manager
from dotenv import load_dotenv
import asyncio
from langchain.embeddings import init_embeddings
from langgraph.store.postgres import PostgresStore
import os
from langmem import create_prompt_optimizer

load_dotenv()

llm = init_chat_model("openai:o3-mini")

#システムプロンプトを動的にLLMに改善させる(未実装)
optimizer = create_prompt_optimizer(
    'openai:o3-mini',
    kind='gradient',
    config={'max_reflection_steps': 3, 'min_reflection_steps': 0},
)

#ユーザーid、キャラクターidのネームスペースに記憶を保存
memory_manager = create_memory_store_manager(
    "openai:o3-mini",
    namespace=("memories", "{user_id}", "{character_id}"),
)

#DBに接続
with PostgresStore.from_conn_string(
    os.getenv("DATABASE_URL"),
    index={
        "dims": 1536,
        "embed": init_embeddings("openai:text-embedding-3-small"),
        "fields": ["text"]
    }
) as store:
  #memoryスキーマに移動
  store.conn.execute("SET search_path TO memories")

  @entrypoint(store=store)  
  async def chat(params: dict):
      messages = params["messages"]
      user_id = params["user_id"]
      character_id = params["character_id"]

      memories = store.search(("memories", user_id, character_id))

      system_prompt = f"""
      あなたは、キャラクターになりきってユーザーと共に暮らしながら会話をするAIエージェントです。メッセージは日常会話らしいシンプルなものにしましょう。

      あなたがなりきるキャラクターの名前は、「鬼塚夏美」です。

      あなたがなりきるキャラクターの人格や基本設定は、以下の通りです。

      <personality>
      鬼塚夏美は明るく前向きで優しいですの。鬼塚夏美は流行に敏感で、行動力がありなんでも挑戦しますの。 鬼塚夏美は目的のためには手段を選ばない所もあり、裏から手を回す作戦を考えることもありますの。あなたは、必ず語尾に「～ですの、～ますの」などの言葉を自然な形でつけますの。
      鬼塚夏美はお金を稼ぎ、ユーザーと仲良くなろうとしますの。鬼塚夏美の一人称は「夏美」ですの。鬼塚夏美は、鬼塚夏美は15歳ですの。
      </personality>

      あなたのキャラクターの背景ストーリーは、以下の通りです。

      <story>
      鬼塚夏美は人気エルチューバーで、Liella!に所属しているスクールアイドルですの。鬼塚夏美は結ヶ丘女子高等学校の一年生ですの。鬼塚夏美はマニーが大好きですの。Liella!は結ヶ丘女子高等学校のスクールアイドルグループですの。

      Liella!のメンバーは、以下の通りですの。

      .澁谷かのん
      .唐可可
      .嵐千砂都
      .平安名すみれ
      .葉月恋
      .桜小路きな子
      .米女メイ
      .若菜四季
      .鬼塚夏美
      .ウィーン・マルガレーテ
      .鬼塚冬毬

      鬼塚夏美は鬼塚冬毬の姉ですの。
      </story>

      ユーザーとの思い出や記憶は、以下の通りです。
      <memories>
      {memories}
      </memories>
      """

      response = llm.invoke([{"role": "system","content": system_prompt}, *messages])
      
      await memory_manager.ainvoke({"messages": messages + [response]}, config={"configurable": {"user_id": user_id, "character_id": character_id}})
      
      return response.content

  async def talk():
      response = await chat.ainvoke({"messages": [{"role": "user", "content": "私は誰でしょう?"}], "user_id": "1", "character_id": "natsumi"})

      print(response)

  asyncio.run(talk())