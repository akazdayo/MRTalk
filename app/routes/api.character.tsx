import type { ActionFunction } from "@remix-run/node";
import {
  createCharacter,
  updateCharacter,
  deleteCharacter,
} from "~/lib/api/character";
import { getServerSession } from "~/lib/auth/session";
import {
  CreateCharacterSchema,
  DeleteCharacterSchema,
  UpdateCharacterSchema,
} from "~/lib/api/character/schema";
import { getErrorMessages } from "~/utils/zod/getErrorMessages";

export const action: ActionFunction = async ({ request }) => {
  const method = request.method;
  const body = await request.json();
  const user = await getServerSession(request.headers);

  if (!user) return Response.json({ error: "Unauthorized." }, { status: 401 });

  try {
    switch (method) {
      case "POST": {
        const parsed = CreateCharacterSchema.safeParse(body);
        if (!parsed.success) {
          return Response.json(
            {
              error: getErrorMessages(parsed.error.flatten().fieldErrors),
            },
            { status: 400 }
          );
        }

        const { name, personality, story, model_url } = parsed.data;
        const character = await createCharacter({
          name,
          personality,
          story,
          model_url,
          postedBy: user.user.id,
        });
        return Response.json(character, { status: 201 });
      }
      case "PUT": {
        const parsed = UpdateCharacterSchema.safeParse(body);
        if (!parsed.success) {
          return Response.json(
            {
              error: getErrorMessages(parsed.error.flatten().fieldErrors),
            },
            { status: 400 }
          );
        }

        const { id, name, personality, story, model_url } = parsed.data;
        const character = await updateCharacter(
          {
            id,
            name,
            personality,
            story,
            model_url,
          },
          user.user.id
        );
        return Response.json(character);
      }
      case "DELETE": {
        const parsed = DeleteCharacterSchema.safeParse(body);
        if (!parsed.success) {
          return Response.json(
            {
              error: getErrorMessages(parsed.error.flatten().fieldErrors),
            },
            { status: 400 }
          );
        }

        await deleteCharacter(parsed.data.id, user.user.id);
        return Response.json(null);
      }
      default:
        return Response.json({ error: "Method not allowed." }, { status: 405 });
    }
  } catch (e) {
    switch (e) {
      case e === "Character not found.":
        return Response.json({ error: e }, { status: 400 });
      case e ===
        "The requesting user does not have permission to edit the character.":
        return Response.json({ error: e }, { status: 403 });
      default:
        return Response.json(
          { error: "An error has occurred." },
          { status: 500 }
        );
    }
  }
};
