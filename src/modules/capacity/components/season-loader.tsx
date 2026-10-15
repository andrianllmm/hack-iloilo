import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { todayManila } from "@/lib/dates";
import { requireRole } from "@/modules/accounts/auth";
import { seasonRange } from "../logic";
import { dryerSeason } from "../queries";
import { SeasonHeatmap } from "./season-heatmap";

export async function SeasonLoader() {
  await requireRole();
  const today = todayManila();
  const { from, to } = seasonRange(today);
  let days;
  try {
    days = await dryerSeason(from, to, today);
  } catch (error) {
    console.error("Unable to load the season heatmap", error);
  }
  if (!days) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyTitle>Season couldn&apos;t load</EmptyTitle>
          <EmptyDescription>Check the connection and reload.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }
  return <SeasonHeatmap days={days} today={today} />;
}
