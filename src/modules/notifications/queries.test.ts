import { expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const { upsert } = vi.hoisted(() => ({ upsert: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({
  db: () => ({ from: () => ({ upsert }) }),
}));
import { notify } from "./queries";
it("deduplicates without overwriting an existing event", async () => {
  upsert.mockResolvedValue({ error: null });
  await notify({
    kind: "sell_offer_created",
    entityId: "offer-1",
    title: "New offer",
  });
  expect(upsert).toHaveBeenCalledWith(
    {
      kind: "sell_offer_created",
      entity_id: "offer-1",
      title: "New offer",
      role: "manager",
      href: "/buying",
    },
    { onConflict: "kind,entity_id", ignoreDuplicates: true },
  );
});
it("isolates both database errors and exceptions from event producers", async () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  upsert
    .mockResolvedValueOnce({ error: new Error("Write failed") })
    .mockRejectedValueOnce(new Error("Network failed"));
  const event = {
    kind: "sms_failed" as const,
    entityId: "sms-1",
    title: "Failed SMS",
  };
  await expect(notify(event)).resolves.toBeUndefined();
  await expect(notify(event)).resolves.toBeUndefined();
  expect(log).toHaveBeenCalledTimes(2);
  log.mockRestore();
});
