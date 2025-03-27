import { Card, CardFooter, CardHeader, CardTitle } from "~/components/ui/card";
import { User } from "better-auth";
import { Avatar, AvatarImage, AvatarFallback } from "~/components/ui/avatar";

export default function CharacterCard({
  id,
  name,
  postedby,
}: {
  id: string;
  name: string;
  postedby: User;
}) {
  return (
    <div>
      <Card>
        <CardHeader className="p-4">
          <CardTitle className="text-2xl font-bold text-gray-900 truncate">
            <a href={`/character/${id}`}>{name}</a>
          </CardTitle>
        </CardHeader>

        <CardFooter className="p-4 flex items-center justify-between bg-gray-50">
          <p className="text-sm text-gray-600">by {postedby.name}</p>

          <a href={`/user/${postedby.id}`} className="flex items-center">
            <Avatar className="w-10 h-10">
              <AvatarImage src={postedby.image!} alt={postedby.name} />
              <AvatarFallback className="bg-gray-300 text-gray-700 text-lg">
                {postedby.name.toUpperCase()[0]}
              </AvatarFallback>
            </Avatar>
          </a>
        </CardFooter>
      </Card>
    </div>
  );
}
