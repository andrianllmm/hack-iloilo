import type { SmsGateway } from "./gateway";

/**
 * Demo gateway: no real SMS is sent.
 * TODO(M3): persist outbound messages to `sms_messages` so the simulator page shows them.
 */
export class SimulatorGateway implements SmsGateway {
  async send(to: string, body: string) {
    const id = `sim-${crypto.randomUUID()}`;
    console.info(`[sms:simulator] -> ${to}: ${body}`);
    return { id };
  }
}
