import { existsSync } from "node:fs";
import { randomInt } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { db } from "@/lib/supabase/admin";
import { findOrRegisterByPhone } from "./queries";

describe.skipIf(process.env.RUN_ACCOUNTS_DB_TESTS !== "1")(
  "local Supabase registration",
  () => {
    const phone = `+639${String(randomInt(0, 1_000_000_000)).padStart(9, "0")}`;
    beforeAll(() => {
      for (const file of [".env.local", ".env"])
        if (existsSync(file)) process.loadEnvFile(file);
      const hostname = new URL(
        process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://invalid",
      ).hostname;
      if (!["localhost", "127.0.0.1"].includes(hostname))
        throw new Error("Integration tests require local Supabase.");
    });
    afterAll(async () => {
      const hostname = new URL(
        process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://invalid",
      ).hostname;
      if (["localhost", "127.0.0.1"].includes(hostname)) {
        const { error } = await db()
          .from("clients")
          .delete()
          .eq("phone", phone);
        if (error) throw error;
      }
    });
    it("creates one row for simultaneous requests and preserves the winner", async () => {
      const results = await Promise.all([
        findOrRegisterByPhone(phone, { name: "Integration first" }),
        findOrRegisterByPhone(phone, { name: "Integration second" }),
      ]);
      expect(results[0].id).toBe(results[1].id);
      const { data, error } = await db()
        .from("clients")
        .select()
        .eq("phone", phone);
      expect(error).toBeNull();
      expect(data).toHaveLength(1);
      expect(
        (await findOrRegisterByPhone(phone, { name: "Replacement" })).name,
      ).toBe(data![0].name);
    });
  },
);
