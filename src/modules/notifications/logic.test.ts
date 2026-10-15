import { expect, it } from "vitest";
import { notificationPolicies, unreadLabel } from "./logic";
it("restricts offers and suggestions to managers with the appropriate destinations", () => {
  expect(notificationPolicies.sell_offer_created).toEqual({
    role: "manager",
    href: "/buying",
  });
  expect(notificationPolicies.suggestion_created).toEqual({
    role: "manager",
    href: "/suggestions",
  });
  for (const [kind, policy] of Object.entries(notificationPolicies))
    if (!["sell_offer_created", "suggestion_created"].includes(kind))
      expect(policy.role).toBeNull();
});
it("caps the displayed count without changing the actual count", () => {
  expect(unreadLabel(0)).toBe("0");
  expect(unreadLabel(99)).toBe("99");
  expect(unreadLabel(100)).toBe("99+");
});
