export type UserRole = 'buyer' | 'driver' | 'store' | 'admin';

export interface UserProfile {
  id: number;
  uid: string;
  email: string;
  name: string;
  phone: string;
  role: UserRole;
  vehicle: string;
  storeName: string;
  authProvider: 'local' | 'google';
}

export interface MenuItemDTO {
  id: string;
  storeId: string;
  name: string;
  priceCents: number;
  price: number;
  available: boolean;
}

export interface StoreDTO {
  id: string;
  name: string;
  category: string;
  time: string;
  isCommunity: boolean;
  logo: string;
  menu: MenuItemDTO[];
}

export interface CartItem {
  storeId: string;
  storeName: string;
  itemId: string;
  itemName: string;
  priceCents: number;
  price: number;
  qty: number;
}

export interface OrderItemDTO {
  id: number;
  orderId: string;
  storeId: string;
  storeName: string;
  itemId: string;
  itemName: string;
  priceCents: number;
  price: number;
  qty: number;
}

export type PaymentMethod = 'card' | 'eft' | 'snapscan' | 'cash';
export type PaymentStatus = 'Paid' | 'Cash on Delivery' | 'Pending Payment';
export type StorePrepStatus = 'Received' | 'Preparing' | 'Ready';

export interface CheckoutPaymentInput {
  method: PaymentMethod;
  cardHolder?: string;
  cardNumber?: string;
  cardExpiry?: string;
  cardCvv?: string;
  eftBank?: string;
  snapCode?: string;
}

export interface OrderDTO {
  id: string;
  buyerId: number;
  buyerEmail: string;
  buyerName: string;
  address: string;
  deliveryFeeCents: number;
  totalCents: number;
  total: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  paymentReference: string;
  paymentDetails: string;
  status: string;
  driverId: number | null;
  driverName: string | null;
  stores: string[];
  storeReadiness: Record<string, boolean>;
  storePrepStatuses: Record<string, StorePrepStatus>;
  items: OrderItemDTO[];
  createdAt: string;
  createdAtIso: string;
}

export interface OrderMessageDTO {
  id: number;
  orderId: string;
  senderId: number;
  senderName: string;
  senderRole: 'buyer' | 'driver';
  body: string;
  createdAt: string;
  createdAtIso: string;
}

export interface AdminOverviewDTO {
  totalGmvCents: number;
  totalGmv: number;
  activeStores: number;
  registeredUsers: number;
  totalOrders: number;
  recentUsers: Array<{
    id: number;
    name: string;
    email: string;
    role: UserRole;
    storeName: string;
  }>;
}

export type DriverApplicationStatus = 'Pending Review' | 'Approved' | 'Rejected';

export interface DriverDocumentInput {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  dataBase64: string;
}

export interface DriverDocumentSummary {
  id: number;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

export interface DriverOnboardingPayload {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  streetAddress: string;
  streetAddressLine2: string;
  city: string;
  stateProvince: string;
  postalCode: string;
  dateOfBirth: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  preferredArea: string;
  vehicleType: string;
  driversLicenseType: string;
  availability: string;
  hasPriorExperience: boolean | null;
  documents: DriverDocumentInput[];
  signatureDataUrl: string;
}

export interface DriverApplicationDTO {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  streetAddress: string;
  streetAddressLine2: string;
  city: string;
  stateProvince: string;
  postalCode: string;
  dateOfBirth: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  preferredArea: string;
  vehicleType: string;
  driversLicenseType: string;
  availability: string;
  hasPriorExperience: boolean;
  signatureDataUrl: string;
  status: DriverApplicationStatus;
  documents: DriverDocumentSummary[];
  createdAt: string;
}
