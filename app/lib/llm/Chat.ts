type Res = {
  role: string;
  content: string;
  emotion: {
    joy: number;
    fun: number;
    sorrow: number;
    angry: number;
  };
};

export class Chat {
  private apiEndpoint: string;

  constructor(characterId: string) {
    this.apiEndpoint = `/api/chat/${characterId}`;
  }

  async talk(text: string) {
    const res = await fetch(this.apiEndpoint + `?text=${text}`, {});

    if (!res.ok) {
      const errorResponse = await res.json();

      throw new Error(errorResponse.error);
    }

    const data: Res = await res.json();
    return data;
  }

  async voiceChat(blob: Blob) {
    const form = new FormData();
    form.set("file", blob);

    const res = await fetch(this.apiEndpoint, {
      method: "POST",
      body: form,
    });

    if (!res.ok) {
      const errorResponse = await res.json();

      throw new Error(errorResponse.error);
    }

    const data: Res = await res.json();
    return data;
  }
}
