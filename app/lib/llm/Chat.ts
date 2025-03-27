import { z } from "zod";
import { ResponseSchema } from "./schema";

export type Res = z.infer<typeof ResponseSchema>;

export class Chat {
  private apiEndpoint: string;

  constructor(characterId: string) {
    this.apiEndpoint = `/api/chat/${characterId}`;
  }

  async chat(text: string) {
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
