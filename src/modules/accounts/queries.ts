import "server-only";
import { db } from "@/lib/supabase/admin";
import { clientSchema, type ClientInput } from "./client-schema";
import { normalizePhone } from "./logic";
import type { Client, ClientDefaults, Municipality } from "./types";
export type { Client, ClientDefaults } from "./types";
export class ClientInputError extends Error {
  constructor(
    public field: keyof ClientInput,
    message: string,
  ) {
    super(message);
  }
}
export async function clientsDirectory(): Promise<Client[]> {
  const clients: Client[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await db()
      .from("clients")
      .select()
      .order("id")
      .range(offset, offset + 999);
    if (error) throw error;
    clients.push(...data);
    if (data.length < 1000) return clients;
  }
}
export async function municipalities(): Promise<Municipality[]> {
  const { data, error } = await db()
    .from("municipalities")
    .select("id, name")
    .order("name");
  if (error) throw error;
  return data;
}
async function byPhone(phone: string) {
  const { data, error } = await db()
    .from("clients")
    .select()
    .eq("phone", phone)
    .maybeSingle();
  if (error) throw error;
  return data;
}
async function validateRelations(input: ClientInput, id?: string) {
  if (input.municipality_id) {
    const { data, error } = await db()
      .from("municipalities")
      .select("id")
      .eq("id", input.municipality_id)
      .maybeSingle();
    if (error) throw error;
    if (!data)
      throw new ClientInputError(
        "municipality_id",
        "Choose an existing municipality.",
      );
  }
  if (input.coop_id) {
    if (input.coop_id === id)
      throw new ClientInputError(
        "coop_id",
        "A client cannot belong to itself.",
      );
    const { data, error } = await db()
      .from("clients")
      .select("id")
      .eq("id", input.coop_id)
      .eq("kind", "coop")
      .maybeSingle();
    if (error) throw error;
    if (!data)
      throw new ClientInputError("coop_id", "Choose an existing co-op.");
  }
  if (id && input.kind !== "coop") {
    const { data, error } = await db()
      .from("clients")
      .select("id")
      .eq("coop_id", id)
      .limit(1);
    if (error) throw error;
    if (data.length)
      throw new ClientInputError(
        "kind",
        "Reassign this co-op's members before changing its kind.",
      );
  }
}
/** Shared by staff registration and SMS; existing rows are never overwritten. */
export async function registerClientRecord(
  phone: string,
  defaults: ClientDefaults = {},
): Promise<{ client: Client; created: boolean }> {
  const normalized = normalizePhone(phone);
  if (!normalized)
    throw new ClientInputError(
      "phone",
      "Enter a valid Philippine mobile number.",
    );
  const existing = await byPhone(normalized);
  if (existing) return { client: existing, created: false };
  const input = clientSchema.parse({
    name: `SMS ${normalized.slice(-4)}`,
    kind: "farmer",
    municipality_id: null,
    coop_id: null,
    ...defaults,
    phone: normalized,
  });
  await validateRelations(input);
  const { data, error } = await db()
    .from("clients")
    .insert(input)
    .select()
    .single();
  if (error?.code === "23505") {
    const winner = await byPhone(normalized);
    if (winner) return { client: winner, created: false };
  }
  if (error) throw error;
  return { client: data!, created: true };
}
/** The client with this phone, without registering one. */
export async function findClientByPhone(phone: string): Promise<Client | null> {
  const normalized = normalizePhone(phone);
  return normalized ? byPhone(normalized) : null;
}
export async function findOrRegisterByPhone(
  phone: string,
  defaults?: ClientDefaults,
): Promise<Client> {
  return (await registerClientRecord(phone, defaults)).client;
}
export async function updateClientRecord(
  id: string,
  input: ClientInput,
): Promise<Client> {
  const parsed = clientSchema.parse(input);
  await validateRelations(parsed, id);
  const { data, error } = await db()
    .from("clients")
    .update({ ...parsed, phone: normalizePhone(parsed.phone)! })
    .eq("id", id)
    .select()
    .maybeSingle();
  if (error?.code === "23505")
    throw new ClientInputError(
      "phone",
      "That phone belongs to another client.",
    );
  if (error) throw error;
  if (!data)
    throw new ClientInputError(
      "name",
      "This client no longer exists. Refresh the directory.",
    );
  return data;
}

/** Deletes only unreferenced clients; foreign keys preserve operational history. */
export async function deleteClientRecord(id: string): Promise<void> {
  const { data, error } = await db()
    .from("clients")
    .delete()
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error?.code === "23503")
    throw new ClientInputError(
      "name",
      "This client has linked records or co-op members and cannot be deleted.",
    );
  if (error) throw error;
  if (!data)
    throw new ClientInputError(
      "name",
      "This client no longer exists. Refresh the directory.",
    );
}
