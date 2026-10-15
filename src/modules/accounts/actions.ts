"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireRole } from "./auth";
import { clientSchema, type ClientInput } from "./client-schema";
import {
  ClientInputError,
  deleteClientRecord,
  registerClientRecord,
  updateClientRecord,
} from "./queries";
import type { Client } from "./types";
import { createClient } from "@/lib/supabase/server";

const credentials = z.object({
  email: z.email(),
  password: z.string().min(1),
});

export type SignInState = { error?: string } | undefined;

export async function signIn(
  _prev: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const parsed = credentials.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Enter your email and password." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: "Wrong email or password." };

  redirect("/capacity");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export type SaveClientResult =
  | { status: "created" | "updated" | "existing"; client: Client }
  | {
      status: "error";
      message?: string;
      fieldErrors?: Partial<Record<keyof ClientInput, string>>;
    };

export async function saveClient(
  input: unknown,
  id?: string,
): Promise<SaveClientResult> {
  await requireRole();
  const parsed = clientSchema.safeParse(input);
  if (!parsed.success) {
    return {
      status: "error",
      fieldErrors: Object.fromEntries(
        parsed.error.issues.map((issue) => [issue.path[0], issue.message]),
      ),
    };
  }
  if (id !== undefined && !z.guid().safeParse(id).success)
    return {
      status: "error",
      message: "Invalid client. Refresh the directory.",
    };
  try {
    if (id) {
      const client = await updateClientRecord(id, parsed.data);
      revalidatePath("/clients");
      return { status: "updated", client };
    }
    const result = await registerClientRecord(parsed.data.phone, parsed.data);
    revalidatePath("/clients");
    return {
      status: result.created ? "created" : "existing",
      client: result.client,
    };
  } catch (error) {
    if (error instanceof ClientInputError)
      return { status: "error", fieldErrors: { [error.field]: error.message } };
    console.error("Unable to save client", error);
    return {
      status: "error",
      message: "Unable to save the client. Please try again.",
    };
  }
}

export type DeleteClientResult =
  { status: "deleted" } | { status: "error"; message: string };

export async function deleteClient(id: string): Promise<DeleteClientResult> {
  await requireRole();
  if (!z.guid().safeParse(id).success)
    return {
      status: "error",
      message: "Invalid client. Refresh the directory.",
    };
  try {
    await deleteClientRecord(id);
    revalidatePath("/clients");
    return { status: "deleted" };
  } catch (error) {
    if (error instanceof ClientInputError)
      return { status: "error", message: error.message };
    console.error("Unable to delete client", error);
    return {
      status: "error",
      message: "Unable to delete the client. Please try again.",
    };
  }
}
