import { MetaFunction } from "@remix-run/node";
import HomeContainer from "~/components/container/HomeContainer";

export const meta: MetaFunction = () => {
  return [
    { title: "New Remix App" },
    { name: "description", content: "Welcome to Remix!" },
  ];
};

export default function Index() {
  return <HomeContainer />;
}
