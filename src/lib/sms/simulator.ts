import type { SmsGateway } from "./gateway";

/**
 * Demo gateway: no real SMS is sent. `send()` in M3 already logs every
 * message to `sms_messages`, which the simulator page shows.
 */
export class SimulatorGateway implements SmsGateway {
  async send(to: string, body: string) {
    const id = `sim-${crypto.randomUUID()}`;
    console.info(`[sms:simulator] -> ${to}: ${body}`);
    return { id };
  }
}
