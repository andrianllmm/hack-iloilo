import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/modules/accounts/auth", () => ({ requireRole: vi.fn() }));
vi.mock("@/lib/dates", () => ({ todayManila: () => "2026-10-15" }));
vi.mock("./queries", () => ({
  bookingClient: vi.fn(),
  createBooking: vi.fn(),
  cancelBooking: vi.fn(),
  notifyBookingConfirmation: vi.fn(),
}));
import { requireRole } from "@/modules/accounts/auth";
import { bookForClient } from "./actions";
import {
  bookingClient,
  createBooking,
  notifyBookingConfirmation,
} from "./queries";

beforeEach(() => vi.resetAllMocks());
it("authenticates staff, saves, and confirms to the selected client", async () => {
  const client = {
    id: "11111111-1111-4111-8111-111111111111",
    phone: "+639171234567",
    name: "Farmer",
    kind: "farmer" as const,
  };
  vi.mocked(bookingClient).mockResolvedValue(client);
  const booking = { ref: "ABC123" } as Awaited<
    ReturnType<typeof createBooking>
  >;
  vi.mocked(createBooking).mockResolvedValue(booking);
  expect(
    await bookForClient({
      clientId: client.id,
      service: "drying",
      estKg: 5000,
      preferredDate: "2026-10-20",
      flexDays: 0,
    }),
  ).toEqual({ status: "created", booking });
  expect(requireRole).toHaveBeenCalledOnce();
  expect(vi.mocked(requireRole).mock.invocationCallOrder[0]).toBeLessThan(
    vi.mocked(createBooking).mock.invocationCallOrder[0],
  );
  expect(createBooking).toHaveBeenCalledWith(
    expect.objectContaining({ channel: "staff", bookedByPhone: client.phone }),
  );
  expect(notifyBookingConfirmation).toHaveBeenCalledWith(booking, client.phone);
});
it("does not save or notify when staff authentication fails", async () => {
  vi.mocked(requireRole).mockRejectedValue(new Error("Unauthorized"));
  await expect(bookForClient({})).rejects.toThrow("Unauthorized");
  expect(createBooking).not.toHaveBeenCalled();
  expect(notifyBookingConfirmation).not.toHaveBeenCalled();
});
