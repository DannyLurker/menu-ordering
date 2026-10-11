// Stay PIN unlock form (spec 0004, AC-7). Desk or admin clears a PIN
// locked stay; the guest then mints again with a correct PIN.
"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function UnlockForm() {
  const [stayId, setStayId] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (busy || !stayId.trim()) return;
    setBusy(true);
    setMessage(null);
    setFailed(false);
    try {
      const res = await fetch(`/api/stays/${encodeURIComponent(stayId.trim())}/unlock`, { method: "POST" });
      if (!res.ok) {
        setFailed(true);
        setMessage(
          res.status === 404
            ? "Unknown stay. Check the id and try again. / Data menginap tidak dikenal."
            : "Could not unlock. Try again. / Tidak dapat membuka kunci.",
        );
        return;
      }
      setMessage("Stay unlocked. The guest can sign in with the PIN again. / Kunci PIN telah dibuka.");
      setStayId("");
    } catch {
      setFailed(true);
      setMessage("Could not unlock. Check your connection. / Periksa koneksi Anda.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3 border-t border-border pt-4">
      <h2 className="text-base font-semibold text-foreground">Unlock a PIN locked stay · Buka kunci PIN</h2>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <Input label="Stay id" required value={stayId} onChange={(e) => setStayId(e.target.value)} />
        </div>
        <Button type="submit" variant="quiet" disabled={busy || !stayId.trim()}>
          {busy ? "Unlocking…" : "Unlock · Buka kunci"}
        </Button>
      </div>
      {message ? (
        <p role={failed ? "alert" : "status"} className={failed ? "text-sm text-brand-ink" : "text-sm text-muted-foreground"}>
          {message}
        </p>
      ) : null}
    </form>
  );
}
