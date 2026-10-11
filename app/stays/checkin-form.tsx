// Desk check in form (spec 0008, AC-1, AC-8). Creates the stay and shows
// the one time setup code exactly once, with a copy action for the guest.
"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { copyText, guestSetupLink } from "@/lib/copy-text";

interface CreatedStay {
  stayId: string;
  roomNumber: string;
  setupCode: string;
  setupExpiresAt: string;
  duplicate: boolean;
}

function todayDay(): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = `${now.getUTCMonth() + 1}`.padStart(2, "0");
  const day = `${now.getUTCDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function CheckinForm() {
  const [roomNumber, setRoomNumber] = useState("");
  const [guestName, setGuestName] = useState("");
  const [extraNames, setExtraNames] = useState("");
  const [checkIn, setCheckIn] = useState(todayDay());
  const [checkOut, setCheckOut] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [created, setCreated] = useState<CreatedStay | null>(null);
  const [copied, setCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage(null);
    setFailed(false);
    setCreated(null);
    setCopied(false);
    setLinkCopied(false);
    try {
      const res = await fetch("/api/stays", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          roomNumber: roomNumber.trim(),
          guestName: guestName.trim(),
          extraNames: extraNames.split(",").map((n) => n.trim()).filter(Boolean),
          checkIn: checkIn || undefined,
          checkOut,
        }),
      });
      const body = (await res.json().catch(() => null)) as
        | (CreatedStay & { ok?: boolean; error?: { message?: string } })
        | null;
      if (!res.ok || !body || !("stayId" in body)) {
        setFailed(true);
        setMessage(
          (body && "error" in body && body.error?.message) || "Could not check in. Try again. / Check in gagal.",
        );
        return;
      }
      setCreated({
        stayId: body.stayId,
        roomNumber: body.roomNumber,
        setupCode: body.setupCode,
        setupExpiresAt: body.setupExpiresAt,
        duplicate: body.duplicate,
      });
      setRoomNumber("");
      setGuestName("");
      setExtraNames("");
      setCheckOut("");
    } catch {
      setFailed(true);
      setMessage("Could not check in. Check your connection. / Periksa koneksi Anda.");
    } finally {
      setBusy(false);
    }
  }

  async function onCopy(): Promise<void> {
    if (!created) return;
    setCopied(await copyText(created.setupCode));
  }

  async function onCopyLink(): Promise<void> {
    if (!created) return;
    setLinkCopied(await copyText(guestSetupLink(window.location.origin, created.stayId)));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Check in a guest · Daftarkan tamu</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Room · Kamar" required value={roomNumber} onChange={(e) => setRoomNumber(e.target.value)} />
            <Input label="Guest name · Nama tamu" required value={guestName} onChange={(e) => setGuestName(e.target.value)} />
            <Input
              label="Extra guests, comma separated · Tamu tambahan, pisahkan koma"
              value={extraNames}
              onChange={(e) => setExtraNames(e.target.value)}
            />
            <div className="grid grid-cols-2 gap-4">
              <Input label="Check in · Masuk" type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} />
              <Input label="Check out · Keluar" type="date" required value={checkOut} onChange={(e) => setCheckOut(e.target.value)} />
            </div>
          </div>
          {message ? (
            <p role="alert" className="text-sm text-brand-ink">
              {message}
            </p>
          ) : null}
          <div>
            <Button type="submit" disabled={busy}>
              {busy ? "Checking in… · Mendaftarkan…" : "Check in · Daftarkan"}
            </Button>
          </div>
        </form>
        {created ? (
          <div role="status" className="flex flex-col gap-2 rounded-lg border border-border bg-muted p-4">
            <p className="text-sm font-medium text-foreground">
              {created.duplicate
                ? "Already checked in, fresh code below. · Sudah terdaftar, kode baru di bawah."
                : "Checked in. Share this code once. · Terdaftar. Bagikan kode ini sekali saja."}
            </p>
            <p className="text-glance font-bold tracking-widest text-foreground" aria-label="Setup code · Kode aktivasi">
              {created.setupCode}
            </p>
            <p className="text-sm text-muted-foreground">
              Room {created.roomNumber} · valid 15 minutes · berlaku 15 menit
            </p>
            <p className="text-sm text-muted-foreground">
              Guest link · Tautan tamu:{" "}
              <span className="break-all font-medium text-foreground">
                {guestSetupLink(window.location.origin, created.stayId)}
              </span>
            </p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="quiet" onClick={onCopy}>
                {copied ? "Copied · Tersalin" : "Copy code · Salin kode"}
              </Button>
              <Button type="button" variant="quiet" onClick={onCopyLink}>
                {linkCopied ? "Link copied · Tautan tersalin" : "Copy guest link · Salin tautan tamu"}
              </Button>
            </div>
          </div>
        ) : null}
        {failed && !message ? (
          <p role="alert" className="text-sm text-brand-ink">
            Could not check in. Try again. / Check in gagal.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
