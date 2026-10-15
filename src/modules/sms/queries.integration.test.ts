import { existsSync } from "node:fs";
import { randomInt } from "node:crypto";
import { z } from "zod";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const extract = vi.hoisted(() => vi.fn(async (): Promise<unknown> => null));
vi.mock("@/lib/ai", () => ({ extract, aiEnabled: () => true }));
import { db } from "@/lib/supabase/admin";
import {
  handleInbound,
  openPrompt,
  processInbound,
  smsThread,
} from "./queries";
import { registerCommand } from "./registry";

describe.skipIf(process.env.RUN_SMS_DB_TESTS !== "1")(
  "local Supabase SMS flow",
  () => {
    const phone = `+639${String(randomInt(0, 1_000_000_000)).padStart(9, "0")}`;
    const other = `+639${String(randomInt(0, 1_000_000_000)).padStart(9, "0")}`;
    const lastReply = async (to = phone) =>
      (await smsThread(to)).filter((m) => m.direction === "outbound").at(-1);

    beforeAll(() => {
      for (const file of [".env.local", ".env"])
        if (existsSync(file)) process.loadEnvFile(file);
      process.env.SMS_GATEWAY = "simulator";
      const hostname = new URL(
        process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://invalid",
      ).hostname;
      if (!["localhost", "127.0.0.1"].includes(hostname))
        throw new Error("Integration tests require local Supabase.");

      registerCommand({
        keywords: ["ECHOTEST"],
        schema: z.object({ n: z.coerce.number().int() }),
        parse: ([n]) => ({ n }),
        handle: async ({ n }, ctx) =>
          `n=${n} from=${ctx.phone} for=${ctx.forPhone ?? "-"} client=${ctx.client.phone}`,
        ai: {
          description: "Echo a number.",
          summary: ({ n }) => `echo ${n}`,
        },
      });
    });

    afterAll(async () => {
      for (const p of [phone, other]) {
        await db().from("sms_messages").delete().eq("phone", p);
        await db().from("sms_prompts").delete().eq("phone", p);
        await db().from("clients").delete().eq("phone", p);
      }
    });

    it("self-registers unknown phones and replies with help", async () => {
      await handleInbound({ phone, body: "hello there" });
      const { data: client } = await db()
        .from("clients")
        .select()
        .eq("phone", phone)
        .single();
      expect(client?.name).toMatch(/^SMS /);
      expect((await lastReply())?.body).toMatch(/Palihog i-text: .*ECHOTEST/);
      expect((await lastReply())?.status).toBe("sent");
    });

    it("routes keywords with FOR <phone>", async () => {
      await handleInbound({ phone, body: "echotest 5 FOR 09171234567" });
      expect((await lastReply())?.body).toBe(
        `n=5 from=${phone} for=+639171234567 client=${phone}`,
      );
    });

    it("replies with help when args fail the schema", async () => {
      await handleInbound({ phone, body: "ECHOTEST abc" });
      expect((await lastReply())?.body).toMatch(/wala namon naintiendihan/);
    });

    it("dedupes on gateway id", async () => {
      const gatewayId = `test-${randomInt(0, 1e9)}`;
      await handleInbound({ phone, body: "ECHOTEST 1", gatewayId });
      await handleInbound({ phone, body: "ECHOTEST 1", gatewayId });
      const inbound = (await smsThread(phone)).filter(
        (m) => m.gateway_id === gatewayId,
      );
      expect(inbound).toHaveLength(1);
      expect(inbound[0].status).toBe("processed");
    });

    it("processes a relayed row once", async () => {
      const { data } = await db()
        .from("sms_messages")
        .insert({
          direction: "inbound",
          phone: phone.replace("+63", "0"),
          body: "ECHOTEST 2",
          status: "received",
        })
        .select("id")
        .single();
      const before = (await smsThread(phone)).length;
      await processInbound(data!.id);
      await processInbound(data!.id);
      // Phone is normalized onto the row; one inbound + one reply.
      expect((await smsThread(phone)).length).toBe(before + 2);
      expect((await lastReply())?.body).toMatch(/^n=2 /);
    });

    it("answers prompts by ref, refusing other phones", async () => {
      const ref = await openPrompt({
        phone,
        kind: "ai_confirm",
        payload: { keyword: "ECHOTEST", args: { n: 3 } },
      });
      await handleInbound({ phone: other, body: `YES ${ref}` });
      expect((await lastReply(other))?.body).toMatch(
        /wala namon naintiendihan/,
      );

      await handleInbound({ phone, body: `yes ${ref.toLowerCase()}` });
      expect((await lastReply())?.body).toMatch(/^n=3 /);

      await handleInbound({ phone, body: `NO ${ref}` });
      expect((await lastReply())?.body).toMatch(/Wala kami pamangkot/);
    });

    it("reads free text with AI and runs it on a plain yes", async () => {
      extract.mockResolvedValueOnce({
        intent: { command: "ECHOTEST", args: { n: 7 } },
      });
      await handleInbound({ phone, body: "echo seven please" });
      expect((await lastReply())?.body).toBe(
        "IRPC: Para sigurado, gusto mo echo 7? Husto bala?",
      );
      const inbound = (await smsThread(phone)).filter(
        (m) => m.body === "echo seven please",
      );
      expect(inbound[0].via_ai).toBe(true);

      await handleInbound({ phone, body: "Oo sige" });
      expect((await lastReply())?.body).toMatch(/^n=7 /);
    });

    it("discards an AI reading on a plain no", async () => {
      extract.mockResolvedValueOnce({
        intent: { command: "ECHOTEST", args: { n: 8 } },
      });
      await handleInbound({ phone, body: "echo eight" });
      await handleInbound({ phone, body: "indi" });
      expect((await lastReply())?.body).toBe("IRPC: Sige, wala kami gin-save.");
      await handleInbound({ phone, body: "yes please" });
      expect((await lastReply())?.body).toMatch(/Wala kami pamangkot/);
    });

    it("runs AI readings without a summary right away", async () => {
      registerCommand({
        keywords: ["PEEKTEST"],
        schema: z.object({}),
        parse: () => ({}),
        handle: async () => "peeked",
        ai: { description: "Peek." },
      });
      extract.mockResolvedValueOnce({
        intent: { command: "PEEKTEST", args: {} },
      });
      await handleInbound({ phone, body: "can i peek" });
      expect((await lastReply())?.body).toBe("peeked");
    });

    it("falls back to the keyword formats when AI fails", async () => {
      extract.mockResolvedValueOnce(null);
      await handleInbound({ phone, body: "pa dry 20 sako" });
      const reply = (await lastReply())?.body ?? "";
      expect(reply).toMatch(/Palihog i-text: .*ECHOTEST/);
      expect(reply).not.toMatch(/sako/);
      await handleInbound({ phone, body: "ECHOTEST 4" });
      expect((await lastReply())?.body).toMatch(/^n=4 /);
    });

    it("replies with help when AI reads nothing valid", async () => {
      extract.mockResolvedValueOnce({ intent: { command: "NONE" } });
      await handleInbound({ phone, body: "hi" });
      expect((await lastReply())?.body).toMatch(/wala namon naintiendihan/);
      extract.mockResolvedValueOnce({
        intent: { command: "ECHOTEST", args: { n: "x" } },
      });
      await handleInbound({ phone, body: "echo x" });
      expect((await lastReply())?.body).toMatch(/wala namon naintiendihan/);
    });

    it("expires prompts after 24 hours", async () => {
      const ref = await openPrompt({ phone, kind: "ai_confirm", payload: {} });
      await db()
        .from("sms_prompts")
        .update({ expires_at: new Date(Date.now() - 1000).toISOString() })
        .eq("ref", ref);
      await handleInbound({ phone, body: `YES ${ref}` });
      expect((await lastReply())?.body).toMatch(/expired/);
      const { data } = await db()
        .from("sms_prompts")
        .select("status")
        .eq("ref", ref)
        .single();
      expect(data?.status).toBe("expired");
    });

    it("reuses a given ref, replacing its open prompt", async () => {
      const ref = await openPrompt({ phone, kind: "reschedule", payload: {} });
      expect(
        await openPrompt({ phone, kind: "reschedule", payload: {}, ref }),
      ).toBe(ref);
      const { data } = await db()
        .from("sms_prompts")
        .select("status")
        .eq("ref", ref);
      expect(data?.map((p) => p.status).sort()).toEqual(["expired", "open"]);
    });
  },
);
