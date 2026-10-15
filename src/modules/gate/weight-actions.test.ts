import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/modules/accounts/auth", () => ({ requireRole: vi.fn() }));
vi.mock("./queries", () => ({ confirmWeightInPerson: vi.fn() }));
import { requireRole, type Staff } from "@/modules/accounts/auth";
import { confirmWeightInPerson } from "./queries";
import { confirmBatchWeightInPerson } from "./actions";
const id = "11111111-1111-4111-8111-111111111111";
const input = {
  stage: "receiving",
  updatedAt: "2026-10-15T10:00:00.123456+00:00",
};
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(requireRole).mockResolvedValue({ id, role: "encoder" } as Staff);
});
it("authenticates before confirming and derives staff identity from the session", async () => {
  await expect(
    confirmBatchWeightInPerson(id, { ...input, staffId: "untrusted" }),
  ).resolves.toEqual({ status: "ok" });
  expect(confirmWeightInPerson).toHaveBeenCalledWith(
    id,
    "receiving",
    id,
    input.updatedAt,
  );
  vi.mocked(requireRole).mockRejectedValue(new Error("Unauthorized"));
  vi.mocked(confirmWeightInPerson).mockClear();
  await expect(confirmBatchWeightInPerson(id, input)).rejects.toThrow(
    "Unauthorized",
  );
  expect(confirmWeightInPerson).not.toHaveBeenCalled();
});
it("rejects invalid batch IDs, stages and snapshot timestamps before writing", async () => {
  for (const [batchId, value] of [
    ["bad", input],
    [id, { ...input, stage: "milling" }],
    [id, { ...input, updatedAt: "bad" }],
  ] as const) {
    expect((await confirmBatchWeightInPerson(batchId, value)).status).toBe(
      "error",
    );
  }
  expect(confirmWeightInPerson).not.toHaveBeenCalled();
});
