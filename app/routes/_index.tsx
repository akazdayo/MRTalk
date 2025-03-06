import { type LoaderFunctionArgs, type MetaFunction } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import HomeContainer from "~/components/container/HomeContainer";
import { getServerSession } from "~/lib/auth/session";

export const meta: MetaFunction = () => {
  return [
    { title: "New Remix App" },
    { name: "description", content: "Welcome to Remix!" },
  ];
};

export async function loader({ request }: LoaderFunctionArgs) {
  const headers = request.headers;

  const session = await getServerSession(headers);

  if (session) {
    return session;
  }

  return null;
}

export default function Index() {
  const session = useLoaderData<typeof loader>();

  return <HomeContainer session={session} />;
}
