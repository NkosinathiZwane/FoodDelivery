import type {
  CartItem,
  CheckoutPaymentInput,
  OrderMessageDTO,
  PaymentMethod,
  PaymentStatus,
  StorePrepStatus,
} from '../types.ts';

export const FLAT_DELIVERY_FEE_CENTS = 2000;
export const MAX_ORDER_MESSAGE_LENGTH = 500;

export const ORDER_STATUS = {
  PREPARING: 'Preparing at Stores',
  READY_FOR_PICKUP: 'Ready for Driver Pickup',
  OUT_FOR_DELIVERY: 'Out for Delivery to Shabalala',
  DELIVERED: 'Delivered',
} as const;

export const STORE_PREP_STATUS: Record<'RECEIVED' | 'PREPARING' | 'READY', StorePrepStatus> = {
  RECEIVED: 'Received',
  PREPARING: 'Preparing',
  READY: 'Ready',
};

export const PAYMENT_METHODS: ReadonlyArray<{
  id: PaymentMethod;
  label: string;
  subtitle: string;
}> = [
  { id: 'card', label: 'Bank Card', subtitle: 'Visa / Mastercard debit or credit' },
  { id: 'eft', label: 'Instant EFT', subtitle: 'Capitec, FNB, Absa, Standard Bank, Nedbank' },
  { id: 'snapscan', label: 'SnapScan / Zapper', subtitle: 'Instant mobile QR payment' },
  { id: 'cash', label: 'Cash on Delivery', subtitle: 'Pay the driver at your doorstep' },
];

export const SA_EFT_BANKS = [
  'Capitec Bank',
  'FNB',
  'Standard Bank',
  'Absa',
  'Nedbank',
  'TymeBank',
] as const;

export function calculateCartTotals(
  items: Pick<CartItem, 'priceCents' | 'qty'>[],
  deliveryFeeCents: number = FLAT_DELIVERY_FEE_CENTS
): {
  itemCount: number;
  subtotalCents: number;
  deliveryFeeCents: number;
  totalCents: number;
} {
  let itemCount = 0;
  let subtotalCents = 0;

  for (const item of items) {
    const qty = Math.max(0, Math.floor(item.qty));
    const priceCents = Math.max(0, Math.round(item.priceCents));
    itemCount += qty;
    subtotalCents += priceCents * qty;
  }

  const appliedDelivery = itemCount > 0 ? deliveryFeeCents : 0;
  return {
    itemCount,
    subtotalCents,
    deliveryFeeCents: appliedDelivery,
    totalCents: subtotalCents + appliedDelivery,
  };
}

export function areAllStoresReady(storeReadiness: Record<string, boolean>): boolean {
  const entries = Object.values(storeReadiness);
  return entries.length > 0 && entries.every(Boolean);
}

export function computeStatusAfterStoreReady(
  storeReadiness: Record<string, boolean>,
  currentStatus: string
): string {
  if (
    currentStatus === ORDER_STATUS.OUT_FOR_DELIVERY ||
    currentStatus === ORDER_STATUS.DELIVERED
  ) {
    return currentStatus;
  }
  return areAllStoresReady(storeReadiness)
    ? ORDER_STATUS.READY_FOR_PICKUP
    : ORDER_STATUS.PREPARING;
}

export function canDriverAcceptOrder(
  storeReadiness: Record<string, boolean>,
  currentStatus: string,
  driverName: string | null
): boolean {
  return (
    areAllStoresReady(storeReadiness) &&
    !driverName &&
    currentStatus === ORDER_STATUS.READY_FOR_PICKUP
  );
}

