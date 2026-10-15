"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { decideOffer, withdrawOffer } from "../actions";

/** Accept / decline buttons. Render inside a manager-only gate. */
export function DecideButtons({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <div className="flex gap-2">
      <Button
        size="sm"
        disabled={pending}
        onClick={() => start(() => decideOffer(id, true))}
      >
        Accept
      </Button>
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() => start(() => decideOffer(id, false))}
      >
        Decline
      </Button>
    </div>
  );
}

/** Withdraw button. Available to any signed-in staff. */
export function WithdrawButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      size="sm"
      variant="ghost"
      disabled={pending}
      onClick={() => start(() => withdrawOffer(id))}
    >
      Withdraw
    </Button>
  );
}
