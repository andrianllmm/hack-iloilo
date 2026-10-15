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
      ? new SmsGateGateway({
          url: e.SMS_GATEWAY_URL,
          username: e.SMSGATE_USERNAME!,
          password: e.SMSGATE_PASSWORD!,
          deviceId: e.SMS_GATEWAY_DEVICE_ID,
          simNumber: e.SMS_GATEWAY_SIM_NUMBER,
        })
      : new SimulatorGateway();
  return gateway;
}
