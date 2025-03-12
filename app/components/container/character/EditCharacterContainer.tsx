import { Character } from "@prisma/client";
import { Form, useNavigate } from "@remix-run/react";
import { SaveIcon, TrashIcon } from "lucide-react";
import { FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";

export default function EditCharacterContainer({
  character,
}: {
  character: Character;
}) {
  const navigate = useNavigate();

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const formData = new FormData(event.target as HTMLFormElement);
    const name = formData.get("name") as string;
    const model_url = formData.get("model_url") as string;
    const personality = formData.get("personality") as string;
    const story = formData.get("story") as string;

    const res = await fetch("/api/character/", {
      method: "PUT",
      body: JSON.stringify({
        id: character.id,
        name,
        model_url,
        personality,
        story,
      }),
    });

    if (!res.ok) {
      toast("エラーが発生しました。", { className: "bg-red-500" });
    }

    navigate(`/character/${character.id}`);
  };

  const onDelete = async () => {
    const res = await fetch("/api/character/", {
      method: "DELETE",
      body: JSON.stringify({
        id: character.id,
      }),
    });

    if (!res.ok) {
      toast("エラーが発生しました。", { className: "bg-red-500" });
    }

    navigate(`/`);
  };

  return (
    <div>
      <h1 className="font-bold text-3xl text-center">
        {character.name}の情報を編集
      </h1>
      <Form
        method="post"
        className="py-10 space-y-6"
        encType="multipart/form-data"
        onSubmit={onSubmit}
      >
        <div>
          <label htmlFor="name">キャラクター名</label>
          <Input
            type="text"
            name="name"
            id="name"
            defaultValue={character.name}
            required
          />
        </div>
        <div>
          <label htmlFor="model_url">モデルURL</label>
          <Input
            type="text"
            name="model_url"
            id="model_url"
            defaultValue={character.model_url}
            required
          />
        </div>
        <div>
          <label htmlFor="personality">人格、性格など</label>
          <Textarea
            name="personality"
            id="personality"
            className="h-36"
            defaultValue={character.personality}
          />
        </div>
        <div>
          <label htmlFor="story">背景ストーリーなど</label>
          <Textarea
            name="story"
            id="story"
            className="h-36"
            defaultValue={character.story}
          />
        </div>
        <div className="flex justify-between">
          <Button type="submit" className="bg-blue-500 text-white">
            <SaveIcon className="mr-2" />
            更新する
          </Button>

          <Dialog>
            <DialogTrigger>
              <Button type="button" className="bg-red-600 text-white">
                <TrashIcon className="mr-2" />
                削除する
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>本当に削除しますか?</DialogTitle>
              </DialogHeader>
              <DialogFooter className="sm:justify-start">
                <DialogClose asChild>
                  <Button
                    type="button"
                    className="bg-red-600 text-white"
                    onClick={onDelete}
                  >
                    <TrashIcon className="mr-2" />
                    削除する
                  </Button>
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </Form>
    </div>
  );
}
