import { useNavigate } from "@remix-run/react";
import Main from "~/components/layout/main";
import { Button } from "~/components/ui/button";
import { signOut } from "~/lib/auth/google";

export default function HomeContainer({ session }: { session: any }) {
  const navigate = useNavigate();

  return (
    <Main>
      {session !== null ? (
        <div className="space-y-6">
          <p>{session.user.name}さん、ようこそ</p>
          <Button onClick={() => signOut(navigate)}>Sign out</Button>
        </div>
      ) : (
        ""
      )}
    </Main>
  );
}
