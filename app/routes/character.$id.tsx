import { LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { getCharacter } from "~/lib/api/character";
import { getFavorite } from "~/lib/api/favorite";
import { getServerSession } from "~/lib/auth/session";
import Main from "~/components/layout/main";
import CharacterDetailsContainer from "~/components/container/character/CharacterDetailsContainer";

export async function loader({ params, request }: LoaderFunctionArgs) {
  const session = await getServerSession(request.headers);

  if (!params.id) {
    return null;
  }

  const character = await getCharacter(params.id, true);
  if (!character) return null;

  let favorite = null;
  if (session) {
    favorite = await getFavorite(session.user.id, params.id);
  }

  return {
    character,
    favorite,
  };
}

export default function CharacterDetails() {
  const data = useLoaderData<typeof loader>();

  if (data)
    return (
      <Main>
        <CharacterDetailsContainer data={data} />
      </Main>
    );

  return <Main>キャラクターが見つかりませんでした。</Main>;
}
