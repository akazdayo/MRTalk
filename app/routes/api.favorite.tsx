import type { ActionFunction } from "@remix-run/node";
import { createFavorite, deleteFavorite } from "~/lib/api/favorite";
import { FavoriteSchema } from "~/lib/api/favorite/schema";
import { getServerSession } from "~/lib/auth/session";
import { getErrorMessages } from "~/utils/zod/getErrorMessages";

export const action: ActionFunction = async ({ request }) => {
  const method = request.method;
  const body = await request.json();
  const user = await getServerSession(request.headers);

  if (!user) return Response.json({ error: "Unauthorized." }, { status: 401 });

  try {
    switch (method) {
      case "POST": {
        const parsed = FavoriteSchema.safeParse(body);

        if (!parsed.success) {
          return Response.json(
            {
              error: getErrorMessages(parsed.error.flatten().fieldErrors),
            },
            { status: 400 }
          );
        }

        const { characterId } = parsed.data;
        const favorite = await createFavorite(user.user.id, characterId);
        return Response.json(favorite, { status: 201 });
      }

      case "DELETE": {
        const parsed = FavoriteSchema.safeParse(body);
        if (!parsed.success) {
          return Response.json(
            {
              error: getErrorMessages(parsed.error.flatten().fieldErrors),
            },
            { status: 400 }
          );
        }

        const { characterId } = parsed.data;
        await deleteFavorite(user.user.id, characterId);
        return Response.json(null);
      }
      default:
        return Response.json({ error: "Method not allowed." }, { status: 405 });
    }
  } catch (e) {
    return Response.json({ error: "An error has occurred." }, { status: 500 });
  }
};
