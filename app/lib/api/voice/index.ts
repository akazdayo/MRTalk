import { prisma } from "~/lib/db/db";
const rawTtsUrl = process.env.TTS_URL ?? "http://localhost:9000";
const TTS_URL = rawTtsUrl.startsWith("http")
  ? rawTtsUrl
  : `https://${rawTtsUrl}`;

export async function getVoice(characterId: string) {
  return await prisma.voice.findUnique({
    where: {
      characterId,
    },
  });
}

export async function registerVoice(
  id: string,
  voice: File,
  transcript: string,
  token: string,
) {
  const form = new FormData();
  form.set("id", id);
  form.set("file", voice);
  form.set("transcript", transcript);

  const res = await fetch(`${TTS_URL}/register`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: form,
  });
  const resText = await res.text();
  console.error(`[registerVoice] status: ${res.status}, body: ${resText}`);

  if (res.ok) {
    return null;
  } else {
    throw new Error("音声の登録に失敗しました。");
  }
}

export async function unregisterVoice(id: string, token: string) {
  const form = new FormData();
  form.set("id", id);

  const res = await fetch(`${TTS_URL}/unregister`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: form,
  });
  const resText = await res.text();
  console.error(`[unregisterVoice] status: ${res.status}, body: ${resText}`);

  if (res.ok) {
    return null;
  } else {
    throw new Error("音声の削除に失敗しました。");
  }
}
