import { Box, LogIn, PersonStanding, PlusIcon } from "lucide-react";
import { Button } from "~/components/ui/button";
import { ChatBubbleIcon } from "@radix-ui/react-icons";
import FeatureCard from "../card/FeatureCard";
import { useOutletContext } from "@remix-run/react";
import { Session, User } from "better-auth";

export default function HomeContainer() {
  const { session } = useOutletContext<{
    session: { user: User; session: Session };
  }>();

  return (
    <div>
      <div className="grid md:grid-cols-2 gap-12 items-center">
        <div className="space-y-6">
          <h1 className="text-5xl font-bold tracking-tight">MRTalk</h1>

          <div className="flex flex-wrap gap-4">
            <div>
              <a href="/character/add">
                <Button variant="default">
                  <PlusIcon className="w-4 h-4 mr-2" />
                  キャラクターを追加
                </Button>
              </a>
            </div>

            {session ? (
              <div>
                <a href={`/user/${session.user.id}`}>
                  <Button variant="outline">
                    <Box className="w-4 h-4 mr-2" />
                    キャラクターを選択
                  </Button>
                </a>
              </div>
            ) : (
              ""
            )}
          </div>
        </div>

        <div className="relative">
          <img
            src="img/demo.png"
            alt="MR character visualization"
            className="w-full rounded-lg shadow-md"
          />
        </div>
      </div>

      <div className="py-12">
        <h2 className="text-2xl font-semibold text-center mb-10">
          3ステップで簡単に開始
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <FeatureCard
            step="1"
            title="Googleアカウントでログイン"
            icon={<LogIn className="w-8 h-8" />}
          />
          <FeatureCard
            step="2"
            title="キャラクターを選択"
            icon={<PersonStanding className="w-8 h-8" />}
          />
          <FeatureCard
            step="3"
            title="MRでキャラクターと会話"
            icon={<ChatBubbleIcon className="w-8 h-8" />}
          />
        </div>
      </div>
    </div>
  );
}