export function validateCheckoutInput(
  items: Array<{ itemId: string; qty: number }>,
  deliveryAddress: string
): { valid: true; address: string } | { valid: false; error: string } {
  if (!items.length) {
    return { valid: false, error: 'Your black bag is empty.' };
  }
  for (const item of items) {
    if (!item.itemId || !Number.isInteger(item.qty) || item.qty < 1 || item.qty > 50) {
      return { valid: false, error: 'Invalid item quantity in black bag.' };
    }
  }
  const address = deliveryAddress.trim();
  if (address.length < 5) {
    return {
      valid: false,
      error: 'Please enter a delivery address in Shabalala or Hazyview (at least 5 characters).',
    };
  }
  return { valid: true, address };
}

export function validatePaymentInput(
  input: CheckoutPaymentInput
):
  | {
      valid: true;
      method: PaymentMethod;
      paymentStatus: PaymentStatus;
      paymentDetails: string;
    }
  | { valid: false; error: string } {
  const method = input?.method;
  if (!method || !['card', 'eft', 'snapscan', 'cash'].includes(method)) {
    return { valid: false, error: 'Please select a valid payment method.' };
  }

  if (method === 'card') {
    const holder = (input.cardHolder ?? '').trim();
    const digits = (input.cardNumber ?? '').replace(/\D/g, '');
    const expiry = (input.cardExpiry ?? '').trim();
    const cvv = (input.cardCvv ?? '').replace(/\D/g, '');

    if (holder.length < 2) {
      return { valid: false, error: 'Please enter the cardholder name.' };
    }
    if (digits.length < 13 || digits.length > 19) {
      return { valid: false, error: 'Please enter a valid 13 to 19 digit card number.' };
    }
    if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(expiry)) {
      return { valid: false, error: 'Please enter card expiry in MM/YY format.' };
    }
    if (cvv.length < 3 || cvv.length > 4) {
      return { valid: false, error: 'Please enter a valid 3 or 4 digit CVV.' };
    }
    const network = digits.startsWith('4')
      ? 'Visa'
      : digits.startsWith('5') || digits.startsWith('2')
      ? 'Mastercard'
      : 'Bank Card';
    return {
      valid: true,
      method,
      paymentStatus: 'Paid',
      paymentDetails: `${network} •••• ${digits.slice(-4)}`,
    };
  }

  if (method === 'eft') {
    const bank = (input.eftBank ?? '').trim();
    if (!bank) {
      return { valid: false, error: 'Please select your bank for Instant EFT.' };
    }
    return {
      valid: true,
      method,
      paymentStatus: 'Paid',
      paymentDetails: `${bank} Instant EFT`,
    };
  }

  if (method === 'snapscan') {
    const code = (input.snapCode ?? '').trim() || 'HAZY-QR';
    if (code.length < 3) {
      return { valid: false, error: 'Please confirm your SnapScan / Zapper reference.' };
    }
    return {
      valid: true,
      method,
      paymentStatus: 'Paid',
      paymentDetails: `SnapScan / Zapper (${code})`,
    };
  }

  return {
    valid: true,
    method: 'cash',
    paymentStatus: 'Cash on Delivery',
    paymentDetails: 'Cash on Delivery (Doorstep)',
  };
}

export type OrderTrackingStepStatus = 'completed' | 'active' | 'upcoming';

export interface OrderTrackingStep {
  key: 'preparing' | 'ready' | 'out_for_delivery' | 'delivered';
  label: string;
  description: string;
  status: OrderTrackingStepStatus;
}

export interface OrderTrackingState {
  activeStepIndex: number;
  progressPercent: number;
  isDelivered: boolean;
  steps: OrderTrackingStep[];
  storeBreakdown: Array<{ storeName: string; ready: boolean; prepStatus: StorePrepStatus }>;
  readyStoreCount: number;
  totalStoreCount: number;
}

export const ORDER_TRACKING_STEPS: ReadonlyArray<{
  key: OrderTrackingStep['key'];
  label: string;
  description: string;
}> = [
  {
    key: 'preparing',
    label: 'Preparing',
    description: 'Stores are preparing your order',
  },
  {
    key: 'ready',
    label: 'Ready',
    description: 'All stores ready for driver pickup',
  },
  {
    key: 'out_for_delivery',
    label: 'Out for Delivery',
    description: 'Driver is on the way to you',
  },
  {
    key: 'delivered',
    label: 'Delivered',
    description: 'Order delivered to your doorstep',
  },
];

