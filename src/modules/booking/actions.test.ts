import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/modules/accounts/auth", () => ({ requireRole: vi.fn() }));
vi.mock("@/lib/dates", () => ({ todayManila: () => "2026-10-15" }));
vi.mock("@/modules/accounts/queries", () => ({
  findOrRegisterByPhone: vi.fn(),
}));
vi.mock("./queries", () => ({
  bookingClient: vi.fn(),
  createBooking: vi.fn(),
  cancelBooking: vi.fn(),
  notifyBookingConfirmation: vi.fn(),
}));
import { requireRole } from "@/modules/accounts/auth";
import { findOrRegisterByPhone } from "@/modules/accounts/queries";
import { bookForClient, bookOnline } from "./actions";
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

const webInput = {
  phone: "0917 123 4567",
  service: "drying",
  estKg: 5000,
  preferredDate: "2026-10-20",
  flexDays: 2,
};
it("books online without staff auth, by and for the entered phone", async () => {
  const client = { id: "client-1" } as Awaited<
    ReturnType<typeof findOrRegisterByPhone>
  >;
  vi.mocked(findOrRegisterByPhone).mockResolvedValue(client);
  const booking = {
    id: "booking-1",
    ref: "ABC123",
    service: "drying",
    est_kg: 5000,
    scheduled_date: "2026-10-20",
  } as Awaited<ReturnType<typeof createBooking>>;
  vi.mocked(createBooking).mockResolvedValue(booking);
  expect(await bookOnline(webInput)).toEqual({
    status: "created",
    booking: {
      ref: "ABC123",
      service: "drying",
      est_kg: 5000,
      scheduled_date: "2026-10-20",
    },
  });
  expect(requireRole).not.toHaveBeenCalled();
  expect(findOrRegisterByPhone).toHaveBeenCalledWith("+639171234567");
  expect(createBooking).toHaveBeenCalledWith({
    clientId: "client-1",
    service: "drying",
    estKg: 5000,
    preferredDate: "2026-10-20",
    flexDays: 2,
    channel: "sms",
    bookedByPhone: "+639171234567",
  });
  expect(notifyBookingConfirmation).toHaveBeenCalledWith(
    booking,
    "+639171234567",
  );
});
it("rejects an invalid phone or a past date online without saving", async () => {
  expect(await bookOnline({ ...webInput, phone: "12345" })).toMatchObject({
    status: "error",
    fieldErrors: { phone: "Enter a valid Philippine mobile number." },
  });
  expect(
    await bookOnline({ ...webInput, preferredDate: "2026-10-14" }),
  ).toMatchObject({
    status: "error",
    fieldErrors: { preferredDate: "Choose today or a later date." },
  });
  expect(findOrRegisterByPhone).not.toHaveBeenCalled();
  expect(createBooking).not.toHaveBeenCalled();
});
