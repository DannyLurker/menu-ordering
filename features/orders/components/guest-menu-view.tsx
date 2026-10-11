"use client";

// Guest menu browsing and ordering interface (spec 0009, AC-1, AC-4, AC-9, AC-10).
// Responsive category tabs, item cards with quantities 1 to 20, cart drawer,
// PIN verification modal trigger, and order confirmation.
import * as React from "react";
import {
  ShoppingBag,
  Plus,
  Minus,
  Trash2,
  CheckCircle2,
  Clock,
  UtensilsCrossed,
  Receipt,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { PinCheckoutModal } from "./pin-checkout-modal";
import { createRealtimeClient } from "@/lib/realtime-client";
import type { PlacedOrderSummary, GuestOrderHistoryItem } from "../services/orders.service";

export interface MenuItemData {
  id: string;
  nameEn: string;
  nameId: string;
  price: number;
  isAvailable: boolean;
  sortOrder: number;
}

export interface MenuCategoryData {
  id: string;
  nameEn: string;
  nameId: string;
  sortOrder: number;
  items: MenuItemData[];
}

export interface GuestMenuViewProps {
  categories: MenuCategoryData[];
  initialOrders?: GuestOrderHistoryItem[];
  stayInfo?: {
    stayId: string;
    roomNumber: string;
    guestName: string;
  } | null;
}

function formatRupiah(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function getOrderCountdown(order: GuestOrderHistoryItem, now: number): {
  formatted: string;
  isOverdue: boolean;
} | null {
  if (order.status !== "PREPARING" || !order.etaMinutes) return null;
  const baseTime = order.verifiedAt
    ? new Date(order.verifiedAt).getTime()
    : new Date(order.placedAt).getTime();
  const targetMs = baseTime + order.etaMinutes * 60 * 1000;
  const remainingSec = Math.round((targetMs - now) / 1000);

  if (remainingSec <= 0) {
    const overdueSec = Math.abs(remainingSec);
    const m = Math.floor(overdueSec / 60);
    const s = overdueSec % 60;
    return {
      formatted: `Finishing up (+${m}:${s.toString().padStart(2, "0")}) · Hampir siap`,
      isOverdue: true,
    };
  }

  const m = Math.floor(remainingSec / 60);
  const s = remainingSec % 60;
  return {
    formatted: `${m}:${s.toString().padStart(2, "0")} remaining · sisa waktu`,
    isOverdue: false,
  };
}

export function GuestMenuView({
  categories,
  initialOrders = [],
  stayInfo,
}: GuestMenuViewProps) {
  const [selectedCategory, setSelectedCategory] = React.useState<string>("ALL");
  const [cart, setCart] = React.useState<Map<string, number>>(new Map());
  const [isCartOpen, setIsCartOpen] = React.useState(false);
  const [isPinModalOpen, setIsPinModalOpen] = React.useState(false);
  const [isOrdersModalOpen, setIsOrdersModalOpen] = React.useState(false);
  const [orders, setOrders] = React.useState<GuestOrderHistoryItem[]>(initialOrders);
  const [placedOrder, setPlacedOrder] = React.useState<PlacedOrderSummary | null>(null);
  const [now, setNow] = React.useState(() => Date.now());

  // Flatten all items for easy lookup
  const allItems = React.useMemo(() => {
    const map = new Map<string, MenuItemData>();
    for (const cat of categories) {
      for (const item of cat.items) {
        map.set(item.id, item);
      }
    }
    return map;
  }, [categories]);

  function addToCart(itemId: string) {
    setCart((prev) => {
      const next = new Map(prev);
      const current = next.get(itemId) || 0;
      if (current < 20) {
        next.set(itemId, current + 1);
      }
      return next;
    });
  }

  function removeFromCart(itemId: string) {
    setCart((prev) => {
      const next = new Map(prev);
      const current = next.get(itemId) || 0;
      if (current <= 1) {
        next.delete(itemId);
      } else {
        next.set(itemId, current - 1);
      }
      return next;
    });
  }

  function deleteFromCart(itemId: string) {
    setCart((prev) => {
      const next = new Map(prev);
      next.delete(itemId);
      return next;
    });
  }

  function clearCart() {
    setCart(new Map());
    setIsCartOpen(false);
  }

  // Calculate cart totals
  const cartEntries = Array.from(cart.entries()).map(([itemId, qty]) => {
    const item = allItems.get(itemId);
    return {
      menuItemId: itemId,
      qty,
      nameEn: item?.nameEn || "Item",
      nameId: item?.nameId || "Menu",
      unitPrice: item?.price || 0,
      subtotal: (item?.price || 0) * qty,
    };
  });

  const cartTotalItems = cartEntries.reduce((sum, item) => sum + item.qty, 0);
  const cartTotalAmount = cartEntries.reduce((sum, item) => sum + item.subtotal, 0);

  const displayedCategories =
    selectedCategory === "ALL"
      ? categories
      : categories.filter((c) => c.id === selectedCategory);

  const fetchOrders = React.useCallback(async () => {
    try {
      const res = await fetch("/api/orders");
      if (!res.ok) return;
      const data = await res.json();
      if (data.orders) {
        setOrders(
          data.orders.map((o: any) => ({
            ...o,
            placedAt: new Date(o.placedAt),
            verifiedAt: o.verifiedAt ? new Date(o.verifiedAt) : null,
          })),
        );
      }
    } catch {
      // quiet retry
    }
  }, []);

  React.useEffect(() => {
    if (!stayInfo?.stayId) return;

    const client = createRealtimeClient({
      onOrderEvent: () => {
        void fetchOrders();
      },
      refetch: () => {
        void fetchOrders();
      },
    });

    client.connect({ stay: true });

    return () => {
      client.disconnect();
    };
  }, [stayInfo?.stayId, fetchOrders]);

  function handleOrderSuccess(newOrder: PlacedOrderSummary) {
    setPlacedOrder(newOrder);
    setCart(new Map());
    setIsCartOpen(false);
    // Add to active orders list and fetch fresh state
    setOrders((prev) => [
      {
        id: newOrder.orderId,
        status: newOrder.status,
        placedAt: newOrder.placedAt,
        etaMinutes: null,
        totalAmount: newOrder.totalAmount,
        items: newOrder.items,
      },
      ...prev,
    ]);
    void fetchOrders();
  }

  const activeOrders = React.useMemo(() => {
    return orders.filter(
      (o) => o.status === "PENDING" || o.status === "PREPARING" || o.status === "READY",
    );
  }, [orders]);

  // Live countdown timer for preparing orders
  React.useEffect(() => {
    const hasPreparing = orders.some(
      (o) => o.status === "PREPARING" && o.etaMinutes,
    );
    if (!hasPreparing) return;

    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, [orders]);

  return (
    <div className="min-h-screen bg-background pb-28">
      {/* Header banner */}
      <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur-sm px-4 py-3 shadow-xs">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold tracking-wider text-brand">BIZ HOTEL BATAM</p>
            <h1 className="text-lg font-bold text-foreground">Room Dining · Menu Kamar</h1>
            {stayInfo && (
              <p className="text-xs text-muted-foreground">
                Room {stayInfo.roomNumber} · {stayInfo.guestName}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {orders.length > 0 && (
              <Button
                variant="quiet"
                size="guest"
                onClick={() => setIsOrdersModalOpen(true)}
                className="gap-1.5 text-xs sm:text-sm"
              >
                <Receipt className="size-4 text-primary" aria-hidden="true" />
                <span>Orders ({orders.length})</span>
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Category navigation bar */}
      <nav
        aria-label="Menu categories · Kategori menu"
        className="sticky top-[69px] z-20 border-b border-border bg-background/95 backdrop-blur-sm px-4 py-2.5 overflow-x-auto"
      >
        <div className="mx-auto flex max-w-4xl gap-2">
          <button
            type="button"
            onClick={() => setSelectedCategory("ALL")}
            className={`whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium transition-colors cursor-pointer ${
              selectedCategory === "ALL"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            All Menu · Semua
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id)}
              className={`whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium transition-colors cursor-pointer ${
                selectedCategory === cat.id
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {cat.nameEn} · {cat.nameId}
            </button>
          ))}
        </div>
      </nav>

      {/* Main catalog view */}
      <main className="mx-auto max-w-4xl px-4 py-6">
        {/* Active orders banner with live status and ETA */}
        {activeOrders.length > 0 && (
          <section aria-label="Active Orders · Pesanan Aktif" className="mb-6">
            <div className="flex flex-col gap-3">
              {activeOrders.map((activeOrder) => (
                <div
                  key={activeOrder.id}
                  className="rounded-xl border border-primary/20 bg-primary/5 p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-start gap-3">
                    <div className="rounded-full bg-primary/10 p-2 text-primary shrink-0">
                      <Clock className="size-5 animate-pulse" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-foreground">
                          Order #{activeOrder.id.slice(0, 8)}
                        </span>
                        <Badge tone={activeOrder.status === "READY" ? "ok" : "brand"}>
                          {activeOrder.status === "PENDING"
                            ? "Awaiting Kitchen · Menunggu Dapur"
                            : activeOrder.status === "PREPARING"
                            ? "Preparing · Sedang Dimasak"
                            : "Ready for Delivery · Siap Diantar"}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {activeOrder.items.map((i) => `${i.qty}x ${i.nameEn}`).join(", ")}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-center">
                    {(() => {
                      const countdown = getOrderCountdown(activeOrder, now);
                      if (countdown) {
                        return (
                          <div
                            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 border font-medium text-xs sm:text-sm shadow-xs ${
                              countdown.isOverdue
                                ? "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400"
                                : "bg-card border-border text-foreground"
                            }`}
                          >
                            <Clock
                              className={`size-4 ${
                                countdown.isOverdue
                                  ? "text-amber-600 animate-pulse"
                                  : "text-emerald-600 animate-pulse"
                              }`}
                            />
                            <span>
                              <strong className="font-mono font-bold">
                                {countdown.formatted}
                              </strong>
                            </span>
                          </div>
                        );
                      }
                      if (activeOrder.etaMinutes !== null && activeOrder.etaMinutes !== undefined) {
                        return (
                          <div className="flex items-center gap-1.5 rounded-lg bg-card px-3 py-1.5 border border-border text-foreground font-medium text-xs sm:text-sm shadow-xs">
                            <Clock className="size-4 text-emerald-600" />
                            <span>
                              ETA: <strong className="text-emerald-700 dark:text-emerald-400 font-bold">~{activeOrder.etaMinutes} mins</strong>
                              <span className="text-muted-foreground text-xs ml-1">· ~{activeOrder.etaMinutes} mnt</span>
                            </span>
                          </div>
                        );
                      }
                      return (
                        <span className="text-xs text-muted-foreground italic">
                          {activeOrder.status === "PENDING"
                            ? "Kitchen will confirm ETA shortly · Menunggu estimasi dapur"
                            : "Preparing · Sedang dipersiapkan"}
                        </span>
                      );
                    })()}

                    <Button
                      type="button"
                      variant="quiet"
                      size="guest"
                      onClick={() => setIsOrdersModalOpen(true)}
                      className="text-xs"
                    >
                      Details · Detail
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <div className="flex flex-col gap-8">
          {displayedCategories.map((cat) => (
            <section key={cat.id} aria-labelledby={`cat-title-${cat.id}`}>
              <div className="mb-4 flex items-center justify-between border-b border-border pb-2">
                <h2 id={`cat-title-${cat.id}`} className="text-xl font-bold text-foreground">
                  {cat.nameEn} · <span className="text-muted-foreground">{cat.nameId}</span>
                </h2>
                <span className="text-xs text-muted-foreground">
                  {cat.items.length} items
                </span>
              </div>

              {cat.items.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  No items currently available in this category. · Belum ada menu tersedia.
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {cat.items.map((item) => {
                    const quantityInCart = cart.get(item.id) || 0;
                    return (
                      <Card
                        key={item.id}
                        className="flex flex-col justify-between overflow-hidden transition-shadow hover:shadow-xs"
                      >
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between gap-2">
                            <CardTitle className="text-base font-bold">
                              {item.nameEn}
                            </CardTitle>
                            <span className="text-sm font-bold text-primary shrink-0">
                              {formatRupiah(item.price)}
                            </span>
                          </div>
                          <CardDescription className="text-xs">
                            {item.nameId}
                          </CardDescription>
                        </CardHeader>

                        <CardContent className="pt-0">
                          <div className="flex items-center justify-between border-t border-border pt-3">
                            <Badge tone={item.isAvailable ? "ok" : "danger"}>
                              {item.isAvailable ? "Available · Tersedia" : "Sold Out · Habis"}
                            </Badge>

                            {item.isAvailable && (
                              <div>
                                {quantityInCart === 0 ? (
                                  <Button
                                    type="button"
                                    variant="quiet"
                                    size="guest"
                                    onClick={() => addToCart(item.id)}
                                    className="gap-1.5 text-xs font-semibold"
                                  >
                                    <Plus className="size-4 text-primary" aria-hidden="true" />
                                    <span>Add · Tambah</span>
                                  </Button>
                                ) : (
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      aria-label={`Decrease ${item.nameEn} quantity`}
                                      onClick={() => removeFromCart(item.id)}
                                      className="flex size-8 items-center justify-center rounded-md border border-input bg-background text-foreground hover:bg-muted"
                                    >
                                      <Minus className="size-3.5" aria-hidden="true" />
                                    </button>
                                    <span className="min-w-6 text-center text-sm font-bold text-foreground">
                                      {quantityInCart}
                                    </span>
                                    <button
                                      type="button"
                                      aria-label={`Increase ${item.nameEn} quantity`}
                                      disabled={quantityInCart >= 20}
                                      onClick={() => addToCart(item.id)}
                                      className="flex size-8 items-center justify-center rounded-md border border-input bg-background text-foreground hover:bg-muted disabled:opacity-40"
                                    >
                                      <Plus className="size-3.5" aria-hidden="true" />
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </section>
          ))}
        </div>
      </main>

      {/* Floating cart bar when items are selected */}
      {cartTotalItems > 0 && (
        <aside
          aria-label="Cart summary · Ringkasan keranjang"
          className="fixed bottom-4 left-4 right-4 z-40 mx-auto max-w-md animate-fade-in"
        >
          <div className="flex items-center justify-between gap-4 rounded-xl border border-primary/20 bg-card p-4 shadow-xl text-card-foreground">
            <div className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <ShoppingBag className="size-5" aria-hidden="true" />
              </div>
              <div className="flex flex-col">
                <span className="text-xs text-muted-foreground">
                  {cartTotalItems} {cartTotalItems === 1 ? "item" : "items"} in cart
                </span>
                <span className="text-base font-bold text-foreground">
                  {formatRupiah(cartTotalAmount)}
                </span>
              </div>
            </div>

            <Button
              type="button"
              variant="primary"
              size="guest"
              onClick={() => setIsCartOpen(true)}
              className="font-bold text-sm"
            >
              View Cart · Keranjang
            </Button>
          </div>
        </aside>
      )}

      {/* Cart Drawer Modal */}
      <Dialog open={isCartOpen} onOpenChange={setIsCartOpen}>
        <DialogContent className="sm:max-w-lg">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div className="flex items-center gap-2 text-primary">
              <ShoppingBag className="size-5 shrink-0" aria-hidden="true" />
              <DialogTitle>Your Cart · Keranjang Belanja</DialogTitle>
            </div>
          </div>
          <DialogDescription>
            Review selected items and quantities before confirming your order.
          </DialogDescription>

          <div className="max-h-[50vh] overflow-y-auto divide-y divide-border py-2">
            {cartEntries.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Your cart is empty. · Keranjang Anda kosong.
              </p>
            ) : (
              cartEntries.map((item) => (
                <div key={item.menuItemId} className="flex items-center justify-between py-3 gap-2">
                  <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {item.nameEn}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {item.nameId}
                    </p>
                    <p className="text-xs font-medium text-primary">
                      {formatRupiah(item.unitPrice)}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      aria-label={`Decrease ${item.nameEn} quantity`}
                      onClick={() => removeFromCart(item.menuItemId)}
                      className="flex size-7 items-center justify-center rounded-md border border-input bg-background hover:bg-muted"
                    >
                      <Minus className="size-3" aria-hidden="true" />
                    </button>
                    <span className="w-5 text-center text-sm font-bold">
                      {item.qty}
                    </span>
                    <button
                      type="button"
                      aria-label={`Increase ${item.nameEn} quantity`}
                      disabled={item.qty >= 20}
                      onClick={() => addToCart(item.menuItemId)}
                      className="flex size-7 items-center justify-center rounded-md border border-input bg-background hover:bg-muted disabled:opacity-40"
                    >
                      <Plus className="size-3" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete ${item.nameEn} from cart`}
                      onClick={() => deleteFromCart(item.menuItemId)}
                      className="ml-1 p-1 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {cartEntries.length > 0 && (
            <div className="border-t border-border pt-3 flex flex-col gap-3">
              <div className="flex items-center justify-between text-base font-bold">
                <span>Total Amount · Total</span>
                <span className="text-primary">{formatRupiah(cartTotalAmount)}</span>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <Button
                  type="button"
                  variant="quiet"
                  onClick={clearCart}
                  className="flex-1 text-xs"
                >
                  Clear · Kosongkan
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  onClick={() => {
                    setIsCartOpen(false);
                    setIsPinModalOpen(true);
                  }}
                  className="flex-2 font-bold text-sm"
                >
                  Proceed with PIN · Lanjut PIN
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* PIN Verification Modal */}
      <PinCheckoutModal
        open={isPinModalOpen}
        onOpenChange={setIsPinModalOpen}
        roomNumber={stayInfo?.roomNumber}
        guestName={stayInfo?.guestName}
        items={cartEntries}
        totalAmount={cartTotalAmount}
        onSuccess={handleOrderSuccess}
      />

      {/* Order Placed Success Confirmation Dialog */}
      {placedOrder && (
        <Dialog open={Boolean(placedOrder)} onOpenChange={() => setPlacedOrder(null)}>
          <DialogContent className="sm:max-w-md">
            <div className="flex flex-col items-center text-center gap-2 pt-2">
              <div className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                <CheckCircle2 className="size-8" aria-hidden="true" />
              </div>
              <DialogTitle className="text-xl">
                Order Received · Pesanan Diterima!
              </DialogTitle>
              <DialogDescription>
                Your order is currently pending kitchen preparation. · Pesanan Anda sedang diteruskan ke dapur.
              </DialogDescription>
            </div>

            <div className="mt-3 rounded-lg border border-border bg-muted/30 p-4 text-sm flex flex-col gap-2">
              <div className="flex justify-between items-center text-xs text-muted-foreground border-b border-border pb-2">
                <span>Order ID</span>
                <span className="font-mono">{placedOrder.orderId.slice(0, 8)}...</span>
              </div>
              <div className="flex justify-between items-center text-xs text-muted-foreground border-b border-border pb-2">
                <span>Status</span>
                <Badge tone="ok">{placedOrder.status}</Badge>
              </div>

              <div className="flex items-center gap-2 rounded-lg bg-primary/5 border border-primary/20 p-2.5 text-xs text-foreground">
                <Clock className="size-4 text-primary shrink-0 animate-pulse" />
                <div>
                  <p className="font-medium">Kitchen notified · Dapur telah diberitahu</p>
                  <p className="text-[11px] text-muted-foreground">
                    Estimated prep time will update live once kitchen confirms · Estimasi waktu persiapan akan muncul langsung setelah dikonfirmasi dapur
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-1 py-1">
                <span className="text-xs font-semibold text-muted-foreground">Items Ordered:</span>
                {placedOrder.items.map((item) => (
                  <div key={item.id} className="flex justify-between text-xs">
                    <span>
                      {item.qty}x {item.nameEn}
                    </span>
                    <span>{formatRupiah(item.qty * item.unitPrice)}</span>
                  </div>
                ))}
              </div>

              <div className="flex justify-between items-center text-sm font-bold border-t border-border pt-2">
                <span>Total Charged</span>
                <span className="text-primary">{formatRupiah(placedOrder.totalAmount)}</span>
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-2">
              <Button
                type="button"
                variant="primary"
                onClick={() => setPlacedOrder(null)}
                className="w-full"
              >
                Back to Menu · Kembali ke Menu
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Orders History Dialog */}
      <Dialog open={isOrdersModalOpen} onOpenChange={setIsOrdersModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <div className="flex items-center gap-2 text-primary border-b border-border pb-3">
            <Receipt className="size-5 shrink-0" aria-hidden="true" />
            <DialogTitle>Order History · Riwayat Pesanan</DialogTitle>
          </div>
          <DialogDescription>
            Past and active orders placed for your room stay.
          </DialogDescription>

          <div className="max-h-[60vh] overflow-y-auto divide-y divide-border py-2">
            {orders.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No orders placed yet. · Belum ada pesanan.
              </p>
            ) : (
              orders.map((o) => (
                <div key={o.id} className="flex flex-col gap-2 py-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono text-muted-foreground">
                      {o.id.slice(0, 8)}...
                    </span>
                    <div className="flex items-center gap-2">
                      {(() => {
                        const countdown = getOrderCountdown(o, now);
                        if (countdown) {
                          return (
                            <span
                              className={`inline-flex items-center gap-1 text-[11px] font-mono font-medium px-2 py-0.5 rounded-full border ${
                                countdown.isOverdue
                                  ? "text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/50"
                                  : "text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/50"
                              }`}
                            >
                              <Clock className="size-3" />
                              {countdown.formatted.split("·")[0].trim()}
                            </span>
                          );
                        }
                        if (o.etaMinutes !== null && o.etaMinutes !== undefined) {
                          return (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800/50">
                              <Clock className="size-3" />
                              ~{o.etaMinutes} mins
                            </span>
                          );
                        }
                        return null;
                      })()}
                      <Badge tone={o.status === "READY" || o.status === "SERVED" ? "ok" : o.status === "PREPARING" ? "brand" : "neutral"}>
                        {o.status}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex flex-col gap-0.5 text-xs text-foreground">
                    {o.items.map((it) => (
                      <div key={it.id} className="flex justify-between">
                        <span>
                          {it.qty}x {it.nameEn}
                        </span>
                        <span>{formatRupiah(it.qty * it.unitPrice)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between items-center text-xs font-bold border-t border-border/50 pt-1">
                    <span>Total</span>
                    <span className="text-primary">{formatRupiah(o.totalAmount)}</span>
                  </div>
                </div>
              ))
            )}
          </div>

          <Button
            type="button"
            variant="quiet"
            onClick={() => setIsOrdersModalOpen(false)}
            className="w-full mt-2"
          >
            Close · Tutup
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

