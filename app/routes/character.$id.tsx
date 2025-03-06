import { LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { useState } from "react";
import Main from "~/components/layout/main";
import { getCharacter } from "~/lib/api/character";
import { getFavorite } from "~/lib/api/favorite";
import { getServerSession } from "~/lib/auth/session";
import { useDebouncedCallback } from "use-debounce";
import { Button } from "~/components/ui/button";
import { Star } from "lucide-react";

export async function loader({ params, request }: LoaderFunctionArgs) {
  const user = await getServerSession(request.headers);

  if (!params.id) {
    return { character: null, favorite: false };
  }

  const character = await getCharacter(params.id);

  let favorite = null;

  if (user) {
    favorite = await getFavorite(user.user.id, params.id);
  }

  return {
    character,
    favorite,
  };
}

export default function CharacterDetails() {
  const data = useLoaderData<typeof loader>();
  const [isFavorite, setIsFavorite] = useState(data.favorite ? true : false);

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
    return <Main>キャラクターが見つかりませんでした。</Main>;
  }

  return (
    <Main>
      <h1>{data.character.name}</h1>
      <div>
        <Button
          onClick={toggleFavorite}
          className={`${isFavorite ? "bg-yellow-400" : ""}`}
        >
          <Star />
          Favorite
        </Button>
      </div>
    </Main>
  );
}
