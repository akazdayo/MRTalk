import { Character } from "@prisma/client";
import { Form, useNavigate } from "@remix-run/react";
import { SaveIcon, TrashIcon } from "lucide-react";
import { FormEvent, useState } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { toast } from "sonner";

export default function EditCharacterContainer({
  character,
}: {
  character: Character;
}) {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();

    setIsLoading(true);

    const formData = new FormData(event.target as HTMLFormElement);
    formData.set("id", character.id);

    const res = await fetch("/api/character/", {
      method: "PUT",
      body: formData,
    });

    if (!res.ok) {
      const error = await res.json();
      toast(error.error);
      setIsLoading(false);
    } else {
      const json = await res.json();
      setIsLoading(false);
      navigate(`/character/${json.id}`);
    }
  };

  const onDelete = async () => {
    setIsLoading(true);

    const res = await fetch("/api/character/", {
      method: "DELETE",
      body: JSON.stringify({
        id: character.id,
      }),
    });

    if (!res.ok) {
      const error = await res.json();
      toast(error.error);
      setIsLoading(false);
    } else {
      setIsLoading(false);
      navigate(`/`);
    }
  };

  return (
    <div>
      <h1 className="font-bold text-3xl text-center">
        {character.name}の情報を編集
      </h1>
      <Form className="py-10 space-y-6" onSubmit={onSubmit}>
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
          <label htmlFor="personality">人格、性格など</label>
          <textarea
            name="personality"
            id="personality"
            className="h-36 bg-transparent text-sm w-full px-3 py-2 border rounded-md"
            defaultValue={character.personality}
            required
          />
        </div>

        <div>
          <label htmlFor="story">背景ストーリーなど</label>
          <textarea
            name="story"
            id="story"
            className="h-36 bg-transparent text-sm w-full px-3 py-2 border rounded-md"
            defaultValue={character.story}
            required
          />
        </div>

        <div className="flex justify-between">
          <Button type="submit" className="bg-blue-500 text-white">
            <SaveIcon className="mr-2" />
            更新する
          </Button>

          <Dialog>
            <DialogTrigger asChild>
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

      {isLoading ? (
        <Dialog open={true}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Loading...</DialogTitle>
            </DialogHeader>
          </DialogContent>
        </Dialog>
      ) : (
        ""
      )}
    </div>
  );
}
