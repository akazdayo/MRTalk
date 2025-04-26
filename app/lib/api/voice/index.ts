import { prisma } from "~/lib/db/db";

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
  token: string
) {
  const form = new FormData();
  form.set("id", id);
  form.set("file", voice);
  form.set("transcript", transcript);

  const res = await fetch("http://localhost:9000/register", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: form,
  });

  if (res.ok) {
    return null;
  } else {
    throw new Error("音声の登録に失敗しました。");
  }
}

export async function unregisterVoice(id: string, token: string) {
  const form = new FormData();
  form.set("id", id);

  const res = await fetch("http://localhost:9000/unregister", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: form,
  });

  if (res.ok) {
    return null;
  } else {
    throw new Error("音声の削除に失敗しました。");
  }
}
