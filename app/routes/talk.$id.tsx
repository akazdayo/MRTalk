import { LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import TalkSceneContainer from "~/components/container/TalkSceneContainer";
import Main from "~/components/layout/main";
import { getCharacter } from "~/lib/api/character";
import { getServerSession } from "~/lib/auth/session";

export async function loader({ params, request }: LoaderFunctionArgs) {
  const id = params.id;
  const session = await getServerSession(request.headers);

  if (id) {
    try {
      const character = getCharacter(id, session, false);

      return character;
    } catch (e) {
      return null;
    }
  }

  return null;
}

export default function TalkScene() {
  const character = useLoaderData<typeof loader>();

  if (character) return <TalkSceneContainer character={character} />;

  return (
    <Main>
      <h1>idを指定してください！</h1>
    </Main>
  );
}
