export async function registerVoice(
  id: string,
  voice: File,
  transcript: string
) {
  const form = new FormData();
  form.set("id", id);
  form.set("file", voice);
  form.set("transcript", transcript);

  const res = await fetch("http://localhost:9000/register", {
    method: "POST",
    body: form,
  });

  if (res.ok) {
    return null;
  } else {
    throw new Error("音声の登録に失敗しました。");
  }
}
