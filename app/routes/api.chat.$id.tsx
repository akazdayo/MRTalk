import { LoaderFunctionArgs } from "@remix-run/node";
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

  const res = await fetch(
    `http://localhost:8000/chat?text=${text}&character_id=${id}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${session.session.token}`,
      },
    }
  );

  if (!res.ok) {
    const errorResponse = await res.json();
    return Response.json(errorResponse, { status: res.status });
  }

  const json = await res.json();
  return Response.json(json, {
    status: 200,
  });
}
