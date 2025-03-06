import { OpenAI } from "@langchain/openai";
import { ConversationChain } from "langchain/chains";
import { BufferMemory } from "langchain/memory";

export class ConversationManager {
  APIKEY: string;
  modelName: string;
  temperature: number;
  verbose: boolean;
  memory: BufferMemory;
  model: OpenAI;
  chain: ConversationChain;

  constructor(
    APIKEY: string,
    modelName = "o3-mini",
    temperature = 0.7,
    verbose = false
  ) {
    this.APIKEY = APIKEY;
    this.modelName = modelName;
    this.temperature = temperature;
    this.verbose = verbose;
    this.memory = new BufferMemory();

    this.model = new OpenAI({
      openAIApiKey: this.APIKEY,
      modelName: this.modelName,
      temperature: this.temperature,
    });

    this.chain = new ConversationChain({
      llm: this.model,
      memory: this.memory,
      verbose: this.verbose,
    });
  }

  async chat(userInput: string): Promise<string> {
    try {
      const response = await this.chain.call({ input: userInput });
      return response.response;
    } catch (error) {
      console.error("チャット処理中にエラーが発生しました:", error);
      throw error;
    }
  }

  async exportState(): Promise<object> {
    try {
      return await this.memory.loadMemoryVariables({});
    } catch (error) {
      console.error("会話状態のエクスポート中にエラーが発生しました:", error);
      throw error;
    }
  }

  async importState(state: object): Promise<void> {
    try {
      this.memory = new BufferMemory();
      await this.memory.saveContext({}, state);

      this.chain = new ConversationChain({
        llm: this.model,
        memory: this.memory,
        verbose: this.verbose,
      });
    } catch (error) {
      console.error("会話状態のインポート中にエラーが発生しました:", error);
      throw error;
    }
  }

  clearHistory(): void {
    try {
      this.memory = new BufferMemory();
      this.chain = new ConversationChain({
        llm: this.model,
        memory: this.memory,
        verbose: this.verbose,
      });
    } catch (error) {
      console.error("会話履歴のクリア中にエラーが発生しました:", error);
      throw error;
    }
  }

  updateSettings({
    modelName,
    temperature,
    verbose,
  }: {
    modelName?: string;
    temperature?: number;
    verbose?: boolean;
  }): void {
    if (modelName) this.modelName = modelName;
    if (temperature !== undefined) this.temperature = temperature;
    if (verbose !== undefined) this.verbose = verbose;

    this.model = new OpenAI({
      openAIApiKey: this.APIKEY,
      modelName: this.modelName,
      temperature: this.temperature,
    });

    this.chain = new ConversationChain({
      llm: this.model,
      memory: this.memory,
      verbose: this.verbose,
    });
  }
}
