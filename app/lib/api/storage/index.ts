import { put, del } from "@vercel/blob";

export const uploadFile = async (file: File) => {
  const blob = await put(file.name, file, { access: "public" });

  return blob.downloadUrl;
};

export const deleteFile = async (url: string) => {
  await del(url);
};
