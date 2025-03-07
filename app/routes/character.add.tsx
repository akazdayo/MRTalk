import Main from "~/components/layout/main";
import AddCharacterContainer from "~/components/container/character/AddCharacterContainer";
import { LoaderFunctionArgs, redirect } from "@remix-run/node";
import { getServerSession } from "~/lib/auth/session";

export async function loader({ request }: LoaderFunctionArgs) {
  const session = await getServerSession(request.headers);

  if (!session) return redirect("/login");

  return null;
}

export default function AddCharacter() {
  return (
    <Main>
      <AddCharacterContainer />
    </Main>
  );
}
