import type { BuyerType, Client, ClientKind, Municipality } from "./types";
/** Philippine mobile numbers, stored in E.164 form. */
export function normalizePhone(input: string): string | null {
  const text = input.trim();
  if (!/^\+?[\d\s()-]+$/.test(text)) return null;
  const unwrapped = text.replace(/\(\d+\)/g, "");
  if (/[()]/.test(unwrapped) || /--|^-|-$/.test(text.replace(/\s/g, "")))
    return null;
  const phone = text.replace(/[\s()-]/g, "");
  if (/^09\d{9}$/.test(phone)) return `+63${phone.slice(1)}`;
  if (/^9\d{9}$/.test(phone)) return `+63${phone}`;
  return /^\+639\d{9}$/.test(phone) ? phone : null;
}
export const clientKinds = ["farmer", "coop", "trader", "buyer"] as const;
export const kindLabels: Record<ClientKind, string> = {
  farmer: "Farmer",
  coop: "Co-op",
  trader: "Trader",
  buyer: "Buyer",
};
/** What kind of first-hand buyer a `buyer` client is (IRPC's Top Clients list). */
export const buyerTypes = [
  "wholesaler",
  "retailer",
  "institutional",
  "cooperative",
  "drop_point",
  "subsidy_program",
] as const;
export const buyerTypeLabels: Record<BuyerType, string> = {
  wholesaler: "Wholesaler",
  retailer: "Retailer",
  institutional: "Institutional",
  cooperative: "Cooperative",
  drop_point: "Municipal drop-point",
  subsidy_program: "₱20/kg program",
};
export type ClientGroup = { coop: Client | null; clients: Client[] };
/** Context headings do not contribute to the result count. */
export function groupClients(
  clients: Client[],
  search = "",
  kind: ClientKind | "all" = "all",
  municipalities: Municipality[] = [],
) {
  const query = search.trim().toLowerCase();
  const digits = /^[+\d\s()-]+$/.test(query) ? query.replace(/\D/g, "") : "";
  const phoneSearch = digits.startsWith("09") ? `63${digits.slice(1)}` : digits;
  const normalized = normalizePhone(query);
  const places = new Map(
    municipalities.map((place) => [place.id, place.name.toLowerCase()]),
  );
  const matches = (client: Client) =>
    !query ||
    client.name.toLowerCase().includes(query) ||
    (!!client.municipality_id &&
      !!places.get(client.municipality_id)?.includes(query)) ||
    (!!digits && client.phone.includes(normalized ?? phoneSearch));
  const allowed = (client: Client) => kind === "all" || client.kind === kind;
  const sorted = [...clients].sort(
    (a, b) =>
      a.name.localeCompare(b.name, "en", { sensitivity: "base" }) ||
      a.id.localeCompare(b.id),
  );
  const coops = sorted.filter((client) => client.kind === "coop");
  const coopIds = new Set(coops.map((coop) => coop.id));
  const groups: ClientGroup[] = [];
  for (const coop of coops) {
    const coopMatches = matches(coop);
    const coopNameMatches = !query || coop.name.toLowerCase().includes(query);
    const members = sorted.filter(
      (client) =>
        client.kind !== "coop" &&
        client.coop_id === coop.id &&
        allowed(client) &&
        (coopNameMatches || matches(client)),
    );
    const showCoop = allowed(coop) && coopMatches;
    if (showCoop || members.length)
      groups.push({ coop, clients: [...(showCoop ? [coop] : []), ...members] });
  }
  const others = sorted.filter(
    (client) =>
      client.kind !== "coop" &&
      (!client.coop_id || !coopIds.has(client.coop_id)) &&
      allowed(client) &&
      matches(client),
  );
  if (others.length) groups.push({ coop: null, clients: others });
  return {
    groups,
    count: groups.reduce((total, group) => total + group.clients.length, 0),
  };
}
