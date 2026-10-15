import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/modules/accounts/auth", () => ({ requireRole: vi.fn() }));
vi.mock("@/modules/prescriptions/queries", () => ({ prescriptions: vi.fn() }));
vi.mock("./queries", () => ({
  notify: vi.fn(),
  notificationInbox: vi.fn(),
  readNotifications: vi.fn(),
}));
import { requireRole, type Staff } from "@/modules/accounts/auth";
import { prescriptions } from "@/modules/prescriptions/queries";
import {
  refreshNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "./actions";
import { notify, notificationInbox, readNotifications } from "./queries";
const id = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(requireRole).mockResolvedValue({ id, role: "encoder" } as Staff);
  vi.mocked(notificationInbox).mockResolvedValue({ items: [], unreadCount: 0 });
});

describe("staff inbox actions", () => {
  it("does not compute manager suggestions for an encoder", async () => {
    await refreshNotifications();
    expect(prescriptions).not.toHaveBeenCalled();
    expect(notificationInbox).toHaveBeenCalledWith(id);
  });
  it("creates alerts only for undecided overload and idle suggestions", async () => {
    vi.mocked(requireRole).mockResolvedValue({ id, role: "manager" } as Staff);
    vi.mocked(prescriptions).mockResolvedValue([
      {
        kind: "move_bookings",
        key: "overflow",
        title: "Day overloaded",
        decision: null,
      },
      { kind: "fill_idle", key: "idle", title: "Idle stretch", decision: null },
      {
        kind: "fill_idle",
        key: "dismissed",
        title: "Already decided",
        decision: "dismissed",
      },
      {
        kind: "mill_full_loads",
        key: "p1",
        title: "Full loads",
        decision: null,
      },
    ] as Awaited<ReturnType<typeof prescriptions>>);
    await refreshNotifications();
    expect(notify).toHaveBeenCalledTimes(2);
    expect(notify).toHaveBeenCalledWith({
      kind: "suggestion_created",
      entityId: "overflow",
      title: "Day overloaded",
    });
  });
  it("uses the authenticated identity for one or all read operations", async () => {
    await markNotificationRead(id);
    expect(readNotifications).toHaveBeenCalledWith(id, id);
    await markAllNotificationsRead();
    expect(readNotifications).toHaveBeenCalledWith(id);
  });
  it("rejects invalid notification IDs without writing", async () => {
    await expect(markNotificationRead("invalid")).rejects.toThrow();
    expect(readNotifications).not.toHaveBeenCalled();
  });
  it("requires authentication before any data access", async () => {
    vi.mocked(requireRole).mockRejectedValue(new Error("Unauthorized"));
    for (const action of [
      refreshNotifications,
      () => markNotificationRead(id),
      markAllNotificationsRead,
    ])
      await expect(action()).rejects.toThrow("Unauthorized");
    expect(readNotifications).not.toHaveBeenCalled();
    expect(notificationInbox).not.toHaveBeenCalled();
    expect(prescriptions).not.toHaveBeenCalled();
  });
  it("keeps the inbox available when suggestion discovery fails", async () => {
    vi.mocked(requireRole).mockResolvedValue({ id, role: "manager" } as Staff);
    vi.mocked(prescriptions).mockRejectedValue(new Error("Unavailable"));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await refreshNotifications()).toEqual({ items: [], unreadCount: 0 });
    log.mockRestore();
  });
});
