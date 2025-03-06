import { LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import ProfileContainer from "~/components/container/ProfileContainer";
import Main from "~/components/layout/main";
import { prisma } from "~/lib/db/db";

export async function loader({ params }: LoaderFunctionArgs) {
  const id = params.id;

  const profile = await prisma.user.findUnique({ where: { id } });

  return profile;
}

export default function UserProfile() {
  const profile = useLoaderData<typeof loader>();

  if (profile)
    return (
      <Main>
        <ProfileContainer user={profile} />
      </Main>
    );

  return <Main>ユーザーが見つかりませんでした。</Main>;
}
