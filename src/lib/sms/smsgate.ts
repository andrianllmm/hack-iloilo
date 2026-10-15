import type { SmsGateway } from "./gateway";

/**
 * SMSGate 3rdparty API (https://docs.sms-gate.app): the cloud server
 * (`https://api.sms-gate.app/3rdparty/v1`) or a private one.
 */
export class SmsGateGateway implements SmsGateway {
  constructor(
    private readonly options: {
      /** API base, e.g. `https://api.sms-gate.app/3rdparty/v1`. */
      url: string;
      username: string;
      password: string;
      deviceId?: string;
      simNumber?: number;
    },
  ) {}

  async send(to: string, body: string) {
    const { url, username, password, deviceId, simNumber } = this.options;
    const auth = Buffer.from(`${username}:${password}`).toString("base64");
    const res = await fetch(`${url.replace(/\/+$/, "")}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        textMessage: { text: body },
        phoneNumbers: [to],
        ...(deviceId && { deviceId }),
        ...(simNumber && { simNumber }),
      }),
    });
    if (!res.ok) {
      throw new Error(`SMSGate send failed: ${res.status} ${await res.text()}`);
    }
    const { id } = (await res.json()) as { id: string };
    return { id };
  }
}
