import { User } from "@prisma/client";
import { Avatar, AvatarImage, AvatarFallback } from "../ui/avatar";
import { Card, CardHeader } from "../ui/card";

export default function ProfileContainer({ user }: { user: User }) {
  return (
    <div className="container mx-auto px-4 py-8">
      <Card className="mx-auto max-w-md">
        <CardHeader className="flex flex-col items-center space-y-4">
          <Avatar className="h-24 w-24">
            <AvatarImage src={user.image!} alt={user.name} />
            <AvatarFallback>{user.name.toUpperCase()[0]}</AvatarFallback>
          </Avatar>
          <div className="text-center">
            <h1 className="text-2xl font-bold">{user.name}</h1>
          </div>
        </CardHeader>
      </Card>
    </div>
  );
}
