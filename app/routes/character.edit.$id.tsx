import { LoaderFunctionArgs } from "@remix-run/node";
import { redirect, useLoaderData } from "@remix-run/react";
import EditCharacterContainer from "~/components/container/character/EditCharacterContainer";
import { getCharacter } from "~/lib/api/character";
import { getServerSession } from "~/lib/auth/session";
import Main from "~/components/layout/main";

export async function loader({ params, request }: LoaderFunctionArgs) {
  const user = await getServerSession(request.headers);
  if (!user) return redirect("/login");

  if (!params.id) return redirect("/");

  const character = await getCharacter(params.id, false);

  if (!character) return redirect("/");

  if (user.user.id !== character.postedBy) {
    return redirect("/");
  }

  return character;
}

export default function CharacterDetails() {
  const character = useLoaderData<typeof loader>();

  return (
    <Main>
      <EditCharacterContainer character={character} />
    </Main>
  );
}
