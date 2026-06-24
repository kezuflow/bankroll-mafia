import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Image from "next/image";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { targetDisplay } from "./display-config";

export type TargetId = keyof typeof targetDisplay;

export function TargetCard({
  selectedTargetId,
  onTargetChange,
}: {
  selectedTargetId: string;
  onTargetChange: (targetId: string) => void;
}) {
  const target =
    targetDisplay[selectedTargetId as TargetId] ?? targetDisplay["corner-bank"];
  const Icon = target.icon;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Target</CardTitle>
        <CardDescription>
          Targets change risk shape; backend math remains authoritative.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Select value={selectedTargetId} onValueChange={onTargetChange}>
          <SelectTrigger>
            <SelectValue placeholder="Select target" />
          </SelectTrigger>
          <SelectContent>
            {Object.values(targetDisplay).map((option) => (
              <SelectItem key={option.id} value={option.id}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="overflow-hidden rounded-lg border border-border bg-secondary/50">
          <div className="relative aspect-[16/9] w-full bg-muted">
            <Image
              src={target.imageSrc}
              alt={`${target.label} target bank exterior`}
              fill
              sizes="(min-width: 1280px) 350px, (min-width: 1024px) 45vw, 100vw"
              className="object-cover"
              priority
            />
          </div>
          <div className="p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <Icon className="h-4 w-4 text-primary" />
              {target.label}
            </div>
            <p className="text-sm leading-6 text-muted-foreground">
              {target.description}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
