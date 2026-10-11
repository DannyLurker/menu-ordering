"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { KitchenOrder } from "../kitchen.types";

interface VerifyModalProps {
  order: KitchenOrder | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onVerified: () => void;
  onError: (msg: string) => void;
}

const PRESET_MINUTES = [10, 15, 20, 30, 45, 60];

export function VerifyModal({
  order,
  open,
  onOpenChange,
  onVerified,
  onError,
}: VerifyModalProps) {
  const [eta, setEta] = React.useState<number>(20);
  const [loading, setLoading] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  function handleClose(nextOpen: boolean) {
    if (!nextOpen) {
      setErrorMsg(null);
      setEta(20);
    }
    onOpenChange(nextOpen);
  }

  if (!order) return null;

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!order) return;

    if (eta < 1 || eta > 120) {
      setErrorMsg(
        "Estimated minutes must be between 1 and 120 · Estimasi menit harus antara 1 dan 120",
      );
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch(`/api/kitchen/orders/${order.id}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ etaMinutes: eta }),
      });

      const data = await res.json();
      if (!res.ok) {
        const msg =
          data.error?.message ||
          "Failed to verify order · Gagal memverifikasi pesanan";
        setErrorMsg(msg);
        onError(msg);
        if (res.status === 409) {
          onVerified(); // Refetch to update board
          onOpenChange(false);
        }
        return;
      }

      onVerified();
      onOpenChange(false);
    } catch {
      const err =
        "Network error while verifying order · Terjadi kesalahan jaringan saat memverifikasi pesanan";
      setErrorMsg(err);
      onError(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogTitle className="text-xl font-bold">
          Verify Order · Verifikasi Pesanan
        </DialogTitle>
        <DialogDescription>
          Room {order.roomNumber} · Kamar {order.roomNumber}
        </DialogDescription>

        <form onSubmit={handleVerify} className="mt-4 space-y-4">
          <div>
            <label
              htmlFor="verify-eta-input"
              className="block text-sm font-medium text-foreground mb-2"
            >
              Estimated Time (Minutes) · Estimasi Waktu (Menit)
            </label>

            {/* Quick preset buttons */}
            <div className="flex flex-wrap gap-2 mb-3">
              {PRESET_MINUTES.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setEta(m)}
                  className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
                    eta === m
                      ? "border-primary bg-primary text-primary-foreground font-semibold"
                      : "border-border bg-secondary text-foreground hover:bg-muted"
                  }`}
                >
                  {m} min
                </button>
              ))}
            </div>

            <input
              id="verify-eta-input"
              type="number"
              min={1}
              max={120}
              value={eta}
              onChange={(e) => setEta(parseInt(e.target.value, 10) || 0)}
              className="w-full min-h-11 rounded-md border border-input bg-background px-3 text-lg font-semibold focus-visible:outline-2 focus-visible:outline-ring"
              required
            />
          </div>

          {errorMsg && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive font-medium">
              {errorMsg}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="quiet"
              onClick={() => handleClose(false)}
              disabled={loading}
            >
              Cancel · Batal
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={loading || eta < 1 || eta > 120}
            >
              {loading ? (
                <>
                  <Spinner className="size-4 mr-2" />
                  Saving... · Menyimpan...
                </>
              ) : (
                "Start Preparing · Mulai Memasak"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
