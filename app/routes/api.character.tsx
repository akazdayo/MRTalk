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
  UpdateCharacterSchema,
} from "~/lib/api/character/schema";
import { getErrorMessages } from "~/utils/zod/getErrorMessages";
import { deleteFile, uploadFile } from "~/lib/api/storage";
import { CharacterIdSchema } from "~/lib/api/favorite/schema";
import { getVoice, registerVoice, unregisterVoice } from "~/lib/api/voice";

export const action: ActionFunction = async ({ request }) => {
  const method = request.method;
  const session = await getServerSession(request.headers);

  if (!session)
    return Response.json({ error: "Unauthorized." }, { status: 401 });

  try {
    switch (method) {
      case "POST": {
        const body = await request.formData();

        //bodyをバリデーション
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

        const { isPublic, name, personality, story, model, voice, transcript } =
          parsed.data;

        const modelUrl = await uploadFile(model);

        //キャラクターを作成
        const character = await createCharacter({
          name,
          personality,
          story,
          modelUrl,
          isPublic,
          postedBy: session.user.id,
        });

        await registerVoice(
          character.id,
          voice,
          transcript,
          session.session.token
        );

        return Response.json(character, { status: 201 });
      }
      case "PUT": {
        const body = await request.formData();

        //bodyをバリデーション
        const parsed = UpdateCharacterSchema.safeParse(
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

        const { id, isPublic, name, personality, story } = parsed.data;

        //自分の投稿したものかチェック
        const permission = await checkPermission(id, session);

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
            isPublic,
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

        //bodyをバリデーション
        const parsed = CharacterIdSchema.safeParse(body);
        if (!parsed.success) {
          return Response.json(
            {
              error: getErrorMessages(parsed.error.flatten().fieldErrors),
            },
            { status: 400 }
          );
        }

        const { characterId } = parsed.data;

        //自分の投稿したものかチェック
        const permission = await checkPermission(characterId, session);

        if (!permission) {
          return Response.json(
            {
              error: "You do not have permission to control this character.",
            },
            { status: 400 }
          );
        } else {
          const character = await getCharacter(characterId, session, false);
          const voice = await getVoice(characterId);

          if (character && voice) {
            await deleteFile(character.modelUrl);
            await unregisterVoice(voice.id, session.session.token);
            await deleteCharacter(characterId);
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
