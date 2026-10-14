import "server-only";
import { env } from "@/lib/env";
import type { SmsGateway } from "./gateway";
import { SimulatorGateway } from "./simulator";
import { SmsGateGateway } from "./smsgate";

export type { SmsGateway } from "./gateway";

let gateway: SmsGateway | undefined;

/** The configured gateway, chosen by `SMS_GATEWAY`. */
export function smsGateway(): SmsGateway {
  if (gateway) return gateway;
  const e = env();
  gateway =
    e.SMS_GATEWAY === "smsgate"
      ? new SmsGateGateway(
          e.SMSGATE_URL!,
          e.SMSGATE_USERNAME!,
          e.SMSGATE_PASSWORD!,
        )
      : new SimulatorGateway();
  return gateway;
}
