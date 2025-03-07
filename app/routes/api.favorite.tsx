import type { ActionFunction } from "@remix-run/node";
import { createFavorite, deleteFavorite } from "~/lib/api/favorite";
import { getServerSession } from "~/lib/auth/session";

export const action: ActionFunction = async ({ request }) => {
  const method = request.method;
  const body = await request.json();
  const user = await getServerSession(request.headers);
  if (!user) return Response.json("Unauthorized.", { status: 401 });

  try {
    switch (method) {
      case "POST": {
        const favorite = await createFavorite(user.user.id, body.characterId);
        return Response.json(favorite, { status: 201 });
      }
      case "DELETE": {
        await deleteFavorite(user.user.id, body.characterId);
        return Response.json(null);
      }
      default:
        return Response.json("Method not allowed.", { status: 405 });
    }
  } catch (e) {
    return Response.json("An error has occurred.", { status: 400 });
  }
};
