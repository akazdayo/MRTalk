import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Form, useNavigate } from "@remix-run/react";
import { PlusIcon } from "lucide-react";
import { FormEvent, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Checkbox } from "~/components/ui/checkbox";

export default function AddCharacterContainer() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setIsLoading(true);

    const formData = new FormData(event.target as HTMLFormElement);
    console.log("[AddCharacter] Request FormData:", Array.from(formData.entries()));

    const res = await fetch("/api/character/", {
      method: "POST",
      body: formData,
    });
    console.log("[AddCharacter] Response status:", res.status);

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

  return (
    <div>
      <h1 className="font-bold text-3xl text-center">キャラクターを投稿</h1>

      <Form className="py-10 space-y-6" onSubmit={onSubmit}>
        <div>
          <label htmlFor="isPublic">キャラクターを公開する</label>
          <Checkbox name="isPublic" id="isPublic" className="block my-2" />
        </div>

        <div>
          <label htmlFor="name">キャラクター名</label>
          <Input type="text" name="name" id="name" required />
        </div>

        <div>
          <label htmlFor="model">
            VRMモデル(VRM 1.xのモデルにのみ対応しています。)
          </label>
          <Input type="file" name="model" id="model" accept=".vrm" required />
        </div>

        <div>
          <label htmlFor="personality">人格、性格など</label>
          <textarea
            name="personality"
            id="personality"
            className="h-36 bg-transparent text-sm w-full px-3 py-2 border rounded-md"
            required
          />
        </div>

        <div>
          <label htmlFor="story">背景ストーリーなど</label>
          <textarea
            name="story"
            id="story"
            className="h-36 bg-transparent text-sm w-full px-3 py-2 border rounded-md"
            required
          />
        </div>

        <div>
          <label htmlFor="voice">
            キャラクターのボイスサンプル(3~10秒ほど)
          </label>
          <Input
            type="file"
            name="voice"
            id="voice"
            accept="audio/wav"
            required
          />
        </div>

        <div>
          <label htmlFor="transcript">ボイスサンプルの書き起こし</label>
          <Input type="text" name="transcript" id="transcript" required />
        </div>

        <Button type="submit" className="bg-green-500 text-black my-12">
          <PlusIcon />
          投稿する
        </Button>
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
