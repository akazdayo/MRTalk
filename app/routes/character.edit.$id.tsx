import { LoaderFunctionArgs } from "@remix-run/node";
import { redirect, useLoaderData } from "@remix-run/react";
import EditCharacterContainer from "~/components/container/character/EditCharacterContainer";
import { getCharacter } from "~/lib/api/character";
import { getServerSession } from "~/lib/auth/session";
import Main from "~/components/layout/main";

export async function loader({ params, request }: LoaderFunctionArgs) {
  const session = await getServerSession(request.headers);
  if (!session) return redirect("/login");

  if (!params.id) return null;

  const character = await getCharacter(params.id, session, false);
  if (!character) return null;

  if (session.user.id !== character.postedBy) {
    return redirect("/");
  }

  return character;
}

export default function CharacterDetails() {
  const character = useLoaderData<typeof loader>();

  if (character)
    return (
      <Main>
        <EditCharacterContainer character={character} />
      </Main>
    );

  return <Main>キャラクターが見つかりませんでした。</Main>;
}
