"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export function QueueFailure() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Alert>
      <AlertTitle>The gate queue couldn&apos;t load</AlertTitle>
      <AlertDescription>
        Try again. Nobody&apos;s place in line has changed.
        <Button
          variant="outline"
          disabled={pending}
          onClick={() => startTransition(() => router.refresh())}
        >
          {pending ? "Retrying…" : "Retry"}
        </Button>
      </AlertDescription>
    </Alert>
  );
}
