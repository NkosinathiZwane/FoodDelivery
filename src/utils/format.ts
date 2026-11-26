import type { CartItem, MenuItem, MenuItemGroup, OrderStatus, StorePartStatus } from '../types';

export const FLAT_DELIVERY_FEE = 20;

const GROUP_RANK: Record<MenuItemGroup, number> = {
  main: 0,
  side: 1,
  extra: 2,
  drink: 3,
};

const SIZE_ORDER: [RegExp, number][] = [
  [/\bsmall\b/i, 1],
  [/\bmedium\b/i, 2],
  [/\blarge\b(?!.*triple)/i, 3],
  [/\bextra\s*large\b|\bxl\b|\bxxl\b/i, 4],
  [/\btriple[-\s]*decker\b/i, 5],
];

function sizeRank(name: string): number {
  for (const [pattern, rank] of SIZE_ORDER) {
    if (pattern.test(name)) return rank;
  }
  return 99;
}

export function formatZar(amount: number | string): string {
  const num = Number(amount);
  const safe = Number.isFinite(num) ? num : 0;
  return `R${safe.toFixed(2)}`;
}

export function formatSaDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-ZA', {
    timeZone: 'Africa/Johannesburg',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

export function isSameSaDay(iso: string | null | undefined, now = new Date()): boolean {
  if (!iso) return false;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return false;
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Johannesburg',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return fmt.format(date) === fmt.format(now);
}

export function normalizeZaDigits(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('27')) return digits;
  if (digits.startsWith('0')) return `27${digits.slice(1)}`;
  return digits;
}

export function toTelHref(phone: string): string {
  const cleaned = phone.replace(/[^+\d]/g, '');
  return cleaned ? `tel:${cleaned}` : '#';
}

export function toWhatsAppUrl(phone: string, text = ''): string {
  const wa = normalizeZaDigits(phone);
  if (!wa) return '#';
  const suffix = text ? `?text=${encodeURIComponent(text)}` : '';
  return `https://wa.me/${wa}${suffix}`;
}

export function sortMenuItems(items: MenuItem[]): MenuItem[] {
  return [...items].sort((a, b) => {
    const groupDiff = (GROUP_RANK[a.item_group] ?? 9) - (GROUP_RANK[b.item_group] ?? 9);
    if (groupDiff !== 0) return groupDiff;
    const orderDiff = (a.sort_order ?? 0) - (b.sort_order ?? 0);
    if (orderDiff !== 0) return orderDiff;
    const sizeDiff = sizeRank(a.name) - sizeRank(b.name);
    if (sizeDiff !== 0) return sizeDiff;
    return a.price - b.price;
  });
}

export function menuGroupLabel(group: MenuItemGroup): string {
  if (group === 'main') return 'Mains & Meals';
  if (group === 'side') return 'Sides';
  if (group === 'extra') return 'Extras';
  return 'Drinks & Bundles';
}

export function storeHasMainInCart(cart: CartItem[], storeId: string): boolean {
  return cart.some((item) => item.storeId === storeId && item.itemGroup === 'main' && item.qty > 0);
}

export function canAddMenuItemToCart(
  cart: CartItem[],
  storeId: string,
  item: Pick<MenuItem, 'item_group' | 'is_available'>,
  storeOpen: boolean
): { allowed: boolean; reason?: string } {
  if (!storeOpen) {
    return { allowed: false, reason: 'This store is currently closed.' };
  }
  if (!item.is_available) {
    return { allowed: false, reason: 'This item is currently sold out.' };
  }
  if (item.item_group !== 'main' && !storeHasMainInCart(cart, storeId)) {
    return {
      allowed: false,
      reason: 'Add a main meal from this store first before adding sides, extras, or drinks.',
    };
  }
  return { allowed: true };
}

export function removeCartItemCleanly(cart: CartItem[], menuItemId: string): CartItem[] {
  const target = cart.find((c) => c.menuItemId === menuItemId);
  if (!target) return cart;

  const remaining = cart.filter((c) => c.menuItemId !== menuItemId);
  if (target.itemGroup === 'main') {
    const stillHasMain = remaining.some(
      (c) => c.storeId === target.storeId && c.itemGroup === 'main' && c.qty > 0
    );
    if (!stillHasMain) {
      return remaining.filter((c) => c.storeId !== target.storeId);
    }
  }
  return remaining;
}

