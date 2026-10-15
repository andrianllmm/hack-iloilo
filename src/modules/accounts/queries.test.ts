import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const { from } = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ db: () => ({ from }) }));
import {
  clientsDirectory,
  findOrRegisterByPhone,
  registerClientRecord,
  updateClientRecord,
} from "./queries";
import type { Client } from "./types";
const existing: Client = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Original",
  phone: "+639171234567",
  kind: "farmer",
  municipality_id: null,
  coop_id: null,
  created_at: "",
  updated_at: "",
};
const input = {
  name: "Edited",
  phone: "09171234567",
  kind: "farmer" as const,
  municipality_id: null,
  coop_id: null,
};
function response(data: unknown, error: unknown = null) {
  const result = { data, error };
  const chain = Object.assign(Promise.resolve(result), {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    range: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    limit: vi.fn(),
    maybeSingle: vi.fn(),
    single: vi.fn(),
  });
  for (const method of [
    "select",
    "eq",
    "order",
    "range",
    "insert",
    "update",
    "limit",
    "maybeSingle",
    "single",
  ] as const)
    chain[method].mockReturnValue(chain);
  from.mockReturnValueOnce(chain);
  return chain;
}
beforeEach(() => vi.resetAllMocks());
describe("registration", () => {
  it("normalizes before lookup and preserves existing data", async () => {
    const query = response(existing);
    expect(
      await findOrRegisterByPhone("09171234567", { name: "Replacement" }),
    ).toEqual(existing);
    expect(query.eq).toHaveBeenCalledWith("phone", existing.phone);
    expect(from).toHaveBeenCalledTimes(1);
  });
  it("creates an unknown SMS client with defaults", async () => {
    response(null);
    const insert = response(existing);
    await findOrRegisterByPhone("9171234567");
    expect(insert.insert).toHaveBeenCalledWith({
      ...input,
      name: "SMS 4567",
      phone: existing.phone,
    });
  });
  it("honors supplied defaults for new clients", async () => {
    response(null);
    const insert = response(existing);
    await findOrRegisterByPhone(existing.phone, {
      name: "Named",
      kind: "buyer",
    });
    expect(insert.insert).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Named", kind: "buyer" }),
    );
  });
  it("returns the winner of a competing insert", async () => {
    response(null);
    response(null, { code: "23505" });
    response(existing);
    expect(await registerClientRecord(existing.phone)).toEqual({
      client: existing,
      created: false,
    });
  });
  it("propagates database failures", async () => {
    response(null, { message: "offline" });
    await expect(findOrRegisterByPhone(existing.phone)).rejects.toEqual({
      message: "offline",
    });
  });
  it("rejects an invalid phone without touching the database", async () => {
    await expect(findOrRegisterByPhone("wrong")).rejects.toThrow(
      "valid Philippine",
    );
    expect(from).not.toHaveBeenCalled();
  });
  it("rejects missing municipalities", async () => {
    response(null);
    response(null);
    await expect(
      findOrRegisterByPhone(existing.phone, { municipality_id: existing.id }),
    ).rejects.toThrow("existing municipality");
  });
  it("rejects references that are not co-ops", async () => {
    response(null);
    const lookup = response(null);
    await expect(
      findOrRegisterByPhone(existing.phone, { coop_id: existing.id }),
    ).rejects.toThrow("existing co-op");
    expect(lookup.eq).toHaveBeenCalledWith("kind", "coop");
  });
});
describe("editing", () => {
  it("updates by immutable id and normalizes the phone", async () => {
    response([]);
    const update = response(existing);
    await updateClientRecord(existing.id, input);
    expect(update.eq).toHaveBeenCalledWith("id", existing.id);
    expect(update.update).toHaveBeenCalledWith({
      ...input,
      phone: existing.phone,
    });
  });
  it("returns a field error when the phone is already taken", async () => {
    response([]);
    response(null, { code: "23505" });
    await expect(updateClientRecord(existing.id, input)).rejects.toThrow(
      "another client",
    );
  });
  it("prevents self-membership", async () => {
    await expect(
      updateClientRecord(existing.id, { ...input, coop_id: existing.id }),
    ).rejects.toThrow("itself");
    expect(from).not.toHaveBeenCalled();
  });
  it("prevents changing the kind of a co-op with members", async () => {
    response([{ id: "member" }]);
    await expect(updateClientRecord(existing.id, input)).rejects.toThrow(
      "Reassign",
    );
    expect(from).toHaveBeenCalledTimes(1);
  });
  it("rejects nested co-ops", async () => {
    await expect(
      updateClientRecord(existing.id, {
        ...input,
        kind: "coop",
        coop_id: existing.id,
      }),
    ).rejects.toThrow();
    expect(from).not.toHaveBeenCalled();
  });
  it("reports a client removed since loading", async () => {
    response([]);
    response(null);
    await expect(updateClientRecord(existing.id, input)).rejects.toThrow(
      "no longer exists",
    );
  });
});
it("loads beyond the API response limit", async () => {
  const first = response(Array.from({ length: 1000 }, () => existing));
  const second = response([existing]);
  expect(await clientsDirectory()).toHaveLength(1001);
  expect(first.range).toHaveBeenCalledWith(0, 999);
  expect(second.range).toHaveBeenCalledWith(1000, 1999);
});
