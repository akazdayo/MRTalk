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
    <div className="min-w-44">
      <a href={`/character/${id}`}>
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl font-bold">{name}</CardTitle>
          </CardHeader>

          <CardFooter>
            <div>
              <p>by {postedby.name}</p>
            </div>

            <div>
              <Avatar>
                <AvatarImage src={postedby.image!} alt={postedby.name} />
                <AvatarFallback>
                  {postedby.name.toUpperCase()[0]}
                </AvatarFallback>
              </Avatar>
            </div>
          </CardFooter>
        </Card>
      </a>
    </div>
  );
}
