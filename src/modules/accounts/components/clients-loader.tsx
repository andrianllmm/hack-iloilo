import { requireRole } from "../auth";
import { clientsDirectory, municipalities } from "../queries";
import { ClientsDirectory } from "./clients-directory";
import { DirectoryFailure } from "./directory-failure";

export async function ClientsLoader() {
  await requireRole();
  let directory;
  try {
    directory = await Promise.all([clientsDirectory(), municipalities()]);
  } catch (error) {
    console.error("Unable to load client directory", error);
  }
  return directory ? (
    <ClientsDirectory clients={directory[0]} municipalities={directory[1]} />
  ) : (
    <DirectoryFailure />
  );
}
