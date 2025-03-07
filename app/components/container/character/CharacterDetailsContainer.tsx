import { Character, Favorite } from "@prisma/client";
import { useDebouncedCallback } from "use-debounce";
import { Button } from "~/components/ui/button";
import { Edit, Star } from "lucide-react";
import { useState } from "react";
import { Avatar, AvatarImage, AvatarFallback } from "~/components/ui/avatar";
import { Session, User } from "better-auth";
import { useOutletContext } from "@remix-run/react";

export default function CharacterDetailsContainer({
  data,
}: {
  data: {
    character: (Character & { user: User }) | null;
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
      await fetch("/api/favorite/", {
        method: "DELETE",
        body: JSON.stringify({ characterId: data.character.id }),
      });
    } else {
      await fetch("/api/favorite/", {
        method: "POST",
        body: JSON.stringify({ characterId: data.character.id }),
      });
    }
  }, 500);

  if (!data.character) {
    return <div>キャラクターが見つかりませんでした。</div>;
  }

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

        <p>{data.character.user.name}が投稿</p>

        <Avatar>
          <AvatarImage
            src={data.character.user.image!}
            alt={data.character.user.name}
          />
          <AvatarFallback>
            {data.character.user.name.toUpperCase()[0]}
          </AvatarFallback>
        </Avatar>
      </div>
      <p>性格</p>
      <div>{data.character.personality}</div>
      <p>背景ストーリー</p>
      <div>{data.character.story}</div>
    </div>
  );
}
