import { ActionFunctionArgs } from "@remix-run/node";
import { CharacterIdSchema } from "~/lib/api/favorite/schema";
import { resetMemory } from "~/lib/api/memory";
import { getServerSession } from "~/lib/auth/session";
import { getErrorMessages } from "~/utils/zod/getErrorMessages";

export async function action({ request }: ActionFunctionArgs) {
  const body = await request.json();
  const session = await getServerSession(request.headers);

  if (!session)
    return Response.json({ error: "Unauthorized." }, { status: 401 });

  const parsed = CharacterIdSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      {
        error: getErrorMessages(parsed.error.flatten().fieldErrors),
      },
      { status: 400 }
    );
  }

  try {
    const { characterId } = parsed.data;

    const key = `memories.${session.user.id}.${characterId}`;

    await resetMemory(key);
    return Response.json(null);
  } catch (e) {
    return Response.json({ error: "An error has occurred." }, { status: 500 });
  }
}
