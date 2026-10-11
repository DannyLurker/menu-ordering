// Desk reissue button (spec 0008, AC-6). Shows the fresh setup code once
// inline after a successful reissue, plus the guest setup link the desk
// can copy and share; the old code stops working at once.
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { copyText, guestSetupLink } from "@/lib/copy-text";

export function ReissueButton({ stayId }: { stayId: string }) {
  const [code, setCode] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onReissue(): Promise<void> {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    try {
      const res = await fetch(`/api/stays/${encodeURIComponent(stayId)}/reissue`, { method: "POST" });
      const body = (await res.json().catch(() => null)) as { setupCode?: string } | null;
      if (!res.ok || !body?.setupCode) {
        setFailed(true);
        return;
      }
      setCode(body.setupCode);
      setLinkCopied(false);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  async function onCopyLink(): Promise<void> {
    setLinkCopied(await copyText(guestSetupLink(window.location.origin, stayId)));
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="quiet" disabled={busy} onClick={onReissue}>
          {busy ? "Reissuing…" : "Reissue code · Kode baru"}
        </Button>
        <Button type="button" variant="quiet" onClick={onCopyLink}>
          {linkCopied ? "Link copied · Tautan tersalin" : "Copy guest link · Salin tautan"}
        </Button>
      </div>
      {code ? (
        <p role="status" className="text-sm font-semibold tracking-widest text-foreground">
          {code}
        </p>
      ) : null}
      {failed ? (
        <p role="alert" className="text-sm text-brand-ink">
          Could not reissue. Try again. / Gagal membuat kode baru.
        </p>
      ) : null}
    </div>
  );
}
