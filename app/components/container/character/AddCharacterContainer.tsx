import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { Form } from "@remix-run/react";
import { PlusIcon } from "lucide-react";
import { FormEvent } from "react";

export default function AddCharacterContainer() {
  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const formData = new FormData(event.target as HTMLFormElement);
    const name = formData.get("name") as string;
    const model_url = formData.get("model_url") as string;
    const personality = formData.get("personality") as string;
    const story = formData.get("story") as string;

    await fetch("/api/character/", {
      method: "POST",
      body: JSON.stringify({ name, model_url, personality, story }),
    });
  };

  return (
    <div>
      <h1 className="font-bold text-3xl text-center">キャラクターを投稿</h1>

      <Form
        method="post"
        className="py-10 space-y-6"
        encType="multipart/form-data"
        onSubmit={onSubmit}
      >
        <div>
          <label htmlFor="name">キャラクター名</label>
          <Input type="text" name="name" id="name" required />
        </div>

        <div>
          <label htmlFor="model_url">モデルURL</label>
          <Input type="text" name="model_url" id="model_url" required />
        </div>

        <div>
          <label htmlFor="personality">人格、性格など</label>
          <Textarea name="personality" id="personality" className="h-36" />
        </div>

        <div>
          <label htmlFor="story">背景ストーリーなど</label>
          <Textarea name="story" id="story" className="h-36" />
        </div>

        <Button type="submit" className="bg-green-500 text-black my-12">
          <PlusIcon />
          投稿する
        </Button>
      </Form>
    </div>
  );
}
