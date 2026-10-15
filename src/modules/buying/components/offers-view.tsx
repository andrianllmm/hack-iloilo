import Link from "next/link";
import { cn } from "cn";
import { Badge, badgeVariants } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatKg } from "@/lib/format";
import { getStaff } from "@/modules/accounts/auth";
import { listOffers, type OfferListItem, type OfferStatus } from "../queries";
import { DecideButtons, WithdrawButton } from "./offer-actions";

const FILTERS: { label: string; value: OfferStatus | undefined }[] = [
  { label: "All", value: undefined },
  { label: "Offered", value: "offered" },
  { label: "Accepted", value: "accepted" },
  { label: "Declined", value: "declined" },
  { label: "Withdrawn", value: "withdrawn" },
];

const STATUS_VARIANT: Record<
  OfferStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  offered: "secondary",
  accepted: "default",
  arrived: "default",
  declined: "destructive",
  withdrawn: "outline",
};

// Single source of truth for valid statuses; STATUS_VARIANT is exhaustive.
const KNOWN = Object.keys(STATUS_VARIANT) as OfferStatus[];

function asStatus(raw: string | string[] | undefined): OfferStatus | undefined {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return KNOWN.find((s) => s === value);
}

export async function OffersView({
  searchParams,
}: {
  searchParams: Promise<{ status?: string | string[] }>;
}) {
  const { status: rawStatus } = await searchParams;
  const status = asStatus(rawStatus);
  const [staff, offers] = await Promise.all([getStaff(), listOffers(status)]);
  const isManager = staff?.role === "manager";

  return (
    <div className="flex flex-col gap-3">
      <nav className="flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const active = f.value === status;
          return (
            <Link
              key={f.label}
              href={f.value ? `/buying?status=${f.value}` : "/buying"}
              className={cn(
                badgeVariants({ variant: active ? "default" : "outline" }),
              )}
            >
              {f.label}
            </Link>
          );
        })}
      </nav>

      {offers.length === 0 ? (
        <p className="text-sm text-muted-foreground">No offers.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ref</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Variety</TableHead>
              <TableHead className="text-right">Est. kg</TableHead>
              <TableHead>Harvest</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {offers.map((offer) => (
              <OfferRow key={offer.id} offer={offer} isManager={isManager} />
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

function OfferRow({
  offer,
  isManager,
}: {
  offer: OfferListItem;
  isManager: boolean;
}) {
  const decidable = offer.status === "offered";
  return (
    <TableRow>
      <TableCell className="font-mono">{offer.ref}</TableCell>
      <TableCell>{offer.client?.name ?? "—"}</TableCell>
      <TableCell>{offer.variety?.code ?? "—"}</TableCell>
      <TableCell className="text-right">{formatKg(offer.est_kg)}</TableCell>
      <TableCell>{offer.harvest_date}</TableCell>
      <TableCell>
        <Badge variant={STATUS_VARIANT[offer.status]}>{offer.status}</Badge>
      </TableCell>
      <TableCell>
        {decidable && (
          <div className="flex items-center justify-end gap-2">
            {isManager && <DecideButtons id={offer.id} />}
            <WithdrawButton id={offer.id} />
          </div>
        )}
      </TableCell>
    </TableRow>
  );
}
