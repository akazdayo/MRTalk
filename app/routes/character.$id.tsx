import { LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { getCharacter } from "~/lib/api/character";
import { getFavorite } from "~/lib/api/favorite";
import { getServerSession } from "~/lib/auth/session";
import Main from "~/components/layout/main";
import CharacterDetailsContainer from "~/components/container/character/CharacterDetailsContainer";

export async function loader({ params, request }: LoaderFunctionArgs) {
  const user = await getServerSession(request.headers);

  if (!params.id) {
    return { character: null, favorite: null };
  }

  const character = await getCharacter(params.id, true);

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

  return (
    <Main>
      <CharacterDetailsContainer data={data} />
    </Main>
  );
}
