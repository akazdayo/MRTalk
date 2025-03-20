export interface ChatResponse {
  response: string;
  error?: string;
}

export class Chat {
  private isGeneratingResponse: boolean = false;
  private apiEndpoint: string;

  constructor(characterId: string) {
    this.apiEndpoint = `/api/chat/${characterId}`;
  }

  async talk(text: string): Promise<ChatResponse> {
    if (this.isGeneratingResponse) {
      return { response: "", error: "Already processing a request" };
    }

    this.isGeneratingResponse = true;

    try {
      const response = await fetch(this.apiEndpoint + `?text=${text}`, {});

      if (!response.ok) {
        throw new Error("Failed to get response");
      }

      const data = await response.json();
      return { response: data.response };
    } catch (error) {
      return {
        response: "",
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
      };
    } finally {
      this.isGeneratingResponse = false;
    }
  }

  async voiceChat(blob: Blob): Promise<ChatResponse> {
    if (this.isGeneratingResponse) {
      return { response: "", error: "Already processing a request" };
    }

    this.isGeneratingResponse = true;

    try {
      const form = new FormData();
      form.set("file", blob);

      const response = await fetch(this.apiEndpoint, {
        method: "POST",
        body: form,
      });

      if (!response.ok) {
        throw new Error("Failed to get response");
      }

      const data = await response.json();
      return { response: data.response };
    } catch (error) {
      return {
        response: "",
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
      };
    } finally {
      this.isGeneratingResponse = false;
    }
  }
}
