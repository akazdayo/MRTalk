import Main from "~/components/layout/main";
import { Button } from "~/components/ui/button";
import { signIn } from "~/lib/auth/google";

export default function Login() {
  return (
    <Main>
      <p className="text-3xl font-bold py-12 text-center">MRTalkにログイン</p>

      <Button onClick={signIn}>Login with Google</Button>
    </Main>
  );
}
