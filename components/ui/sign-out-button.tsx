// Staff sign out button (spec 0004). Client side: ends the BetterAuth
// session, then lands back on sign in.
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { Button } from "./button";

export function SignOutButton({ label = "Sign out" }: { label?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onClick(): Promise<void> {
    setBusy(true);
    try {
      await authClient.signOut();
    } finally {
      router.push("/sign-in");
      router.refresh();
    }
  }

  return (
    <Button type="button" variant="quiet" onClick={onClick} disabled={busy}>
      {busy ? "Signing out…" : label}
    </Button>
  );
}
