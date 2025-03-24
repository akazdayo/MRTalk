import { Character, Favorite } from "@prisma/client";
import { useDebouncedCallback } from "use-debounce";
import { Button } from "~/components/ui/button";
import { BoxIcon, Edit, Star } from "lucide-react";
import { useState } from "react";
import { Avatar, AvatarImage, AvatarFallback } from "~/components/ui/avatar";
import { Session, User } from "better-auth";
import { useOutletContext } from "@remix-run/react";
import { toast } from "sonner";

export default function CharacterDetailsContainer({
  data,
}: {
  data: {
    character: Character & { user: User };
    favorite: Favorite | null;
  };
}) {
  const [isFavorite, setIsFavorite] = useState(data.favorite ? true : false);

  const { session } = useOutletContext<{
    session: { user: User; session: Session };
  }>();

  const toggleFavorite = useDebouncedCallback(async () => {
    if (!data.character) return;

    setIsFavorite(!isFavorite);

    if (isFavorite) {
      const res = await fetch("/api/favorite/", {
        method: "DELETE",
        body: JSON.stringify({ characterId: data.character.id }),
      });

      if (!res.ok) {
        const error = await res.json();
        toast(error.error);

        //エラーが発生したら表示も元に戻す
        setIsFavorite(!isFavorite);
      }
    } else {
      const res = await fetch("/api/favorite/", {
        method: "POST",
        body: JSON.stringify({ characterId: data.character.id }),
      });

      if (!res.ok) {
        const error = await res.json();
        toast(error.error);

        //エラーが発生したら表示も元に戻す
        setIsFavorite(!isFavorite);
      }
    }
  }, 500);

  return (
    <div className="space-y-4">
      <h1 className="font-bold text-3xl">{data.character.name}</h1>
      <div className="flex space-x-4 items-center">
        {session ? (
          <Button
            onClick={toggleFavorite}
            className={`${isFavorite ? "bg-yellow-400" : ""}`}
          >
            <Star />
            Favorite
          </Button>
        ) : (
          ""
        )}

        {session && session.user.id === data.character.postedBy ? (
          <a href={`/character/edit/${data.character.id}`}>
            <Button>
              <Edit />
              編集
            </Button>
          </a>
        ) : (
          ""
        )}

        <a href={`/talk/${data.character.id}`}>
          <Button>
            <BoxIcon />
            MRモード(Meta Quest3が必要です)
          </Button>
        </a>

        <p>{data.character.user.name}が投稿</p>

        <a href={`/user/${data.character.user.id}`}>
          <Avatar>
            <AvatarImage
              src={data.character.user.image!}
              alt={data.character.user.name}
            />
            <AvatarFallback>
              {data.character.user.name.toUpperCase()[0]}
            </AvatarFallback>
          </Avatar>
        </a>
      </div>
      <p>性格</p>
      <div>{data.character.personality}</div>
      <p>背景ストーリー</p>
      <div>{data.character.story}</div>
    </div>
  );
}
