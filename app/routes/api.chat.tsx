import { ActionFunctionArgs } from "@remix-run/node";
import { ConversationManager } from "~/lib/LangChain/ConversationManager";

const API_KEY = process.env.OPENAI_API_KEY;
if (!API_KEY) {
  throw new Error("Missing OpenAI API Key. Please set OPENAI_API_KEY in .env");
}

const conversationManager = new ConversationManager(API_KEY);

export async function action({ request }: ActionFunctionArgs) {
  try {
    const body = await request.json();
    const { message } = body;

    if (!message) {
      return Response.json({ error: "メッセージが必要です" }, { status: 400 });
    }

    const response = await conversationManager.chat(message);
    return Response.json({ response });
  } catch (error) {
    console.error("Err:", error);
    return Response.json(
      { error: "内部エラーが発生しました" },
      { status: 500 }
    );
  }
}
