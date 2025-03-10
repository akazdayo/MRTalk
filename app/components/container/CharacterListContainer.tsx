import { ReactNode } from "react";

type Props = {
  title: string;
  children: ReactNode;
};

export default function CharacterList(props: Props) {
  return (
    <div className="mt-8">
      <div className="mb-8">
        <h2 className="text-3xl md:text-4xl font-bold">{props.title}</h2>
      </div>

      <div className="flex overflow-x-auto md:grid md:grid-cols-3 gap-6">
        {props.children}
      </div>
    </div>
  );
}
