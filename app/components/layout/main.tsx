import React from "react";

export default function Main({ children }: { children: React.ReactNode }) {
  return (
    <div className="container mx-auto max-w-2xl p-4 h-screen flex flex-col">
      {children}
    </div>
  );
}
