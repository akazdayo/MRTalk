import { LoaderFunctionArgs } from "@remix-run/node";
import { getServerSession } from "~/lib/auth/session";
import { getParams } from "~/utils/getParams";

export async function loader({ params, request }: LoaderFunctionArgs) {
  const id = params.id;
  const text = getParams(request.url, "text");
  const session = await getServerSession(request.headers);
  if (!session) return Response.json("Unauthorized", { status: 401 });

  const res = await fetch(
    `http://localhost:8000/chat?text=${text}&character_id=${id}&user_id=${session.user.id}`,
    {
      headers: {
        Authorization: `Bearer ${session.session.token}`,
        method: "GET",
      },
    }
  );

  const json = await res.json();

  const result = json.response;

  return result;
}
