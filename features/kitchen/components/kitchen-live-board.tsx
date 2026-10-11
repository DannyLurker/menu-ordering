"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";
import { createRealtimeClient, type RealtimeHandle } from "@/lib/realtime-client";
import { ORDER_CREATED } from "@/lib/realtime";
import type { ActiveKitchenOrders, KitchenOrder } from "../kitchen.types";
import { KitchenOrderCard } from "./kitchen-order-card";
import { VerifyModal } from "./verify-modal";
import { UpdateEtaModal } from "./update-eta-modal";
import { CancelModal } from "./cancel-modal";
import { playOrderChime, unlockAudio } from "./audio-chime";
import {
  Bell,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Flame,
  Info,
  RefreshCw,
  Volume2,
  Wifi,
  WifiOff,
} from "lucide-react";

interface KitchenLiveBoardProps {
  userRole: "KITCHEN" | "ADMIN" | "FRONT_DESK";
  userName: string;
  initialOrders?: ActiveKitchenOrders;
}

interface ToastMessage {
  id: string;
  type: "info" | "success" | "error";
  text: string;
}

export function KitchenLiveBoard({
  userRole,
  initialOrders,
}: KitchenLiveBoardProps) {
  const isReadOnly = userRole === "FRONT_DESK";

  const [orders, setOrders] = React.useState<ActiveKitchenOrders>(
    () => initialOrders ?? { pending: [], preparing: [], completed: [] },
  );
  const [loading, setLoading] = React.useState(!initialOrders);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [isConnected, setIsConnected] = React.useState(false);
  const [audioUnlocked, setAudioUnlocked] = React.useState(false);
  const [showCompleted, setShowCompleted] = React.useState(false);
  const [toasts, setToasts] = React.useState<ToastMessage[]>([]);

  // Modals state
  const [selectedOrder, setSelectedOrder] = React.useState<KitchenOrder | null>(null);
  const [verifyOpen, setVerifyOpen] = React.useState(false);
  const [updateEtaOpen, setUpdateEtaOpen] = React.useState(false);
  const [cancelOpen, setCancelOpen] = React.useState(false);

  const clientRef = React.useRef<RealtimeHandle | null>(null);

  const addToast = React.useCallback(
    (text: string, type: "info" | "success" | "error" = "info") => {
      const id = `${Date.now()}-${Math.random()}`;
      setToasts((prev) => [...prev, { id, text, type }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 5000);
    },
    [],
  );

  const fetchOrders = React.useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch("/api/kitchen/orders?include=completed");
      if (!res.ok) {
        throw new Error("Failed to load orders · Gagal memuat pesanan");
      }
      const data = await res.json();
      if (data.ok && data.orders) {
        setOrders(data.orders);
        setErrorMsg(null);
      }
    } catch (err: any) {
      if (!silent) {
        setErrorMsg(err.message || "Failed to load orders");
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  // Unlock audio on any click anywhere in the window
  React.useEffect(() => {
    function handleFirstInteraction() {
      unlockAudio();
      setAudioUnlocked(true);
      window.removeEventListener("click", handleFirstInteraction);
      window.removeEventListener("keydown", handleFirstInteraction);
    }

    window.addEventListener("click", handleFirstInteraction);
    window.addEventListener("keydown", handleFirstInteraction);
    return () => {
      window.removeEventListener("click", handleFirstInteraction);
      window.removeEventListener("keydown", handleFirstInteraction);
    };
  }, []);

  // Setup Realtime client (spec 0007, 0010)
  React.useEffect(() => {
    const client = createRealtimeClient({
      onOrderEvent: (event, payload) => {
        // Refetch fresh truth on hint
        void fetchOrders(true);

        if (event === ORDER_CREATED) {
          // Play audio chime (AC-9)
          playOrderChime();
          addToast("New order placed! · Pesanan baru telah dibuat!", "info");
        }
      },
      refetch: () => {
        void fetchOrders(true);
      },
      onResync: () => {
        setIsConnected(true);
        addToast("Reconnected · Terhubung kembali", "success");
      },
      onJoinDenied: () => {
        setIsConnected(false);
      },
      onStatusChange: (connected) => {
        setIsConnected(connected);
      },
    });

    clientRef.current = client;
    client.connect({ kitchen: true });

    return () => {
      client.disconnect();
    };
  }, [fetchOrders, addToast]);

  // Actions
  async function handleMarkReady(orderId: string) {
    try {
      const res = await fetch(`/api/kitchen/orders/${orderId}/ready`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = data.error?.message || "Failed to mark order ready";
        addToast(msg, "error");
        void fetchOrders(true);
        return;
      }
      addToast("Order marked as READY · Pesanan ditandai SIAP", "success");
      void fetchOrders(true);
    } catch {
      addToast("Network error · Terjadi kesalahan jaringan", "error");
    }
  }

  async function handleMarkServed(orderId: string) {
    try {
      const res = await fetch(`/api/kitchen/orders/${orderId}/served`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = data.error?.message || "Failed to mark order served";
        addToast(msg, "error");
        void fetchOrders(true);
        return;
      }
      addToast("Order marked as SERVED · Pesanan ditandai DISAJIKAN", "success");
      void fetchOrders(true);
    } catch {
      addToast("Network error · Terjadi kesalahan jaringan", "error");
    }
  }

  const totalActive = orders.pending.length + orders.preparing.length;

  return (
    <div className="space-y-6">
      {/* Toast Notifications container (AC-9, AC-10) */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-center justify-between gap-3 p-3.5 rounded-lg border shadow-lg animate-fade-in text-sm font-medium ${
              t.type === "success"
                ? "bg-emerald-950 text-emerald-100 border-emerald-800"
                : t.type === "error"
                ? "bg-destructive text-destructive-foreground border-destructive"
                : "bg-foreground text-background border-foreground"
            }`}
          >
            <span>{t.text}</span>
          </div>
        ))}
      </div>

      {/* Read Only Notice for Front Desk (AC-14) */}
      {isReadOnly && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3.5 flex items-center gap-3 text-sm text-amber-900">
          <Info className="size-5 shrink-0 text-amber-700" />
          <div>
            <span className="font-bold">Read-Only View · Tampilan Hanya Baca</span>
            <p className="text-xs text-amber-800/80">
              Front Desk access is view-only. Action buttons are disabled. · Akses Front Desk hanya dapat melihat status.
            </p>
          </div>
        </div>
      )}

      {/* Kitchen Board Top Control Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-lg border border-border bg-card">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-foreground">
              Live Kitchen Board · Papan Dapur
            </span>
            <Badge tone="brand" className="font-mono">
              {totalActive} Active
            </Badge>
          </div>

          {/* Connection status indicator */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground ml-2">
            {isConnected ? (
              <span className="flex items-center gap-1 text-emerald-600 font-medium">
                <Wifi className="size-3.5" />
                Live
              </span>
            ) : (
              <span className="flex items-center gap-1 text-amber-600 font-medium">
                <WifiOff className="size-3.5" />
                Reconnecting...
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Sound status indicator */}
          <button
            type="button"
            onClick={() => {
              unlockAudio();
              setAudioUnlocked(true);
              playOrderChime();
            }}
            title={audioUnlocked ? "Sound unlocked" : "Click to enable chime"}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md border border-border bg-secondary hover:bg-muted text-muted-foreground transition-colors"
          >
            <Volume2 className={`size-3.5 ${audioUnlocked ? "text-emerald-600" : "text-muted-foreground"}`} />
            <span>{audioUnlocked ? "Chime Ready" : "Enable Chime"}</span>
          </button>

          <Button
            variant="quiet"
            onClick={() => void fetchOrders()}
            disabled={loading}
            className="text-xs min-h-9 px-3"
          >
            <RefreshCw className={`size-3.5 mr-1 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Error state with retry (AC-12) */}
      {errorMsg && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-destructive flex items-center justify-between">
          <div className="text-sm font-medium">{errorMsg}</div>
          <Button
            variant="quiet"
            onClick={() => void fetchOrders()}
            className="text-xs min-h-9 px-3 border-destructive/30 hover:bg-destructive/20 text-destructive"
          >
            Retry · Coba Lagi
          </Button>
        </div>
      )}

      {/* Loading state skeleton */}
      {loading && orders.pending.length === 0 && orders.preparing.length === 0 ? (
        <div className="p-12 text-center rounded-lg border border-border bg-card">
          <Spinner className="size-8 mx-auto mb-3 text-primary" />
          <p className="text-sm text-muted-foreground font-medium">
            Loading active kitchen orders... · Memuat pesanan dapur aktif...
          </p>
        </div>
      ) : totalActive === 0 ? (
        /* Empty State (AC-12) */
        <div className="p-16 text-center rounded-lg border border-dashed border-border bg-card/60">
          <CheckCircle2 className="size-12 mx-auto mb-3 text-muted-foreground/60" />
          <h3 className="text-lg font-bold text-foreground">
            No active orders right now · Tidak ada pesanan aktif saat ini
          </h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
            New orders from guests will appear here automatically with sound alerts. · Pesanan baru dari tamu akan muncul otomatis di sini dengan notifikasi suara.
          </p>
        </div>
      ) : (
        /* Two-Column Board Grid (AC-1) */
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* PENDING Column (Oldest first) */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-2.5">
              <div className="flex items-center gap-2">
                <span className="size-2.5 rounded-full bg-amber-500 animate-pulse" />
                <h2 className="text-base font-bold text-foreground tracking-tight">
                  PENDING · MENUNGGU VERIFIKASI
                </h2>
              </div>
              <Badge tone="neutral" className="font-mono">
                {orders.pending.length}
              </Badge>
            </div>

            {orders.pending.length === 0 ? (
              <div className="p-8 text-center rounded-lg border border-dashed border-border/80 text-xs text-muted-foreground">
                No orders waiting for verification · Tidak ada pesanan menunggu
              </div>
            ) : (
              <div className="space-y-3">
                {orders.pending.map((order) => (
                  <KitchenOrderCard
                    key={order.id}
                    order={order}
                    readOnly={isReadOnly}
                    onOpenVerify={(ord) => {
                      setSelectedOrder(ord);
                      setVerifyOpen(true);
                    }}
                    onOpenUpdateEta={(ord) => {
                      setSelectedOrder(ord);
                      setUpdateEtaOpen(true);
                    }}
                    onOpenCancel={(ord) => {
                      setSelectedOrder(ord);
                      setCancelOpen(true);
                    }}
                    onMarkReady={handleMarkReady}
                    onMarkServed={handleMarkServed}
                  />
                ))}
              </div>
            )}
          </div>

          {/* PREPARING Column (Soonest ETA first) */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-2.5">
              <div className="flex items-center gap-2">
                <span className="size-2.5 rounded-full bg-primary" />
                <h2 className="text-base font-bold text-foreground tracking-tight">
                  PREPARING · SEDANG DIMASAK
                </h2>
              </div>
              <Badge tone="brand" className="font-mono">
                {orders.preparing.length}
              </Badge>
            </div>

            {orders.preparing.length === 0 ? (
              <div className="p-8 text-center rounded-lg border border-dashed border-border/80 text-xs text-muted-foreground">
                No orders currently in preparation · Tidak ada pesanan sedang dimasak
              </div>
            ) : (
              <div className="space-y-3">
                {orders.preparing.map((order) => (
                  <KitchenOrderCard
                    key={order.id}
                    order={order}
                    readOnly={isReadOnly}
                    onOpenVerify={(ord) => {
                      setSelectedOrder(ord);
                      setVerifyOpen(true);
                    }}
                    onOpenUpdateEta={(ord) => {
                      setSelectedOrder(ord);
                      setUpdateEtaOpen(true);
                    }}
                    onOpenCancel={(ord) => {
                      setSelectedOrder(ord);
                      setCancelOpen(true);
                    }}
                    onMarkReady={handleMarkReady}
                    onMarkServed={handleMarkServed}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Collapsible Completed Orders Strip (last 2 hours, AC-1) */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <button
          type="button"
          onClick={() => setShowCompleted((prev) => !prev)}
          className="w-full flex items-center justify-between p-4 bg-secondary/50 hover:bg-secondary text-left transition-colors"
        >
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <CheckCircle2 className="size-4 text-emerald-600" />
            <span>Completed Orders (Last 2 Hours) · Pesanan Selesai (2 Jam Terakhir)</span>
            <Badge tone="neutral" className="ml-2 font-mono">
              {orders.completed.length}
            </Badge>
          </div>
          <div className="text-muted-foreground">
            {showCompleted ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          </div>
        </button>

        {showCompleted && (
          <div className="p-4 border-t border-border">
            {orders.completed.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">
                No completed orders in the last 2 hours · Belum ada pesanan selesai dalam 2 jam terakhir
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {orders.completed.map((order) => (
                  <KitchenOrderCard
                    key={order.id}
                    order={order}
                    readOnly={true}
                    onOpenVerify={() => {}}
                    onOpenUpdateEta={() => {}}
                    onOpenCancel={() => {}}
                    onMarkReady={handleMarkReady}
                    onMarkServed={handleMarkServed}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Action Dialogs (AC-3, AC-4, AC-7) */}
      <VerifyModal
        order={selectedOrder}
        open={verifyOpen}
        onOpenChange={setVerifyOpen}
        onVerified={() => void fetchOrders(true)}
        onError={(msg) => addToast(msg, "error")}
      />

      <UpdateEtaModal
        order={selectedOrder}
        open={updateEtaOpen}
        onOpenChange={setUpdateEtaOpen}
        onUpdated={() => void fetchOrders(true)}
        onError={(msg) => addToast(msg, "error")}
      />

      <CancelModal
        order={selectedOrder}
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        onCancelled={() => void fetchOrders(true)}
        onError={(msg) => addToast(msg, "error")}
      />
    </div>
  );
}
