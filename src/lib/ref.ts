// No 0/O or 1/I, so refs survive being read aloud or typed on a phone.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** A random 6-character booking or offer ref, e.g. `K7P2QX`. */
export function newRef(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  // 32 letters divide 256 evenly, so `% 32` has no bias.
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}
