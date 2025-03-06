import { auth } from "../../auth.server";

export const getServerSession = async (headers: Headers) => {
  return await auth.api.getSession({
    headers: await headers,
  });
};
