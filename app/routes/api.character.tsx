import type { ActionFunction } from "@remix-run/node";
import {
  createCharacter,
  updateCharacter,
  deleteCharacter,
  checkPermission,
  getCharacter,
} from "~/lib/api/character";
import { getServerSession } from "~/lib/auth/session";
import {
  CreateCharacterSchema,
  DeleteCharacterSchema,
  UpdateCharacterSchema,
} from "~/lib/api/character/schema";
import { getErrorMessages } from "~/utils/zod/getErrorMessages";
import { deleteFile, uploadFile } from "~/lib/api/storage";

export const action: ActionFunction = async ({ request }) => {
  const method = request.method;
  const session = await getServerSession(request.headers);

  if (!session)
    return Response.json({ error: "Unauthorized." }, { status: 401 });

  try {
    switch (method) {
      case "POST": {
        const body = await request.formData();

        const parsed = CreateCharacterSchema.safeParse(
          Object.fromEntries(body)
        );

        if (!parsed.success) {
          return Response.json(
            {
              error: getErrorMessages(parsed.error.flatten().fieldErrors),
            },
            { status: 400 }
          );
        }

        const { name, personality, story, model } = parsed.data;

        const model_url = await uploadFile(model);

        const character = await createCharacter({
          name,
          personality,
          story,
          model_url,
          postedBy: session.user.id,
        });
        return Response.json(character, { status: 201 });
      }
      case "PUT": {
        const body = await request.formData();

        const parsed = UpdateCharacterSchema.safeParse(
          Object.fromEntries(body)
        );
        if (!parsed.success) {
          console.log(parsed.error.message);
          return Response.json(
            {
              error: getErrorMessages(parsed.error.flatten().fieldErrors),
            },
            { status: 400 }
          );
        }

        const { id, name, personality, story } = parsed.data;

        const permission = await checkPermission(id, session.user.id);

        if (!permission) {
          return Response.json(
            {
              error: "You do not have permission to control this character.",
            },
            { status: 400 }
          );
        } else {
          const character = await updateCharacter({
            id,
            name,
            personality,
            story,
          });
          return Response.json(character);
        }

        break;
      }
      case "DELETE": {
        const body = await request.json();

        const parsed = DeleteCharacterSchema.safeParse(body);
        if (!parsed.success) {
          return Response.json(
            {
              error: getErrorMessages(parsed.error.flatten().fieldErrors),
            },
            { status: 400 }
          );
        }

        const { id } = parsed.data;

        const permission = await checkPermission(id, session.user.id);

        if (!permission) {
          return Response.json(
            {
              error: "You do not have permission to control this character.",
            },
            { status: 400 }
          );
        } else {
          const character = await getCharacter(id, false);

          if (character) {
            await deleteFile(character.model_url);
            await deleteCharacter(id);
          }

          return Response.json(null);
        }

        break;
      }
      default:
        return Response.json({ error: "Method not allowed." }, { status: 405 });
    }
  } catch (e) {
    return Response.json({ error: "An error has occurred." }, { status: 500 });
  }
};
