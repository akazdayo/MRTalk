import { ReactNode } from "react";

type Props = {
  title: string;
  children: ReactNode;
};

export default function CharacterList(props: Props) {
  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mb-6 text-center">
        <h2 className="text-3xl md:text-4xl font-bold text-gray-900 tracking-tight">
          {props.title}
        </h2>
      </div>

      <div className="grid md:grid-cols-3 gap-6 items-center">
        {props.children}
      </div>
    </div>
  );
}
