import React from "react";
import Header from "../ui/header";

export default function Main({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <Header />
      <div className="container mx-auto max-w-3xl p-4 flex flex-col">
        {children}
      </div>
    </div>
  );
}
