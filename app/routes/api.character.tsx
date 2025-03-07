import type { ActionFunction } from "@remix-run/node";
import {
  createCharacter,
  updateCharacter,
  deleteCharacter,
} from "~/lib/api/character";
import { getServerSession } from "~/lib/auth/session";

export const action: ActionFunction = async ({ request }) => {
  const method = request.method;
  const body = await request.json();
  const user = await getServerSession(request.headers);

  if (!user) return Response.json("Unauthorized", { status: 401 });

  try {
    switch (method) {
      case "POST": {
        const character = await createCharacter({
          name: body.name,
          personality: body.personality,
          story: body.story,
          model_url: body.model_url,
          postedBy: user.user.id,
        });
        return Response.json(character, { status: 201 });
      }
      case "PUT": {
        const character = await updateCharacter(
          {
            id: body.id,
            name: body.name,
            personality: body.personality,
            story: body.story,
            model_url: body.model_url,
          },
          user.user.id
        );
        return Response.json(character);
      }
      case "DELETE": {
        await deleteCharacter(body.id, user.user.id);
        return Response.json(null);
      }
      default:
        return Response.json("Method not allowed.", { status: 405 });
    }
  } catch (e) {
    const message =
      e === "Character not found." || e === "Unauthorized."
        ? e
        : "An error has occurred.";

    return Response.json(message, { status: 400 });
  }
};
