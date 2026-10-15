"use client";

import { useTransition } from "react";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cancelOrderByStaff, decideOrder, markPickedUp } from "../actions";
import type { OrderStatus } from "../logic";

/**
 * Row actions for an open request: the next step up front, the rest in a menu.
 * Accept and decline are manager only; any staff marks pickup or cancels.
 */
export function OrderActions({
  id,
  status,
  isManager,
}: {
  id: string;
  status: OrderStatus;
  isManager: boolean;
}) {
  const [pending, start] = useTransition();
  return (
    <div className="flex items-center justify-end gap-1">
      {status === "requested" && isManager ? (
        <Button
          size="sm"
          disabled={pending}
          onClick={() => start(() => decideOrder(id, true))}
        >
          Accept
        </Button>
      ) : null}
      {status === "accepted" ? (
        <Button
          size="sm"
          disabled={pending}
          onClick={() => start(() => markPickedUp(id))}
        >
          Picked up
        </Button>
      ) : null}
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              size="icon-sm"
              variant="ghost"
              disabled={pending}
              aria-label="More actions"
            />
          }
        >
          <MoreHorizontal />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {status === "requested" && isManager ? (
            <DropdownMenuItem
              onClick={() => start(() => decideOrder(id, false))}
            >
              Decline
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem onClick={() => start(() => cancelOrderByStaff(id))}>
            Cancel
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
