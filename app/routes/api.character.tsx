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
import { registerVoice } from "~/lib/api/voice/register";
import { randomUUID } from "node:crypto";

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

        const id = randomUUID();

        const { isPublic, name, personality, story, model, voice, transcript } =
          parsed.data;

        //音声とモデルをアップロード
        await registerVoice(id, voice, transcript);
        const model_url = await uploadFile(model);

        //キャラクターを作成
        const character = await createCharacter({
          id,
          name,
          personality,
          story,
          model_url,
          is_public: isPublic,
          postedBy: session.user.id,
        });

        return Response.json(character, { status: 201 });
      }
      case "PUT": {
        const body = await request.formData();

        //bodyをバリデーション
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
            is_public: isPublic,
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

          if (character) {
            await deleteFile(character.model_url);
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
    console.log(e);
    return Response.json({ error: "An error has occurred." }, { status: 500 });
  }
};
