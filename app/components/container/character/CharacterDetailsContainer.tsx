import { Character, Favorite } from "@prisma/client";
import { useDebouncedCallback } from "use-debounce";
import { Button } from "~/components/ui/button";
import { BoxIcon, Edit, Eye, EyeClosed, Star } from "lucide-react";
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
      <div className="flex items-center justify-between w-full space-x-2">
        <h1 className="font-bold text-3xl">{data.character.name}</h1>
        <div className="flex items-center space-x-2">
          <p>{data.character.user.name}</p>

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
      </div>
      <div className="md:flex md:space-x-4 md:space-y-0 items-center space-y-4">
        {session ? (
          <div>
            <Button
              onClick={toggleFavorite}
              className={`${isFavorite ? "bg-yellow-400" : ""}`}
            >
              <Star />
              Favorite
            </Button>
          </div>
        ) : (
          ""
        )}

        {session && session.user.id === data.character.postedBy ? (
          <div>
            <a href={`/character/edit/${data.character.id}`}>
              <Button>
                <Edit />
                編集
              </Button>
            </a>
          </div>
        ) : (
          ""
        )}

        <div>
          <a href={`/talk/${data.character.id}`}>
            <Button>
              <BoxIcon />
              MRモード(Meta Quest3が必要です)
            </Button>
          </a>
        </div>

        <div className="w-32">
          {data.character.is_public ? (
            <div className="flex items-center">
              <Eye />
              <h1>公開中</h1>
            </div>
          ) : (
            <div className="flex items-center">
              <EyeClosed />
              <h1>非公開</h1>
            </div>
          )}
        </div>
      </div>
      <p className="font-bold text-2xl">性格</p>
      <div>{data.character.personality}</div>
      <p className="font-bold text-2xl">背景ストーリー</p>
      <div>{data.character.story}</div>
    </div>
  );
}
