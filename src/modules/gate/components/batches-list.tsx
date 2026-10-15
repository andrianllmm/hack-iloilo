import Link from "next/link";
import { cn } from "cn";
import { todayManila } from "@/lib/dates";
import { requireRole } from "@/modules/accounts/auth";
import { buyerTypeLabels, buyerTypes } from "@/modules/accounts/logic";
import { dispatchPeriod, stageLabels } from "../logic";
import { listBatches } from "../queries";
import type { Batch } from "../types";
import { BatchesDataTable } from "./batches-data-table";
import { DispatchSummary } from "./dispatch-summary";

const stages: Batch["stage"][] = [
  "received",
  "drying",
  "stored",
  "milling",
  "milled",
  "dispatched",
];

/** `/batches` with the given filters, leaving out empty ones. */
function batchesHref(params: Record<string, string | undefined>): string {
  const query = new URLSearchParams(
    Object.entries(params).filter((entry): entry is [string, string] =>
      Boolean(entry[1]),
    ),
  ).toString();
  return query ? `/batches?${query}` : "/batches";
}

export async function BatchesList({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRole();
  const params = await searchParams;
  const stage = stages.find((s) => s === params.stage);
  const buyerType = buyerTypes.find((t) => t === params.buyer_type);
  const period = dispatchPeriod(params.from, params.to, todayManila());
  // Only carry the period in links once staff have picked one.
  const picked = params.from !== undefined || params.to !== undefined;
  const filters = {
    stage,
    buyer_type: buyerType,
    from: picked ? period.from : undefined,
    to: picked ? period.to : undefined,
  };
  const batches = await listBatches(stage, buyerType);

  return (
    <section className="flex min-w-0 flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Batches</h1>
        <p className="text-sm text-muted-foreground">
          Batch records from receiving to dispatch.
        </p>
      </header>

      <DispatchSummary
        from={period.from}
        to={period.to}
        keep={{ stage, buyer_type: buyerType }}
      />

      <nav className="flex flex-wrap gap-2" aria-label="Filter by stage">
        <FilterLink
          label="All"
          active={!stage}
          href={batchesHref({ ...filters, stage: undefined })}
        />
        {stages.map((s) => (
          <FilterLink
            key={s}
            label={stageLabels[s]}
            active={stage === s}
            href={batchesHref({ ...filters, stage: s })}
          />
        ))}
      </nav>

      <nav className="flex flex-wrap gap-2" aria-label="Filter by buyer type">
        <FilterLink
          label="Any buyer"
          active={!buyerType}
          href={batchesHref({ ...filters, buyer_type: undefined })}
        />
        {buyerTypes.map((t) => (
          <FilterLink
            key={t}
            label={buyerTypeLabels[t]}
            active={buyerType === t}
            href={batchesHref({ ...filters, buyer_type: t })}
          />
        ))}
      </nav>

      {batches.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {stage || buyerType ? "No batches match." : "No batches yet."}
        </p>
      ) : (
        <BatchesDataTable batches={batches} />
      )}
    </section>
  );
}

function FilterLink({
  label,
  href,
  active,
}: {
  label: string;
  href: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "rounded-full border px-3 py-1 text-sm transition-colors",
        active
          ? "border-transparent bg-primary text-primary-foreground"
          : "border-input hover:bg-accent hover:text-accent-foreground",
      )}
    >
      {label}
    </Link>
  );
}
