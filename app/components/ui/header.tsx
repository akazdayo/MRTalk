import { useNavigate, useOutletContext } from "@remix-run/react";
import { Avatar, AvatarImage, AvatarFallback } from "./avatar";
import { Button } from "./button";
import { BoxIcon, LogIn, LogOutIcon, PlusIcon } from "lucide-react";
import { Session, User } from "better-auth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { signOut } from "~/lib/auth/google";

export default function Header({ siteName = "MRTalk" }: { siteName?: string }) {
  const navigate = useNavigate();

  const { session } = useOutletContext<{
    session: { user: User; session: Session };
  }>();

  return (
    <header className="w-full border-b bg-white">
      <div className="container mx-auto flex items-center justify-between px-4 py-3">
        <a className="flex items-center" href="/">
          <h1 className="text-xl font-bold text-primary">{siteName}</h1>
        </a>

        <div className="flex items-center space-x-3">
          {session ? (
            <div className="flex items-center space-x-2">
              <span className="hidden md:inline text-sm text-gray-700">
                {session.user.name}
              </span>
              <DropdownMenu>
                <DropdownMenuTrigger>
                  <Avatar className="h-9 w-9 cursor-pointer hover:ring-2 hover:ring-primary transition">
                    <AvatarImage src={session.user.image!} />
                    <AvatarFallback>
                      {session.user.name.toUpperCase()[0]}
                    </AvatarFallback>
                  </Avatar>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <a href={`/user/${session.user.id}`}>
                    <DropdownMenuItem>
                      <BoxIcon />
                      マイキャラクター
                    </DropdownMenuItem>
                  </a>
                  <a href={`/character/add`}>
                    <DropdownMenuItem>
                      <PlusIcon />
                      キャラクターを投稿
                    </DropdownMenuItem>
                  </a>
                  <DropdownMenuItem onClick={() => signOut(navigate)}>
                    <LogOutIcon />
                    ログアウト
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : (
            <a href="/login">
              <Button className="flex items-center space-x-1 px-4 py-2">
                <LogIn className="h-4 w-4 mr-2" />
                <span>ログイン</span>
              </Button>
            </a>
          )}
        </div>
      </div>
    </header>
  );
}
