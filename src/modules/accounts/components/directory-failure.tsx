"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export function DirectoryFailure() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Alert>
      <AlertTitle>Unable to load clients</AlertTitle>
      <AlertDescription>
        Please try loading the directory again.
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
