"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { KitchenOrder } from "../kitchen.types";
import {
  Clock,
  AlertTriangle,
  CheckCircle,
  Flame,
  XCircle,
} from "lucide-react";

interface KitchenOrderCardProps {
  order: KitchenOrder;
  readOnly?: boolean;
  onOpenVerify: (order: KitchenOrder) => void;
  onOpenUpdateEta: (order: KitchenOrder) => void;
  onOpenCancel: (order: KitchenOrder) => void;
  onMarkReady: (orderId: string) => Promise<void>;
  onMarkServed: (orderId: string) => Promise<void>;
}

export function KitchenOrderCard({
  order,
  readOnly = false,
  onOpenVerify,
  onOpenUpdateEta,
  onOpenCancel,
  onMarkReady,
  onMarkServed,
}: KitchenOrderCardProps) {
  const [actionLoading, setActionLoading] = React.useState(false);
  const [now, setNow] = React.useState(() => Date.now());
  const [isMounted, setIsMounted] = React.useState(false);

  // Set isMounted ke true setelah komponen terpasang di client
  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  // Live countdown timer for PREPARING orders (AC-8)
  React.useEffect(() => {
    if (
      order.status !== "PREPARING" ||
      !order.verifiedAt ||
      !order.etaMinutes
    ) {
      return;
    }

    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, [order.status, order.verifiedAt, order.etaMinutes]);

  const remainingSec = React.useMemo(() => {
    if (
      order.status !== "PREPARING" ||
      !order.verifiedAt ||
      !order.etaMinutes
    ) {
      return null;
    }
    const verifiedMs = new Date(order.verifiedAt).getTime();
    const targetMs = verifiedMs + order.etaMinutes * 60 * 1000;
    return Math.round((targetMs - now) / 1000);
  }, [order.status, order.verifiedAt, order.etaMinutes, now]);

  const placedTime = React.useMemo(() => {
    try {
      return new Date(order.placedAt).toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Jakarta", // atau atur timezone yang sesuai dengan sistem hotel
      });
    } catch {
      return "";
    }
  }, [order.placedAt]);
  async function handleAction(actionFn: () => Promise<void>) {
    setActionLoading(true);
    try {
      await actionFn();
    } finally {
      setActionLoading(false);
    }
  }

  // Format countdown
  let countdownText = "";
  let urgencyTone: "normal" | "urgent" | "overdue" = "normal";

  if (remainingSec !== null) {
    if (remainingSec <= 0) {
      urgencyTone = "overdue";
      const overdueSec = Math.abs(remainingSec);
      const m = Math.floor(overdueSec / 60);
      const s = overdueSec % 60;
      countdownText = `+${m}:${s.toString().padStart(2, "0")} OVERDUE · TERLAMBAT`;
    } else {
      const m = Math.floor(remainingSec / 60);
      const s = remainingSec % 60;
      countdownText = `${m}:${s.toString().padStart(2, "0")} remaining · sisa`;
      if (m < 5) {
        urgencyTone = "urgent";
      }
    }
  }

  return (
    <div
      className={`rounded-lg border p-4 bg-card text-card-foreground shadow-xs transition-all ${urgencyTone === "overdue"
          ? "border-destructive/80 ring-2 ring-destructive/20 bg-destructive/[0.02]"
          : urgencyTone === "urgent"
            ? "border-amber-500/80 ring-2 ring-amber-500/20 bg-amber-500/[0.02]"
            : "border-border hover:border-foreground/20"
        }`}
    >
      {/* Top row: Room Number & Placed time */}
      <div className="flex items-start justify-between gap-3 border-b border-border/60 pb-3">
        <div>
          <div className="flex items-baseline gap-2">
            <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
              Room · Kamar
            </span>
            <span className="text-3xl font-black tracking-tight text-foreground">
              {order.roomNumber}
            </span>
          </div>
          {order.guestName && (
            <p className="text-xs text-muted-foreground line-clamp-1">
              {order.guestName}
            </p>
          )}
        </div>

        <div className="flex flex-col items-end gap-1">
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="size-3" />
            {placedTime}
          </span>

          {order.status === "PENDING" && (
            <Badge
              tone="neutral"
              className="bg-amber-500/10 text-amber-700 border border-amber-500/30"
            >
              PENDING · MENUNGGU
            </Badge>
          )}

          {order.status === "PREPARING" && (
            <Badge tone="brand" className="flex items-center gap-1">
              <Flame className="size-3" />
              PREPARING · DIMASAK
            </Badge>
          )}

          {order.status === "READY" && (
            <Badge
              tone="ok"
              className="bg-emerald-500/15 text-emerald-800 border border-emerald-500/30"
            >
              READY · SIAP
            </Badge>
          )}

          {order.status === "SERVED" && (
            <Badge tone="neutral">SERVED · DISAJIKAN</Badge>
          )}

          {(order.status === "KITCHEN_CANCELLED" ||
            order.status === "GUEST_CANCELLED") && (
              <Badge tone="danger">CANCELLED · BATAL</Badge>
            )}
        </div>
      </div>

      {/* Countdown timer ticker (AC-8) */}
      {order.status === "PREPARING" && remainingSec !== null && (
        <div
          className={`mt-3 px-3 py-1.5 rounded-md flex items-center justify-between font-mono text-sm font-bold ${urgencyTone === "overdue"
              ? "bg-destructive text-destructive-foreground animate-pulse"
              : urgencyTone === "urgent"
                ? "bg-amber-500 text-white"
                : "bg-muted text-foreground"
            }`}
        >
          <span className="flex items-center gap-1.5 text-xs font-sans tracking-wide uppercase">
            {urgencyTone === "overdue" ? (
              <AlertTriangle className="size-4" />
            ) : (
              <Clock className="size-3.5" />
            )}
            ETA {order.etaMinutes}m
          </span>
          <span>{countdownText}</span>
        </div>
      )}

      {/* Items List (AC-8) */}
      <div className="mt-3 space-y-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Order Items · Menu ({order.items.reduce((acc, i) => acc + i.qty, 0)})
        </span>
        <ul className="space-y-1.5">
          {order.items.map((item) => (
            <li
              key={item.id}
              className="flex items-start justify-between text-sm py-1 border-b border-border/30 last:border-0"
            >
              <div className="flex items-start gap-2 pr-2">
                <span className="font-bold text-foreground min-w-[1.5rem]">
                  {item.qty}x
                </span>
                <div>
                  <p className="font-medium text-foreground leading-snug">
                    {item.nameEn}
                  </p>
                  {item.nameId && item.nameId !== item.nameEn && (
                    <p className="text-xs text-muted-foreground italic leading-tight">
                      {item.nameId}
                    </p>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Cancellation Reason note if cancelled */}
      {order.cancelReason && (
        <div className="mt-3 rounded-md bg-destructive/10 p-2.5 text-xs text-destructive">
          <span className="font-semibold">Reason · Alasan:</span>{" "}
          {order.cancelReason}
        </div>
      )}

      {/* Action Buttons (AC-3, AC-4, AC-5, AC-6, AC-7) - Hidden if readOnly (AC-14) */}
      {!readOnly && (
        <div className="mt-4 pt-3 border-t border-border flex flex-wrap gap-2 justify-end">
          {order.status === "PENDING" && (
            <>
              <Button
                variant="quiet"
                onClick={() => onOpenCancel(order)}
                disabled={actionLoading}
                className="text-xs min-h-9 px-3 text-destructive hover:bg-destructive/10"
              >
                <XCircle className="size-3.5 mr-1" />
                Cancel · Batal
              </Button>
              <Button
                variant="primary"
                onClick={() => onOpenVerify(order)}
                disabled={actionLoading}
                className="text-xs min-h-9 px-3"
              >
                <Flame className="size-3.5 mr-1" />
                Verify & ETA · Verifikasi
              </Button>
            </>
          )}

          {order.status === "PREPARING" && (
            <>
              <Button
                variant="quiet"
                onClick={() => onOpenCancel(order)}
                disabled={actionLoading}
                className="text-xs min-h-9 px-3 text-destructive hover:bg-destructive/10"
              >
                Cancel · Batal
              </Button>
              <Button
                variant="quiet"
                onClick={() => onOpenUpdateEta(order)}
                disabled={actionLoading}
                className="text-xs min-h-9 px-3"
              >
                Update ETA
              </Button>
              <Button
                variant="primary"
                onClick={() => handleAction(() => onMarkReady(order.id))}
                disabled={actionLoading}
                className="text-xs min-h-9 px-3 bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {actionLoading ? (
                  <Spinner className="size-3.5 mr-1" />
                ) : (
                  <CheckCircle className="size-3.5 mr-1" />
                )}
                Ready · Siap
              </Button>
            </>
          )}

          {order.status === "READY" && (
            <Button
              variant="primary"
              onClick={() => handleAction(() => onMarkServed(order.id))}
              disabled={actionLoading}
              className="w-full text-xs min-h-9 px-3 bg-foreground hover:bg-foreground/90 text-background"
            >
              {actionLoading ? (
                <Spinner className="size-3.5 mr-1" />
              ) : (
                <CheckCircle className="size-3.5 mr-1" />
              )}
              Mark Served · Tandai Disajikan
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
