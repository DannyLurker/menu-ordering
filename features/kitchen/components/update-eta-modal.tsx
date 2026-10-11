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

interface UpdateEtaModalProps {
  order: KitchenOrder | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
  onError: (msg: string) => void;
}

const PRESET_MINUTES = [5, 10, 15, 20, 30, 45, 60];

export function UpdateEtaModal({
  order,
  open,
  onOpenChange,
  onUpdated,
  onError,
}: UpdateEtaModalProps) {
  const [eta, setEta] = React.useState<number>(order?.etaMinutes ?? 20);
  const [loading, setLoading] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  function handleClose(nextOpen: boolean) {
    if (!nextOpen) {
      setErrorMsg(null);
      if (order?.etaMinutes) setEta(order.etaMinutes);
    }
    onOpenChange(nextOpen);
  }

  if (!order) return null;

  async function handleUpdate(e: React.FormEvent) {
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
      const res = await fetch(`/api/kitchen/orders/${order.id}/eta`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ etaMinutes: eta }),
      });

      const data = await res.json();
      if (!res.ok) {
        const msg =
          data.error?.message ||
          "Failed to update ETA · Gagal memperbarui ETA";
        setErrorMsg(msg);
        onError(msg);
        if (res.status === 409) {
          onUpdated(); // Refetch to update board
          onOpenChange(false);
        }
        return;
      }

      onUpdated();
      onOpenChange(false);
    } catch {
      const err =
        "Network error while updating ETA · Terjadi kesalahan jaringan saat memperbarui ETA";
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
          Update ETA · Perbarui Estimasi Waktu
        </DialogTitle>
        <DialogDescription>
          Room {order.roomNumber} · Current: {order.etaMinutes ?? 0} mins
        </DialogDescription>

        <form onSubmit={handleUpdate} className="mt-4 space-y-4">
          <div>
            <label
              htmlFor="update-eta-input"
              className="block text-sm font-medium text-foreground mb-2"
            >
              New Estimated Time (Minutes) · Estimasi Waktu Baru (Menit)
            </label>

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
              id="update-eta-input"
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
                  Updating... · Memperbarui...
                </>
              ) : (
                "Update ETA · Perbarui ETA"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
