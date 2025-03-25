import { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { getServerSession } from "~/lib/auth/session";
import { InputSchema, ResponseSchema } from "~/lib/llm/schema";
import { getParams } from "~/utils/getParams";
import { getErrorMessages } from "~/utils/zod/getErrorMessages";

export async function loader({ params, request }: LoaderFunctionArgs) {
  const parsed = InputSchema.safeParse({
    id: params.id,
    text: getParams(request.url, "text"),
  });

  if (!parsed.success) {
    return Response.json(
      {
        error: getErrorMessages(parsed.error.flatten().fieldErrors),
      },
      { status: 400 }
    );
  }

  const session = await getServerSession(request.headers);
  if (!session) {
    return Response.json(
      { error: "Unauthorized" },
      {
        status: 401,
      }
    );
  }

  const { id, text } = parsed.data;

  try {
    const res = await fetch(
      `http://localhost:8000/chat?character_id=${id}&text=${text}`,
      {
        headers: {
          Authorization: `Bearer ${session.session.token}`,
        },
      }
    );

    if (!res.ok) {
      const errorResponse = await res.json();

      return Response.json(
        { error: errorResponse.detail },
        { status: res.status }
      );
    } else {
      const json = await res.json();

      //バリデーション
      const parsed = ResponseSchema.safeParse(json);
      if (!parsed.success) {
        return Response.json(
          {
            error: getErrorMessages(parsed.error.flatten().fieldErrors),
          },
          { status: 400 }
        );
      }

      return Response.json(parsed.data, {
        status: 200,
      });
    }
  } catch (e) {
    return Response.json({ error: "An error has occurred." }, { status: 500 });
  }
}

export async function action({ params, request }: ActionFunctionArgs) {
  const id = params.id;
  const form = await request.formData();
  const audio = form.get("file");

  if (!id) {
    return Response.json(
      { error: "id is required." },
      {
        status: 400,
      }
    );
  }

  if (!audio) {
    return Response.json(
      { error: "Audio files required." },
      {
        status: 400,
      }
    );
  }

  const session = await getServerSession(request.headers);
  if (!session) {
    return Response.json(
      { error: "Unauthorized" },
      {
        status: 401,
      }
    );
  }

  try {
    const res = await fetch(`http://localhost:8000/chat?character_id=${id}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.session.token}`,
      },
      body: form,
    });

    if (!res.ok) {
      const errorResponse = await res.json();

      return Response.json(
        { error: errorResponse.detail },
        { status: res.status }
      );
    } else {
      const json = await res.json();

      //バリデーション
      const parsed = ResponseSchema.safeParse(json);
      if (!parsed.success) {
        return Response.json(
          {
            error: getErrorMessages(parsed.error.flatten().fieldErrors),
          },
          { status: 400 }
        );
      }

      return Response.json(parsed.data, {
        status: 200,
      });
    }
  } catch (e) {
    return Response.json({ error: "An error has occurred." }, { status: 500 });
  }
}
