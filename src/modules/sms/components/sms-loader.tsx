import { env } from "@/lib/env";
import { requireRole } from "@/modules/accounts/auth";
import { normalizePhone } from "@/modules/accounts/logic";
import { clientsDirectory } from "@/modules/accounts/queries";
import { smsThread, smsThreads } from "../queries";
import { SmsView } from "./sms-view";

export async function SmsLoader({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRole();
  const params = await searchParams;
  const phone =
    typeof params.phone === "string" ? normalizePhone(params.phone) : null;
  let data;
  try {
    data = await Promise.all([
      smsThreads(),
      phone ? smsThread(phone) : [],
      clientsDirectory(),
    ]);
  } catch (error) {
    console.error("Unable to load SMS log", error);
  }
  const names = Object.fromEntries(
    (data?.[2] ?? []).map((client) => [client.phone, client.name]),
  );
  return (
    <SmsView
      threads={data?.[0] ?? null}
      messages={data?.[1] ?? []}
      names={names}
      phone={phone}
      simulator={env().SMS_GATEWAY !== "smsgate"}
    />
  );
}
