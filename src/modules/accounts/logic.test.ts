import { describe, expect, it } from "vitest";
import { clientSchema } from "./client-schema";
import { groupClients, normalizePhone } from "./logic";
import type { Client } from "./types";
const client = (
  id: string,
  name: string,
  kind: Client["kind"] = "farmer",
  coop_id: string | null = null,
): Client => ({
  id,
  name,
  kind,
  coop_id,
  phone: "+639171234567",
  municipality_id: null,
  created_at: "",
  updated_at: "",
});
describe("normalizePhone", () => {
  it.each([
    "09171234567",
    "9171234567",
    "+639171234567",
    " 0917 123 4567 ",
    "+63 (917) 123-4567",
    "(0917) 123-4567",
  ])("normalizes %s", (input) => {
    const normalized = normalizePhone(input);
    expect(normalized).toBe("+639171234567");
    expect(normalizePhone(normalized!)).toBe(normalized);
  });
  it.each([
    "",
    "banana",
    "0917123456",
    "091712345678",
    "+19991234567",
    "08171234567",
    "63+9171234567",
    "0917--1234567",
    "(09171234567",
    "0917)1234567",
    "0917/1234567",
    "0917.1234567",
    "-09171234567",
    "09171234567-",
    "0917abc1234567",
  ])("rejects %s", (input) => expect(normalizePhone(input)).toBeNull());
});
describe("groupClients", () => {
  const clients = [
    client("c", "Harvest Co-op", "coop"),
    client("b", "Bea", "farmer", "c"),
    client("a", "Ana", "farmer", "c"),
    client("t", "Trader", "trader", "c"),
    client("u", "Unaffiliated", "buyer"),
  ];
  it("sorts members and counts each client once", () => {
    const result = groupClients(clients);
    expect(result.count).toBe(5);
    expect(result.groups[0].clients.map((c) => c.name)).toEqual([
      "Harvest Co-op",
      "Ana",
      "Bea",
      "Trader",
    ]);
    expect(clients[1].name).toBe("Bea");
  });
  it("keeps a contextual heading without counting it", () => {
    const result = groupClients(clients, "ANA");
    expect(result.count).toBe(1);
    expect(result.groups[0].coop?.name).toBe("Harvest Co-op");
    expect(result.groups[0].clients[0].name).toBe("Ana");
  });
  it("includes co-op members while respecting kind", () => {
    const result = groupClients(clients, "harvest", "farmer");
    expect(result.count).toBe(2);
    expect(result.groups[0].clients.map((c) => c.name)).toEqual(["Ana", "Bea"]);
  });
  it("finds full local and partial phones", () => {
    expect(groupClients(clients, "09171234567").count).toBe(5);
    expect(groupClients(clients, "4567").count).toBe(5);
    expect(groupClients(clients, "0917").count).toBe(5);
    expect(groupClients(clients, "missing123").count).toBe(0);
  });
  it("handles empty and unmatched results", () => {
    expect(groupClients([]).count).toBe(0);
    expect(groupClients(clients, "missing").groups).toEqual([]);
    expect(groupClients(clients, "", "coop").count).toBe(1);
  });
});

it("accepts the seed's readable UUIDs for references", () => {
  expect(
    clientSchema.safeParse({
      name: "Farmer",
      phone: "09171234567",
      kind: "farmer",
      municipality_id: "11111111-1111-4111-8111-111111111111",
      coop_id: "c0000000-0000-0000-0000-000000000001",
    }).success,
  ).toBe(true);
});

it("searches municipalities without including members from other towns", () => {
  const base = { phone: "+639171234567", created_at: "", updated_at: "" };
  const clients: Client[] = [
    {
      ...base,
      id: "coop",
      name: "Harvest",
      kind: "coop",
      coop_id: null,
      municipality_id: "pototan",
    },
    {
      ...base,
      id: "member",
      name: "Member",
      kind: "farmer",
      coop_id: "coop",
      municipality_id: "zarraga",
    },
  ];
  const result = groupClients(clients, "Pototan", "all", [
    { id: "pototan", name: "Pototan" },
    { id: "zarraga", name: "Zarraga" },
  ]);
  expect(result.count).toBe(1);
  expect(result.groups[0].clients[0].id).toBe("coop");
  expect(
    groupClients(clients, "ZARRAGA", "farmer", [
      { id: "zarraga", name: "Zarraga" },
    ]).count,
  ).toBe(1);
});
