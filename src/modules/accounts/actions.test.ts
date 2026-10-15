import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  requireRole: vi.fn(),
  register: vi.fn(),
  update: vi.fn(),
  revalidate: vi.fn(),
}));
vi.mock("./auth", () => ({ requireRole: mocks.requireRole }));
vi.mock("./queries", async (original) => ({
  ...(await original<typeof import("./queries")>()),
  registerClientRecord: mocks.register,
  updateClientRecord: mocks.update,
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
import { saveClient } from "./actions";
import { ClientInputError } from "./queries";
const input = {
  name: "Farmer",
  phone: "09171234567",
  kind: "farmer",
  municipality_id: null,
  coop_id: null,
};
beforeEach(() => vi.resetAllMocks());
it("authenticates before validating or writing", async () => {
  mocks.requireRole.mockRejectedValue(new Error("unauthorized"));
  await expect(saveClient({})).rejects.toThrow("unauthorized");
  expect(mocks.register).not.toHaveBeenCalled();
});
it("returns validation errors without database access", async () => {
  const result = await saveClient({ ...input, phone: "bad" });
  expect(result).toMatchObject({
    status: "error",
    fieldErrors: { phone: expect.any(String) },
  });
  expect(mocks.register).not.toHaveBeenCalled();
});
it("distinguishes an existing registration and refreshes the directory", async () => {
  mocks.register.mockResolvedValue({ client: input, created: false });
  expect(await saveClient(input)).toMatchObject({ status: "existing" });
  expect(mocks.revalidate).toHaveBeenCalledWith("/clients");
  expect(mocks.requireRole.mock.invocationCallOrder[0]).toBeLessThan(
    mocks.register.mock.invocationCallOrder[0],
  );
});
it("maps relation errors to their field", async () => {
  mocks.register.mockRejectedValue(
    new ClientInputError("coop_id", "Choose a co-op"),
  );
  expect(await saveClient(input)).toEqual({
    status: "error",
    fieldErrors: { coop_id: "Choose a co-op" },
  });
});
it("rejects malformed edit ids", async () => {
  expect(await saveClient(input, "bad")).toMatchObject({ status: "error" });
  expect(mocks.update).not.toHaveBeenCalled();
});
it("returns an updated client", async () => {
  mocks.update.mockResolvedValue(input);
  expect(
    await saveClient(input, "c1000000-0000-0000-0000-000000000001"),
  ).toMatchObject({ status: "updated" });
});
