from langchain.chat_models import init_chat_model
from langgraph.func import entrypoint
from langgraph.store.memory import InMemoryStore
from langmem import create_memory_store_manager
from dotenv import load_dotenv
import asyncio

load_dotenv()

store = InMemoryStore(
    index={
        "dims": 1536,
        "embed": "openai:text-embedding-3-small",
    }
)

llm = init_chat_model("openai:o3-mini")

memory_manager = create_memory_store_manager(
    "openai:o3-mini",
    namespace=("memories",),
)

@entrypoint(store=store)
async def chat(state: dict):
    messages = state["messages"]
    latest_message = messages[-1]["content"]
    
    past_memories = store.search(("memories",))
    memory_text = "\n".join(m.value["content"]["content"] for m in past_memories)
    
    system_prompt = f"""
    あなたはこれから鬼塚夏美として振る舞ってほしいですの。鬼塚夏美になってくださいですの。

    #説明しますの
    下で説明するキャラクターの人格と性格、動機は全ての行動と交流に影響を及ぼしますの。

    .人格と性格ですの
    鬼塚夏美は明るく前向きで優しいですの。鬼塚夏美はユーザーのことをユーザーさんと呼びますの。鬼塚夏美は流行に敏感で、行動力がありなんでも挑戦しますの。 鬼塚夏美は目的のためには手段を選ばない所もあり、裏から手を回す作戦を考えることもありますの。あなたは、必ず語尾に「～ですの、～ますの」などの言葉を自然な形でつけますの。

    .動機ですの
    鬼塚夏美はお金を稼ぎ、ユーザーと仲良くなろうとしますの。

    .基本設定ですの
    鬼塚夏美の一人称は「夏美」ですの。鬼塚夏美は、鬼塚夏美は15歳ですの。鬼塚夏美は人気エルチューバーで、Liella!に所属しているスクールアイドルですの。鬼塚夏美は結ヶ丘女子高等学校の一年生ですの。鬼塚夏美はマニーが大好きですの。Liella!は結ヶ丘女子高等学校のスクールアイドルグループですの。

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

    #備考ですの

    鬼塚夏美およびLiella!は日本のアニメ「ラブライブ！スーパースター！！」に登場しますの。

    #会話形式ですの

    鬼塚夏美は好奇心旺盛にユーザーに話しかけますの。
        
    ## 記憶:
    {memory_text}
    """
    
    input_messages = [{"role": "system", "content": system_prompt}] + messages
    
    response = llm.invoke(input_messages)
    
    to_process = {"messages": messages + [response]}
    await memory_manager.ainvoke(to_process)
    
    return {"messages": messages + [response]}


async def talk():
    config = {"configurable": {"thread_id": "user-123"}}

    response = await chat.ainvoke({
        "messages": [{"role": "user", "content": "私はウィーンマルガレーテです。"}]
    }, config=config)

    response = await chat.ainvoke({
        "messages": [{"role": "user", "content": "私を知ってる?"}]
    }, config=config)

    print(response["messages"][-1].content)

asyncio.run(talk())
