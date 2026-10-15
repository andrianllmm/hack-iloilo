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
  moveBooking: vi.fn(),
  notifyBookingConfirmation: vi.fn(),
  notifyBookingMoved: vi.fn(),
}));
import { requireRole } from "@/modules/accounts/auth";
import { findOrRegisterByPhone } from "@/modules/accounts/queries";
import { bookForClient, bookOnline, rescheduleBookingByStaff } from "./actions";
import { MAX_FLEX_DAYS } from "./logic";
import {
  bookingClient,
  createBooking,
  moveBooking,
  notifyBookingConfirmation,
  notifyBookingMoved,
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
  name: "Juan Dela Cruz",
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
  expect(findOrRegisterByPhone).toHaveBeenCalledWith("+639171234567", {
    name: "Juan Dela Cruz",
  });
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
it("rejects a blank name, an invalid phone or a past date online without saving", async () => {
  expect(await bookOnline({ ...webInput, name: "  " })).toMatchObject({
    status: "error",
    fieldErrors: { name: "Enter your name." },
  });
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

const moveInput = { ref: "K7P2QX", date: "2026-10-25", flexDays: 1 };
it("authenticates staff, moves without an ownership check and texts the client", async () => {
  const booking = { ref: "K7P2QX", scheduled_date: "2026-10-25" } as Awaited<
    ReturnType<typeof createBooking>
  >;
  vi.mocked(moveBooking).mockResolvedValue({
    status: "moved",
    booking,
    clientPhone: "+639171234567",
  });
  expect(await rescheduleBookingByStaff(moveInput)).toEqual({
    status: "moved",
    booking,
  });
  expect(vi.mocked(requireRole).mock.invocationCallOrder[0]).toBeLessThan(
    vi.mocked(moveBooking).mock.invocationCallOrder[0],
  );
  expect(moveBooking).toHaveBeenCalledWith("K7P2QX", "2026-10-25", 1);
  expect(notifyBookingMoved).toHaveBeenCalledWith(booking, "+639171234567");
});
it("rejects a past date or flex over the max without moving", async () => {
  expect(
    await rescheduleBookingByStaff({ ...moveInput, date: "2026-10-14" }),
  ).toMatchObject({
    status: "error",
    fieldErrors: { date: "Choose today or a later date." },
  });
  expect(
    await rescheduleBookingByStaff({
      ...moveInput,
      flexDays: MAX_FLEX_DAYS + 1,
    }),
  ).toMatchObject({
    status: "error",
    fieldErrors: { flexDays: `Flex days can be at most ${MAX_FLEX_DAYS}.` },
  });
  expect(moveBooking).not.toHaveBeenCalled();
});
it("reports bookings that are gone or no longer open without texting", async () => {
  vi.mocked(moveBooking).mockResolvedValue({ status: "not_movable" });
  expect(await rescheduleBookingByStaff(moveInput)).toMatchObject({
    status: "error",
    message: expect.stringContaining("Only confirmed bookings"),
  });
  vi.mocked(moveBooking).mockResolvedValue({ status: "not_found" });
  expect(await rescheduleBookingByStaff(moveInput)).toMatchObject({
    status: "error",
    message: expect.stringContaining("no longer exists"),
  });
  expect(notifyBookingMoved).not.toHaveBeenCalled();
});
it("does not move or text when staff authentication fails", async () => {
  vi.mocked(requireRole).mockRejectedValue(new Error("Unauthorized"));
  await expect(rescheduleBookingByStaff(moveInput)).rejects.toThrow(
    "Unauthorized",
  );
  expect(moveBooking).not.toHaveBeenCalled();
  expect(notifyBookingMoved).not.toHaveBeenCalled();
});
