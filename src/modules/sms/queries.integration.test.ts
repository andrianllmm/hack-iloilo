import { existsSync } from "node:fs";
import { randomInt } from "node:crypto";
import { z } from "zod";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { db } from "@/lib/supabase/admin";
import {
  handleInbound,
  openPrompt,
  processInbound,
  smsThread,
} from "./queries";
import { onPromptAnswer, PromptRefusal, registerCommand } from "./registry";

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
      });
      onPromptAnswer("ai_confirm", async (prompt, yes, ctx) => {
        if (ctx.phone !== prompt.phone) throw new PromptRefusal("Not yours.");
        return `answered ${yes ? "yes" : "no"} ${prompt.ref}`;
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
      expect((await lastReply())?.body).toMatch(/Unknown command.*ECHOTEST/);
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
      expect((await lastReply())?.body).toMatch(/Unknown command/);
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
      const ref = await openPrompt({ phone, kind: "ai_confirm", payload: {} });
      await handleInbound({ phone: other, body: `YES ${ref}` });
      expect((await lastReply(other))?.body).toBe("Not yours.");

      await handleInbound({ phone, body: `yes ${ref.toLowerCase()}` });
      expect((await lastReply())?.body).toBe(`answered yes ${ref}`);

      await handleInbound({ phone, body: `NO ${ref}` });
      expect((await lastReply())?.body).toMatch(/No open question/);
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
