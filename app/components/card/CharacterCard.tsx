import { Card, CardContent, CardFooter } from "~/components/ui/card";
import { UserIcon } from "lucide-react";

export default function CharacterCard({
  id,
  name,
  thumbnail_url,
  postedby,
}: {
  id: string;
  name: string;
  thumbnail_url: string;
  postedby: string;
}) {
  return (
    <a href={`../character/details/${id}`}>
      <Card className="bg-background shadow-sm rounded-lg overflow-hidden">
        <CardContent className="p-0">
          <img
            src={thumbnail_url}
            alt={`${name} thumbnail`}
            width={400}
            height={400}
            className="w-full h-48 object-cover"
          />
        </CardContent>
        <CardFooter className="p-4">
          <h3 className="text-lg font-semibold">{name}</h3>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <UserIcon className="w-4 h-4" />
            <span>by {postedby}</span>
          </div>
        </CardFooter>
      </Card>
    </a>
  );
}
