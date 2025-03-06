import { NavigateFunction } from "@remix-run/react";
import { authClient } from "./client";

export const signIn = async () => {
  const data = await authClient.signIn.social({
    provider: "google",
    callbackURL: "/",
  });

  return data;
};

export const signOut = async (navigate: NavigateFunction) => {
  await authClient.signOut({
    fetchOptions: {
      onSuccess: () => {
        navigate("/login");
      },
      onError: () => {
        navigate("/");
      },
    },
  });
};
