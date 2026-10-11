"use client";

// PIN verification modal for guest ordering (spec 0009, AC-2, AC-5).
// Prompts the guest for their 6 digit room PIN before submitting the order.
import * as React from "react";
import { Lock, AlertCircle, ShieldAlert } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { PlacedOrderSummary } from "../services/orders.service";

export interface PinCheckoutModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roomNumber?: string;
  guestName?: string;
  items: Array<{
    menuItemId: string;
    qty: number;
    nameEn: string;
    nameId: string;
    unitPrice: number;
  }>;
  totalAmount: number;
  onSuccess: (order: PlacedOrderSummary) => void;
}

function formatRupiah(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function PinCheckoutModal({
  open,
  onOpenChange,
  roomNumber,
  guestName,
  items,
  totalAmount,
  onSuccess,
}: PinCheckoutModalProps) {
  const [pin, setPin] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<{
    code: string;
    message: string;
    remainingAttempts?: number;
  } | null>(null);

  React.useEffect(() => {
    if (open) {
      setPin("");
      setError(null);
      setLoading(false);
    }
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pin.length !== 6 || loading) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          pin,
          items: items.map((i) => ({ menuItemId: i.menuItemId, qty: i.qty })),
          clientTotal: totalAmount,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        const err = data.error || {
          code: "UNKNOWN",
          message: "Unable to place order. Please try again.",
        };
        setError({
          code: err.code,
          message: err.message,
          remainingAttempts: err.details?.remainingAttempts,
        });
        return;
      }

      onSuccess({
        orderId: data.orderId,
        status: data.status,
        placedAt: new Date(data.placedAt),
        totalAmount: data.totalAmount,
        items: data.items,
      });
      onOpenChange(false);
    } catch {
      setError({
        code: "NETWORK_ERROR",
        message:
          "Network error. Please check your connection. / Gangguan jaringan. Periksa koneksi Anda.",
      });
    } finally {
      setLoading(false);
    }
  }

  const isLocked = error?.code === "STAY_LOCKED";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-primary">
            <Lock className="size-5 shrink-0" aria-hidden="true" />
            <DialogTitle>Enter Room PIN · Masukkan PIN Kamar</DialogTitle>
          </div>
          <DialogDescription>
            Confirm order of {items.length} items for {formatRupiah(totalAmount)}
            {roomNumber ? ` (Room ${roomNumber})` : ""}.
          </DialogDescription>
        </div>

        {error && (
          <div
            role="alert"
            className={`mt-3 flex items-start gap-2.5 rounded-md p-3 text-sm ${
              isLocked
                ? "bg-destructive/10 text-destructive border border-destructive/20"
                : "bg-destructive/10 text-destructive"
            }`}
          >
            {isLocked ? (
              <ShieldAlert className="size-5 shrink-0 mt-0.5" aria-hidden="true" />
            ) : (
              <AlertCircle className="size-5 shrink-0 mt-0.5" aria-hidden="true" />
            )}
            <div className="flex flex-col gap-0.5">
              <p className="font-semibold">{error.message}</p>
              {error.remainingAttempts !== undefined && error.remainingAttempts > 0 && (
                <p className="text-xs opacity-90">
                  {error.remainingAttempts} attempts remaining before room lockout. · Sisa{" "}
                  {error.remainingAttempts} kesempatan sebelum kamar terkunci.
                </p>
              )}
            </div>
          </div>
        )}

        {isLocked ? (
          <div className="mt-4 flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              Please contact the hotel front desk to verify your identity and unlock ordering. ·
              Silakan hubungi resepsionis hotel untuk membuka kunci pemesanan.
            </p>
            <Button
              type="button"
              variant="quiet"
              onClick={() => onOpenChange(false)}
              className="w-full"
            >
              Close · Tutup
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="pin-input"
                className="text-sm font-medium text-foreground"
              >
                6 Digit PIN · PIN 6 Digit
              </label>
              <input
                id="pin-input"
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                autoFocus
                required
                disabled={loading}
                value={pin}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, "");
                  if (val.length <= 6) setPin(val);
                }}
                placeholder="••••••"
                className="min-h-12 text-center text-2xl tracking-[0.4em] font-mono rounded-md border border-input bg-background px-3 text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50"
              />
              <p className="text-xs text-muted-foreground">
                Enter the personal PIN you created upon arrival. · Masukkan PIN pribadi yang Anda buat saat kedatangan.
              </p>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <Button
                type="button"
                variant="quiet"
                disabled={loading}
                onClick={() => onOpenChange(false)}
                className="flex-1"
              >
                Cancel · Batal
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={pin.length !== 6 || loading}
                className="flex-1"
              >
                {loading ? (
                  <>
                    <Spinner aria-hidden="true" />
                    <span>Verifying...</span>
                  </>
                ) : (
                  <span>Confirm Order · Konfirmasi</span>
                )}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

