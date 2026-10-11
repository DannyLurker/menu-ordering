// Public boundary for the orders feature slice.
// Other application modules import order operations from this entry point.
export {
  OrderServiceError,
  ORDER_DEDUP_WINDOW_MS,
  placeOrder,
  getStayOrders,
  getGuestMenu,
  hashCartItems,
  isOrderDuplicate,
  recordOrderDuplicate,
  clearOrderDedupCache,
  type PlacedOrderSummary,
  type GuestOrderHistoryItem,
} from "./services/orders.service";

export {
  createOrderInputSchema,
  orderItemInputSchema,
  calculateOrderTotal,
  validateOrderItems,
  type CreateOrderInput,
  type OrderItemInput,
  type ValidatedOrderItem,
  type OrderValidationResult,
} from "./orders.schemas";

export { GuestMenuView } from "./components/guest-menu-view";
export { PinCheckoutModal } from "./components/pin-checkout-modal";

