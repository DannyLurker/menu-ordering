// Public boundary for the kitchen feature slice (spec 0010).
// Other application modules import kitchen operations from this entry point.
export {
  KitchenServiceError,
  getActiveKitchenOrders,
  verifyKitchenOrder,
  updateKitchenOrderEta,
  markKitchenOrderReady,
  markKitchenOrderServed,
  cancelKitchenOrder,
} from "./services/kitchen.service";

export {
  verifyOrderInputSchema,
  updateEtaInputSchema,
  cancelOrderInputSchema,
  type VerifyOrderInput,
  type UpdateEtaInput,
  type CancelOrderInput,
} from "./kitchen.schemas";

export type {
  KitchenOrder,
  KitchenOrderItem,
  ActiveKitchenOrders,
  VerifyOrderResult,
  UpdateEtaResult,
  MarkReadyResult,
  MarkServedResult,
  CancelOrderResult,
} from "./kitchen.types";

export { KitchenLiveBoard } from "./components/kitchen-live-board";
