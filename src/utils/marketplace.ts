import type { StoreDTO, UserRole } from '../types.ts';

export const STORE_CATEGORIES = [
  'All',
  'Fast food',
  'Pizza',
  'Restaurant',
  'Groceries',
  'Community',
] as const;

export const ALLOWED_ROLES: readonly UserRole[] = ['buyer', 'driver', 'store', 'admin'];

export function formatZarFromCents(cents: number): string {
  const safeCents = Number.isFinite(cents) ? cents : 0;
  return `R${(safeCents / 100).toFixed(2)}`;
}

export function filterStores(
  stores: StoreDTO[],
  query: string,
  category: string
): StoreDTO[] {
  const normalizedQuery = query.trim().toLowerCase();
  const normalizedCategory = category.trim();

  return stores.filter((store) => {
    const matchCategory =
      !normalizedCategory ||
      normalizedCategory === 'All' ||
      store.category === normalizedCategory;

    if (!matchCategory) return false;
    if (!normalizedQuery) return true;

    const nameMatch = store.name.toLowerCase().includes(normalizedQuery);
    const categoryMatch = store.category.toLowerCase().includes(normalizedQuery);
    const menuMatch = store.menu.some((item) =>
      item.name.toLowerCase().includes(normalizedQuery)
    );
    return nameMatch || categoryMatch || menuMatch;
  });
}

export function validateEmail(email: string): boolean {
  const trimmed = email.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}

export function validateVendorPayload(input: {
  name: string;
  category: string;
  dishName: string;
  priceZar: number;
}): { valid: true } | { valid: false; error: string } {
  if (!input.name.trim() || input.name.trim().length < 2) {
    return { valid: false, error: 'Vendor name must be at least 2 characters.' };
  }
  if (!input.category.trim()) {
    return { valid: false, error: 'Please select a category.' };
  }
  if (!input.dishName.trim() || input.dishName.trim().length < 2) {
    return { valid: false, error: 'Signature dish name is required.' };
  }
  if (!Number.isFinite(input.priceZar) || input.priceZar <= 0 || input.priceZar > 5000) {
    return { valid: false, error: 'Price must be between R1 and R5000.' };
  }
  return { valid: true };
}

export type AuthFormErrors = Partial<
  Record<
    | 'name'
    | 'phone'
    | 'vehicle'
    | 'storeName'
    | 'adminCode'
    | 'email'
    | 'password'
    | 'confirmPassword',
    string
  >
>;

export function validateSignInInput(input: {
  email: string;
  password: string;
}): { valid: true } | { valid: false; error: string; fieldErrors: AuthFormErrors } {
  const fieldErrors: AuthFormErrors = {};
  if (!validateEmail(input.email)) {
    fieldErrors.email = 'Please enter a valid email address.';
  }
  if (input.password.length < 6) {
    fieldErrors.password = 'Password must be at least 6 characters.';
  }
  const firstError = fieldErrors.email || fieldErrors.password;
  if (firstError) {
    return { valid: false, error: firstError, fieldErrors };
  }
  return { valid: true };
}

export function validateSignUpInput(input: {
  name: string;
  phone: string;
  role: UserRole;
  vehicle: string;
  storeName: string;
  adminCode: string;
  email: string;
  password: string;
  confirmPassword: string;
}): { valid: true } | { valid: false; error: string; fieldErrors: AuthFormErrors } {
  const fieldErrors: AuthFormErrors = {};

  if (input.name.trim().length < 2) {
    fieldErrors.name = 'Please enter your full name (at least 2 characters).';
  }
  const digitsOnly = input.phone.replace(/\D/g, '');
  if (digitsOnly.length < 7) {
    fieldErrors.phone = 'Please enter a valid phone number (at least 7 digits).';
  }
  if (input.role === 'driver' && input.vehicle.trim().length < 3) {
    fieldErrors.vehicle = 'Please enter your vehicle type and registration.';
  }
  if (input.role === 'store' && input.storeName.trim().length < 2) {
    fieldErrors.storeName = 'Please select or enter your store or restaurant name.';
  }
  if (input.role === 'admin' && input.adminCode.trim().length < 1) {
    fieldErrors.adminCode = 'Admin Access Code is required.';
  }
  if (!validateEmail(input.email)) {
    fieldErrors.email = 'Please enter a valid email address.';
  }
  if (input.password.length < 6) {
    fieldErrors.password = 'Password must be at least 6 characters.';
  }
  if (input.confirmPassword !== input.password) {
    fieldErrors.confirmPassword = 'Passwords do not match.';
  }

  const firstError = Object.values(fieldErrors)[0];
  if (firstError) {
    return { valid: false, error: firstError, fieldErrors };
  }
  return { valid: true };
}