export function resolveOrderStepIndex(
  status: string,
  storeReadiness: Record<string, boolean> = {},
  driverName: string | null = null
): number {
  if (status === ORDER_STATUS.DELIVERED) {
    return 3;
  }
  if (status === ORDER_STATUS.OUT_FOR_DELIVERY) {
    return 2;
  }
  if (status === ORDER_STATUS.READY_FOR_PICKUP) {
    return driverName ? 2 : 1;
  }
  if (areAllStoresReady(storeReadiness)) {
    return driverName ? 2 : 1;
  }
  return 0;
}

export function getOrderTrackingState(order: {
  status: string;
  stores: string[];
  storeReadiness: Record<string, boolean>;
  storePrepStatuses?: Record<string, StorePrepStatus>;
  driverName: string | null;
}): OrderTrackingState {
  const activeStepIndex = resolveOrderStepIndex(
    order.status,
    order.storeReadiness,
    order.driverName
  );
  const isDelivered = activeStepIndex === 3;
  const progressPercent = Math.round((activeStepIndex / (ORDER_TRACKING_STEPS.length - 1)) * 100);

  const steps: OrderTrackingStep[] = ORDER_TRACKING_STEPS.map((step, index) => {
    let status: OrderTrackingStepStatus;
    if (isDelivered || index < activeStepIndex) {
      status = 'completed';
    } else if (index === activeStepIndex) {
      status = 'active';
    } else {
      status = 'upcoming';
    }
    return {
      ...step,
      status,
    };
  });

  const storeNames =
    order.stores.length > 0 ? order.stores : Object.keys(order.storeReadiness);
  const storeBreakdown = storeNames.map((storeName) => {
    const ready = Boolean(order.storeReadiness[storeName]);
    const prepStatus: StorePrepStatus =
      order.storePrepStatuses?.[storeName] ?? (ready ? 'Ready' : 'Received');
    return {
      storeName,
      ready,
      prepStatus,
    };
  });
  const readyStoreCount = storeBreakdown.filter((s) => s.ready).length;

  return {
    activeStepIndex,
    progressPercent,
    isDelivered,
    steps,
    storeBreakdown,
    readyStoreCount,
    totalStoreCount: storeBreakdown.length,
  };
}

export function validateOrderMessage(
  rawBody: string
): { valid: true; body: string } | { valid: false; error: string } {
  const trimmed = rawBody.trim();
  if (!trimmed) {
    return { valid: false, error: 'Please enter a message before sending.' };
  }
  if (trimmed.length > MAX_ORDER_MESSAGE_LENGTH) {
    return {
      valid: false,
      error: `Message must be ${MAX_ORDER_MESSAGE_LENGTH} characters or fewer.`,
    };
  }
  return { valid: true, body: trimmed };
}

export function canUserMessageOrder(
  order: { buyerId: number; driverId: number | null },
  userId: number
):
  | { allowed: true; senderRole: 'buyer' | 'driver' }
  | { allowed: false; reason: 'forbidden' | 'driver_unassigned' } {
  const isBuyer = order.buyerId === userId;
  const isAssignedDriver = order.driverId !== null && order.driverId === userId;

  if (!isBuyer && !isAssignedDriver) {
    return { allowed: false, reason: 'forbidden' };
  }
  if (order.driverId === null) {
    return { allowed: false, reason: 'driver_unassigned' };
  }
  return { allowed: true, senderRole: isAssignedDriver ? 'driver' : 'buyer' };
}

export function mergeOrderMessagesIdempotent(
  existing: OrderMessageDTO[],
  incoming: OrderMessageDTO
): OrderMessageDTO[] {
  if (existing.some((m) => m.id === incoming.id)) {
    return existing;
  }
  return [...existing, incoming];
}


