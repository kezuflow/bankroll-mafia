import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
        <div className="rounded-lg border border-border bg-secondary/50 p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <Icon className="h-4 w-4 text-primary" />
            {target.label}
          </div>
          <p className="text-sm leading-6 text-muted-foreground">
            {target.description}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
