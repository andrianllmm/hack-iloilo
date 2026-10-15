import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ db: vi.fn() }));
vi.mock("@/modules/accounts/auth", () => ({ requireRole: vi.fn() }));
vi.mock("@/lib/dates", () => ({ todayManila: () => "2026-10-15" }));
vi.mock("@/modules/accounts/queries", () => ({
  findOrRegisterByPhone: vi.fn(),
  ClientInputError: class extends Error {
    constructor(
      public field: string,
      message: string,
    ) {
      super(message);
    }
  },
}));
vi.mock("./queries", () => ({
  createOffer: vi.fn(),
  notifyOfferRecorded: vi.fn(),
}));
import { revalidatePath } from "next/cache";
import { requireRole } from "@/modules/accounts/auth";
import {
  ClientInputError,
  findOrRegisterByPhone,
} from "@/modules/accounts/queries";
import { offerOnline } from "./actions";
import { createOffer, notifyOfferRecorded } from "./queries";

beforeEach(() => vi.resetAllMocks());

const webInput = {
  name: "Juan Dela Cruz",
  phone: "0917 123 4567",
  municipalityId: "muni-1",
  estKg: 3000,
  varietyId: "variety-1",
  harvestDate: "2026-10-20",
};

it("records an offer online without staff auth, for the entered phone", async () => {
  const client = { id: "client-1" } as Awaited<
    ReturnType<typeof findOrRegisterByPhone>
  >;
  vi.mocked(findOrRegisterByPhone).mockResolvedValue(client);
  const offer = {
    id: "offer-1",
    ref: "ABC123",
    status: "offered",
    est_kg: 3000,
    harvest_date: "2026-10-20",
  } as Awaited<ReturnType<typeof createOffer>>;
  vi.mocked(createOffer).mockResolvedValue(offer);
  expect(await offerOnline(webInput)).toEqual({
    status: "created",
    offer: { ref: "ABC123", est_kg: 3000, harvest_date: "2026-10-20" },
  });
  expect(requireRole).not.toHaveBeenCalled();
  expect(findOrRegisterByPhone).toHaveBeenCalledWith("+639171234567", {
    name: "Juan Dela Cruz",
    municipality_id: "muni-1",
  });
  expect(createOffer).toHaveBeenCalledWith({
    clientId: "client-1",
    varietyId: "variety-1",
    estKg: 3000,
    harvestDate: "2026-10-20",
    bookedByPhone: "+639171234567",
  });
  expect(notifyOfferRecorded).toHaveBeenCalledWith(offer, "+639171234567");
  expect(revalidatePath).toHaveBeenCalledWith("/buying");
});

it("records a blank variety as unknown and accepts today's harvest date", async () => {
  vi.mocked(findOrRegisterByPhone).mockResolvedValue({
    id: "client-1",
  } as Awaited<ReturnType<typeof findOrRegisterByPhone>>);
  vi.mocked(createOffer).mockResolvedValue({
    ref: "ABC123",
  } as Awaited<ReturnType<typeof createOffer>>);
  await offerOnline({ ...webInput, varietyId: "", harvestDate: "2026-10-15" });
  expect(createOffer).toHaveBeenCalledWith(
    expect.objectContaining({ varietyId: null, harvestDate: "2026-10-15" }),
  );
});

it("shows field errors and saves nothing for invalid input", async () => {
  expect(await offerOnline({ ...webInput, name: "  " })).toMatchObject({
    status: "error",
    fieldErrors: { name: "Enter your name." },
  });
  expect(await offerOnline({ ...webInput, phone: "12345" })).toMatchObject({
    status: "error",
    fieldErrors: { phone: "Enter a valid Philippine mobile number." },
  });
  expect(await offerOnline({ ...webInput, municipalityId: "" })).toMatchObject({
    status: "error",
    fieldErrors: { municipalityId: "Choose your municipality." },
  });
  expect(await offerOnline({ ...webInput, estKg: 0 })).toMatchObject({
    status: "error",
    fieldErrors: { estKg: "Enter more than 0 kg." },
  });
  expect(await offerOnline({ ...webInput, estKg: 12.5 })).toMatchObject({
    status: "error",
    fieldErrors: { estKg: "Enter whole kilograms." },
  });
  expect(await offerOnline({ ...webInput, harvestDate: "" })).toMatchObject({
    status: "error",
    fieldErrors: { harvestDate: "Choose a harvest date." },
  });
  expect(
    await offerOnline({ ...webInput, harvestDate: "2026-10-14" }),
  ).toMatchObject({
    status: "error",
    fieldErrors: { harvestDate: "Choose today or a later date." },
  });
  expect(findOrRegisterByPhone).not.toHaveBeenCalled();
  expect(createOffer).not.toHaveBeenCalled();
  expect(notifyOfferRecorded).not.toHaveBeenCalled();
});

it("reports an unknown municipality as a field error without saving", async () => {
  vi.mocked(findOrRegisterByPhone).mockRejectedValue(
    new ClientInputError("municipality_id", "Choose an existing municipality."),
  );
  expect(await offerOnline(webInput)).toEqual({
    status: "error",
    fieldErrors: { municipalityId: "Choose your municipality." },
  });
  expect(createOffer).not.toHaveBeenCalled();
});

it("returns a retry message when saving fails", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.mocked(findOrRegisterByPhone).mockResolvedValue({
    id: "client-1",
  } as Awaited<ReturnType<typeof findOrRegisterByPhone>>);
  vi.mocked(createOffer).mockRejectedValue(new Error("db down"));
  expect(await offerOnline(webInput)).toEqual({
    status: "error",
    message: "Unable to save the offer. Please try again.",
  });
  expect(notifyOfferRecorded).not.toHaveBeenCalled();
});
