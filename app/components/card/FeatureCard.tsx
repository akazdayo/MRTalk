import { ReactNode } from "react";
import { Card } from "~/components/ui/card";

export default function FeatureCard({
  step,
  title,
  icon,
}: {
  step: string;
  title: string;
  icon: ReactNode;
}) {
  return (
    <Card className="flex flex-col items-center p-6 space-y-4">
      {icon}
      <h2 className="text-xl font-semibold">Step {step}</h2>
      <p className="text-center">{title}</p>
    </Card>
  );
}
