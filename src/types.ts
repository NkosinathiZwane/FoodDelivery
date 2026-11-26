export type UserRole = 'buyer' | 'driver' | 'store' | 'admin';

export type MenuItemGroup = 'main' | 'side' | 'extra' | 'drink';

export type OrderStatus =
  | 'placed'
  | 'preparing'
  | 'ready_for_pickup'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled';

export type StorePartStatus = 'pending' | 'accepted' | 'rejected' | 'ready';

export interface Profile {
  id: string;
  role: UserRole;
  name: string;
  phone: string;
  vehicle: string;
  is_online: boolean;
  is_active: boolean;
  needs_onboarding: boolean;
  created_at?: string;
}

export interface MenuItem {
  id: string;
  store_id: string;
  name: string;
  price: number;
  item_group: MenuItemGroup;
  image_url: string;
  is_available: boolean;
  sort_order: number;
}

export interface Store {
  id: string;
  slug: string;
  owner_id: string | null;
  name: string;
  category: string;
  delivery_time: string;
  is_community: boolean;
  logo_url: string;
  is_open: boolean;
  is_approved: boolean;
  menu: MenuItem[];
}

export interface CartItem {
  storeId: string;
  storeName: string;
  menuItemId: string;
  itemName: string;
  price: number;
  itemGroup: MenuItemGroup;
  qty: number;
}

export interface BuyerOrderPart {
  id: string;
  store_id: string;
  store_name: string;
  status: StorePartStatus;
  reason: string;
}

export interface BuyerOrderItem {
  id: string;
  store_id: string;
  store_name: string;
  name: string;
  price: number;
  qty: number;
}

export interface BuyerOrder {
  id: string;
  code: string;
  address: string;
  buyer_phone: string;
  notes: string;
  subtotal: number;
  delivery_fee: number;
  total: number;
  status: OrderStatus;
  driver_id: string | null;
  created_at: string;
  picked_up_at: string | null;
  delivered_at: string | null;
  cancelled_at: string | null;
  driver: {
    id: string;
    name: string;
    phone: string;
    vehicle: string;
  } | null;
  parts: BuyerOrderPart[];
  items: BuyerOrderItem[];
}

export interface StoreOrderPartView {
  part_id: string;
  order_id: string;
  order_code: string;
  order_status: OrderStatus;
  part_status: StorePartStatus;
  reason: string;
  buyer_first_name: string;
  created_at: string;
  store_subtotal: number;
  items: {
    id: string;
    name: string;
    price: number;
    qty: number;
  }[];
}

export interface DriverJobStore {
  store_id: string;
  store_name: string;
  items: { name: string; qty: number }[];
}

export interface DriverAvailableJob {
  id: string;
  code: string;
  delivery_fee: number;
  status: OrderStatus;
  created_at: string;
  stores: DriverJobStore[];
}

export interface DriverActiveJob {
  id: string;
  code: string;
  status: OrderStatus;
  delivery_fee: number;
  total: number;
  buyer_name: string;
  buyer_phone: string;
  address: string;
  notes: string;
  created_at: string;
  picked_up_at: string | null;
  stores: DriverJobStore[];
}

export interface DriverHistoryJob {
  id: string;
  code: string;
  delivery_fee: number;
  delivered_at: string | null;
  store_names: string[];
}

export interface DriverDashboardData {
  available: DriverAvailableJob[];
  active: DriverActiveJob[];
  history: DriverHistoryJob[];
}

export interface AdminDashboardData {
  stats: {
    gmv: number;
    orders: number;
    users: number;
    stores: number;
  };
  stores: {
    id: string;
    name: string;
    category: string;
    delivery_time: string;
    is_community: boolean;
    is_open: boolean;
    is_approved: boolean;
    owner_email: string;
    owner_name: string;
  }[];
  drivers: {
    id: string;
    name: string;
    phone: string;
    vehicle: string;
    is_online: boolean;
  }[];
  users: {
    id: string;
    email: string;
    name: string;
    role: UserRole;
    phone: string;
    is_active: boolean;
    created_at: string;
  }[];
  orders: {
    id: string;
    code: string;
    buyer_name: string;
    driver_id: string | null;
    driver_name: string;
    address: string;
    total: number;
    status: OrderStatus;
    created_at: string;
  }[];
}

export interface AppNotification {
  id: string;
  user_id: string;
  order_id: string | null;
  text: string;
  is_read: boolean;
  created_at: string;
}

export interface ToastMessage {
  id: string;
  text: string;
  tone: 'info' | 'success' | 'error';
}