export function calculateCartTotals(cart: CartItem[]): {
  itemCount: number;
  subtotal: number;
  deliveryFee: number;
  total: number;
} {
  const itemCount = cart.reduce((sum, item) => sum + item.qty, 0);
  const subtotal = cart.reduce((sum, item) => sum + Number(item.price) * item.qty, 0);
  const deliveryFee = itemCount > 0 ? FLAT_DELIVERY_FEE : 0;
  return {
    itemCount,
    subtotal,
    deliveryFee,
    total: subtotal + deliveryFee,
  };
}

export function formatOrderStatus(status: OrderStatus): string {
  switch (status) {
    case 'placed':
      return 'Order Placed';
    case 'preparing':
      return 'Preparing';
    case 'ready_for_pickup':
      return 'Ready for Pickup';
    case 'out_for_delivery':
      return 'Out for Delivery';
    case 'delivered':
      return 'Delivered';
    case 'cancelled':
      return 'Cancelled';
    default:
      return status;
  }
}

export function formatStorePartStatus(status: StorePartStatus): string {
  switch (status) {
    case 'pending':
      return 'Pending';
    case 'accepted':
      return 'Preparing';
    case 'ready':
      return 'Ready';
    case 'rejected':
      return 'Declined';
    default:
      return status;
  }
}

export function getTimelineSteps(status: OrderStatus): {
  key: OrderStatus;
  label: string;
  state: 'done' | 'current' | 'upcoming';
}[] {
  const steps: { key: OrderStatus; label: string }[] = [
    { key: 'placed', label: 'Placed' },
    { key: 'preparing', label: 'Preparing' },
    { key: 'ready_for_pickup', label: 'Ready' },
    { key: 'out_for_delivery', label: 'On the Way' },
    { key: 'delivered', label: 'Delivered' },
  ];
  const currentIdx = steps.findIndex((s) => s.key === status);
  return steps.map((step, idx) => {
    if (status === 'cancelled' || currentIdx === -1) {
      return { ...step, state: 'upcoming' };
    }
    if (idx < currentIdx) return { ...step, state: 'done' };
    if (idx === currentIdx) return { ...step, state: 'current' };
    return { ...step, state: 'upcoming' };
  });
}

export function validateAuthForm(input: {
  mode: 'signin' | 'signup' | 'forgot';
  email: string;
  password: string;
  name?: string;
  phone?: string;
  role?: string;
  vehicle?: string;
  storeName?: string;
}): string | null {
  const email = input.email.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return 'Please enter a valid email address.';
  }
  if (input.mode === 'forgot') {
    return null;
  }
  if (input.password.length < 8) {
    return 'Password must be at least 8 characters long.';
  }
  if (input.mode === 'signup') {
    if (!input.name || input.name.trim().length < 2) {
      return 'Please enter your full name.';
    }
    if (!input.phone || input.phone.replace(/\D/g, '').length < 7) {
      return 'Please enter a valid phone number.';
    }
    if (!['buyer', 'driver', 'store'].includes(input.role || '')) {
      return 'Please select a valid account role.';
    }
    if (input.role === 'driver' && (!input.vehicle || input.vehicle.trim().length < 3)) {
      return 'Please enter your vehicle type and registration.';
    }
    if (input.role === 'store' && (!input.storeName || input.storeName.trim().length < 2)) {
      return 'Please enter your store or business name.';
    }
  }
  return null;
}

export function validateCheckoutForm(address: string, phone: string, cart: CartItem[]): string | null {
  if (!cart.length) {
    return 'Your black bag is empty.';
  }
  if (address.trim().length < 5) {
    return 'Please enter your delivery address in Shabalala or Hazyview.';
  }
  if (phone.replace(/\D/g, '').length < 7) {
    return 'Please enter a valid contact phone number.';
  }
  const storeIdsWithAddons = new Set(
    cart.filter((c) => c.itemGroup !== 'main').map((c) => c.storeId)
  );
  for (const storeId of storeIdsWithAddons) {
    if (!storeHasMainInCart(cart, storeId)) {
      const storeName = cart.find((c) => c.storeId === storeId)?.storeName || 'this store';
      return `Add a main meal from ${storeName} before ordering sides, extras, or drinks.`;
    }
  }
  return null;
}
