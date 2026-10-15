import { connection } from "next/server";
import { todayManila } from "@/lib/dates";
import { requireRole } from "@/modules/accounts/auth";
import { liveQueue, municipalities } from "../queries";
import { GateQueue } from "./gate-queue";
import { QueueFailure } from "./queue-failure";

export async function QueueLoader() {
  await requireRole();
  await connection();
  let data;
  try {
    data = await Promise.all([liveQueue(), municipalities()]);
  } catch (error) {
    console.error("Unable to load the gate queue", error);
  }
  return data ? (
    <GateQueue
      rows={data[0]}
      municipalities={data[1]}
      today={todayManila()}
      renderedAt={new Date().toISOString()}
    />
  ) : (
    <QueueFailure />
  );
}
