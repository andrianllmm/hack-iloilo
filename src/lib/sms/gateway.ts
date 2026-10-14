/** Sends an SMS. Implementations: simulator (demo) and SMSGate (real phone). */
export interface SmsGateway {
  send(to: string, body: string): Promise<{ id: string }>;
}
