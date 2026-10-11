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

interface CancelModalProps {
  order: KitchenOrder | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCancelled: () => void;
  onError: (msg: string) => void;
}

const COMMON_REASONS = [
  "Out of ingredients · Bahan habis",
  "Kitchen closing · Dapur tutup",
  "Equipment maintenance · Perbaikan alat",
  "Guest requested · Tamu minta batal",
];

export function CancelModal({
  order,
  open,
  onOpenChange,
  onCancelled,
  onError,
}: CancelModalProps) {
  const [reason, setReason] = React.useState<string>("");
  const [loading, setLoading] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  function handleClose(nextOpen: boolean) {
    if (!nextOpen) {
      setErrorMsg(null);
      setReason("");
    }
    onOpenChange(nextOpen);
  }

  if (!order) return null;

  async function handleCancel(e: React.FormEvent) {
    e.preventDefault();
    if (!order) return;

    const trimmed = reason.trim();
    if (!trimmed) {
      setErrorMsg(
        "Please provide a reason for cancelling · Harap berikan alasan pembatalan",
      );
      return;
    }
    if (trimmed.length > 200) {
      setErrorMsg(
        "Reason cannot exceed 200 characters · Alasan tidak boleh melebihi 200 karakter",
      );
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch(`/api/kitchen/orders/${order.id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: trimmed }),
      });

      const data = await res.json();
      if (!res.ok) {
        const msg =
          data.error?.message ||
          "Failed to cancel order · Gagal membatalkan pesanan";
        setErrorMsg(msg);
        onError(msg);
        if (res.status === 409) {
          onCancelled(); // Refetch
          onOpenChange(false);
        }
        return;
      }

      onCancelled();
      onOpenChange(false);
    } catch {
      const err =
        "Network error while cancelling order · Terjadi kesalahan jaringan saat membatalkan pesanan";
      setErrorMsg(err);
      onError(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogTitle className="text-xl font-bold text-destructive">
          Cancel Order · Batalkan Pesanan
        </DialogTitle>
        <DialogDescription>
          Room {order.roomNumber} · Status: {order.status}
        </DialogDescription>

        <form onSubmit={handleCancel} className="mt-4 space-y-4">
          <div>
            <label
              htmlFor="cancel-reason-textarea"
              className="block text-sm font-medium text-foreground mb-2"
            >
              Cancellation Reason · Alasan Pembatalan
            </label>

            {/* Quick choices */}
            <div className="flex flex-wrap gap-2 mb-3">
              {COMMON_REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setReason(r)}
                  className={`text-xs px-2.5 py-1 rounded-md border text-left transition-colors ${
                    reason === r
                      ? "border-destructive bg-destructive/10 text-destructive font-semibold"
                      : "border-border bg-secondary text-foreground hover:bg-muted"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>

            <textarea
              id="cancel-reason-textarea"
              rows={3}
              maxLength={200}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Out of stock / e.g. Stok habis..."
              className="w-full rounded-md border border-border bg-background p-3 text-sm focus-visible:outline-2 focus-visible:outline-ring"
              required
            />
            <div className="flex justify-end text-xs text-muted-foreground mt-1">
              {reason.length}/200
            </div>
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
              Back · Kembali
            </Button>
            <Button
              type="submit"
              variant="danger"
              disabled={loading || !reason.trim()}
            >
              {loading ? (
                <>
                  <Spinner className="size-4 mr-2" />
                  Cancelling... · Membatalkan...
                </>
              ) : (
                "Confirm Cancel · Konfirmasi Batal"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
