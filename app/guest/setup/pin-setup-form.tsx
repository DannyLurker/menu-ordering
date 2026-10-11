// Guest PIN setup form (spec 0008, AC-2, AC-8). The guest confirms the
// stay, enters the one time setup code, and chooses a 6 digit PIN twice.
"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

function serverMessage(status: number, code: string | undefined, fallback: string): string {
  if (code === "WEAK_PIN") {
    return "Pick a harder 6 digit PIN, not a repeat or sequence. / Pilih PIN 6 digit yang lebih sulit, bukan angka berulang atau berurutan.";
  }
  if (code === "PIN_MISMATCH") {
    return "PIN entries differ. Type the same PIN twice. / Entri PIN berbeda. Ketik PIN yang sama dua kali.";
  }
  if (code === "STAY_LOCKED" || status === 423) {
    return "This stay is locked. Please contact the front desk. / Data ini terkunci. Hubungi resepsionis.";
  }
  if (status === 429) {
    return "Too many tries. Please contact the front desk. / Terlalu banyak percobaan. Hubungi resepsionis.";
  }
  if (status === 410 || code === "SETUP_EXPIRED") {
    return "This code is invalid or expired. Ask the front desk for a new one. / Kode tidak valid atau kedaluwarsa. Minta kode baru ke resepsionis.";
  }
  return fallback;
}

export function PinSetupForm({ initialStayId }: { initialStayId: string }) {
  const [stayId, setStayId] = useState(initialStayId);
  const [setupCode, setSetupCode] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (busy || done) return;
    setBusy(true);
    setMessage(null);
    setFailed(false);
    try {
      const res = await fetch("/api/stays/pin-setup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ stayId: stayId.trim(), setupCode: setupCode.trim(), newPin, confirmPin }),
      });
      const body = (await res.json().catch(() => null)) as { error?: { code?: string; message?: string } } | null;
      if (!res.ok) {
        setFailed(true);
        setMessage(
          body?.error?.message ??
            serverMessage(res.status, body?.error?.code, "Could not set the PIN. Try again. / PIN gagal diatur."),
        );
        return;
      }
      setDone(true);
      setMessage("PIN is set. You can now sign in to order from your room. / PIN sudah diatur. Anda kini dapat masuk untuk memesan.");
    } catch {
      setFailed(true);
      setMessage("Could not set the PIN. Check your connection. / Periksa koneksi Anda.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>PIN is set · PIN sudah diatur</CardTitle>
        </CardHeader>
        <CardContent>
          <p role="status" className="text-sm text-muted-foreground">
            {message}
          </p>
        </CardContent>
      </Card>
    );
  }

  const pinType = showPin ? "text" : "password";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Choose your PIN · Pilih PIN Anda</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <Input
            label="Stay id · Id menginap"
            required
            autoComplete="off"
            value={stayId}
            onChange={(e) => setStayId(e.target.value)}
          />
          <Input
            label="Setup code · Kode aktivasi"
            required
            autoComplete="off"
            autoCapitalize="characters"
            hint="8 letters and numbers from the front desk. / 8 huruf dan angka dari resepsionis."
            value={setupCode}
            onChange={(e) => setSetupCode(e.target.value.toUpperCase())}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="New 6 digit PIN · PIN baru 6 digit"
              required
              type={pinType}
              inputMode="numeric"
              maxLength={6}
              autoComplete="new-password"
              hint="Not a repeat or sequence like 111111 or 123456."
              value={newPin}
              onChange={(e) => setNewPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
            />
            <Input
              label="Confirm PIN · Konfirmasi PIN"
              required
              type={pinType}
              inputMode="numeric"
              maxLength={6}
              autoComplete="new-password"
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={showPin}
              onChange={(e) => setShowPin(e.target.checked)}
              className="h-4 w-4 accent-primary"
            />
            Show PIN · Tampilkan PIN
          </label>
          {message ? (
            <p role={failed ? "alert" : "status"} className={failed ? "text-sm text-brand-ink" : "text-sm text-muted-foreground"}>
              {message}
            </p>
          ) : null}
          <CardFooter className="p-0">
            <Button type="submit" disabled={busy} className="w-full sm:w-auto">
              {busy ? "Setting… · Menyimpan…" : "Set PIN · Atur PIN"}
            </Button>
          </CardFooter>
        </form>
      </CardContent>
    </Card>
  );
}
