import { notFound } from "next/navigation";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatKg } from "@/lib/format";
import { requireRole } from "@/modules/accounts/auth";
import { ownershipLabels, serviceLabels, stageLabels } from "../logic";
import { batchSummary } from "../queries";

const started = new Intl.DateTimeFormat("en-PH", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Manila",
});

/** Basic batch record opened from the gate; #29 adds the receiving form. */
export async function BatchSummaryCard({ id }: { id: string }) {
  await requireRole();
  if (!z.guid().safeParse(id).success) notFound();
  const batch = await batchSummary(id);
  if (!batch) notFound();
  const rows: [string, string][] = [
    ["Client", `${batch.client.name} · ${batch.client.phone}`],
    ["Line", batch.entry ? serviceLabels[batch.entry.service] : "—"],
    ["Ownership", ownershipLabels[batch.ownership]],
    ["Est. weight", batch.entry?.est_kg ? formatKg(batch.entry.est_kg) : "—"],
    [
      "Started",
      batch.entry?.started_at
        ? started.format(new Date(batch.entry.started_at))
        : "—",
    ],
  ];
  return (
    <section className="flex min-w-0 flex-col gap-6 font-sans [--font-sans:var(--font-geist-sans)]">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Batch {batch.batch_no}
        </h1>
        <p className="text-sm text-muted-foreground">
          Opened at the gate · receiving comes next
        </p>
      </header>
      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Batch record</CardTitle>
          <CardDescription>
            Stage <Badge variant="secondary">{stageLabels[batch.stage]}</Badge>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
            {rows.map(([label, value]) => (
              <div key={label} className="contents">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="font-medium">{value}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>
    </section>
  );
}
