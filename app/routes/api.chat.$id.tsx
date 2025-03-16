import { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { getServerSession } from "~/lib/auth/session";
import { getParams } from "~/utils/getParams";

export async function loader({ params, request }: LoaderFunctionArgs) {
  const id = params.id;
  const text = getParams(request.url, "text");

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
    }

    const json = await res.json();
    return Response.json(json, {
      status: 200,
    });
  } catch (e) {
    return Response.json({ error: "An error has occurred." }, { status: 500 });
  }
}

export async function action({ params, request }: ActionFunctionArgs) {
  const id = params.id;
  const form = await request.formData();
  const audio = form.get("file");

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
    }

    const json = await res.json();
    return Response.json(json, {
      status: 200,
    });
  } catch (e) {
    return Response.json({ error: "An error has occurred." }, { status: 500 });
  }
}
