import { SEED_STORES } from '../data/seedCatalog';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import type {
  AdminDashboardData,
  AppNotification,
  BuyerOrder,
  CartItem,
  DriverDashboardData,
  MenuItem,
  MenuItemGroup,
  Profile,
  Store,
  StoreOrderPartView,
  UserRole,
} from '../types';

const CART_STORAGE_KEY = 'hazyeats_cart_v1';

function requireSupabase() {
  if (!supabase || !isSupabaseConfigured) {
    throw new Error(
      'Supabase is not configured yet. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file.'
    );
  }
  return supabase;
}

export function loadCart(): CartItem[] {
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function persistCart(items: CartItem[]): void {
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Ignore storage quota errors
  }
}

export async function fetchMarketplaceStores(): Promise<Store[]> {
  if (!supabase || !isSupabaseConfigured) {
    return SEED_STORES;
  }

  const { data: stores, error: storeErr } = await supabase
    .from('stores')
    .select('id, slug, owner_id, name, category, delivery_time, is_community, logo_url, is_open, is_approved')
    .eq('is_approved', true)
    .order('is_community', { ascending: true })
    .order('name', { ascending: true });

  if (storeErr) throw storeErr;
  if (!stores || stores.length === 0) return [];

  const storeIds = stores.map((s) => s.id);
  const { data: menuRows, error: menuErr } = await supabase
    .from('menu_items')
    .select('id, store_id, name, price, item_group, image_url, is_available, sort_order')
    .in('store_id', storeIds)
    .order('sort_order', { ascending: true });

  if (menuErr) throw menuErr;

  const grouped = new Map<string, MenuItem[]>();
  for (const row of menuRows || []) {
    const list = grouped.get(row.store_id) || [];
    list.push({
      id: row.id,
      store_id: row.store_id,
      name: row.name,
      price: Number(row.price),
      item_group: (row.item_group as MenuItemGroup) || 'main',
      image_url: row.image_url || '',
      is_available: Boolean(row.is_available),
      sort_order: Number(row.sort_order ?? 0),
    });
    grouped.set(row.store_id, list);
  }

  return stores.map((s) => ({
    id: s.id,
    slug: s.slug || s.id,
    owner_id: s.owner_id,
    name: s.name,
    category: s.category,
    delivery_time: s.delivery_time,
    is_community: Boolean(s.is_community),
    logo_url: s.logo_url || '',
    is_open: Boolean(s.is_open),
    is_approved: Boolean(s.is_approved),
    menu: grouped.get(s.id) || [],
  }));
}

export async function fetchCurrentSessionAndProfile(): Promise<{
  userId: string | null;
  email: string;
  profile: Profile | null;
}> {
  if (!supabase || !isSupabaseConfigured) {
    return { userId: null, email: '', profile: null };
  }

  const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
  if (sessionErr) throw sessionErr;
  const user = sessionData.session?.user;
  if (!user) {
    return { userId: null, email: '', profile: null };
  }

  const { data: profile, error: profErr } = await supabase
    .from('profiles')
    .select('id, role, name, phone, vehicle, is_online, is_active, needs_onboarding, created_at')
    .eq('id', user.id)
    .maybeSingle();

  if (profErr) throw profErr;

  return {
    userId: user.id,
    email: user.email || '',
    profile: profile as Profile | null,
  };
}

export async function signInWithEmail(email: string, password: string): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  if (error) throw error;
}

export async function signUpWithEmail(params: {
  email: string;
  password: string;
  name: string;
  phone: string;
  role: 'buyer' | 'driver' | 'store';
  vehicle?: string;
  storeName?: string;
}): Promise<{ needsEmailConfirmation: boolean }> {
  const client = requireSupabase();
  const { data, error } = await client.auth.signUp({
    email: params.email.trim(),
    password: params.password,
    options: {
      emailRedirectTo: window.location.origin,
      data: {
        name: params.name.trim(),
        phone: params.phone.trim(),
        role: params.role,
        vehicle: params.role === 'driver' ? (params.vehicle || '').trim() : '',
        store_name: params.role === 'store' ? (params.storeName || '').trim() : '',
      },
    },
  });
  if (error) throw error;
  return { needsEmailConfirmation: !data.session };
}

export async function signInWithGoogle(): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin,
    },
  });
  if (error) throw error;
}

export async function sendPasswordReset(email: string): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: window.location.origin,
  });
  if (error) throw error;
}

export async function signOutUser(): Promise<void> {
  if (!supabase || !isSupabaseConfigured) return;
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function completeGoogleOnboarding(params: {
  role: 'buyer' | 'driver' | 'store';
  name: string;
  phone: string;
  vehicle?: string;
  storeName?: string;
  storeCategory?: string;
}): Promise<Profile> {
  const client = requireSupabase();
  const { data, error } = await client.rpc('complete_google_onboarding', {
    p_role: params.role,
    p_name: params.name.trim(),
    p_phone: params.phone.trim(),
    p_vehicle: (params.vehicle || '').trim(),
    p_store_name: (params.storeName || '').trim(),
    p_store_category: (params.storeCategory || 'Restaurant').trim(),
  });
  if (error) throw error;
  return data as Profile;
}

// =========================================================
// BUYER ACTIONS
// =========================================================

export async function placeOrder(params: {
  address: string;
  phone: string;
  notes: string;
  items: { menuItemId: string; qty: number }[];
}): Promise<{ order_id: string; code: string; total: number }> {
  const client = requireSupabase();
  const { data, error } = await client.rpc('place_order', {
    p_address: params.address.trim(),
    p_phone: params.phone.trim(),
    p_notes: params.notes.trim(),
    p_items: params.items,
  });
  if (error) throw error;
  return data as { order_id: string; code: string; total: number };
}

export async function fetchBuyerOrders(): Promise<BuyerOrder[]> {
  if (!supabase || !isSupabaseConfigured) return [];
  const { data, error } = await supabase.rpc('get_buyer_orders');
  if (error) throw error;
  return (Array.isArray(data) ? data : []) as BuyerOrder[];
}

export async function cancelBuyerOrder(orderId: string): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.rpc('buyer_cancel_order', { p_order_id: orderId });
  if (error) throw error;
}

// =========================================================
// STORE OWNER ACTIONS
// =========================================================

export async function fetchMyStore(ownerId: string): Promise<Store | null> {
  if (!supabase || !isSupabaseConfigured) return null;
  const { data: store, error } = await supabase
    .from('stores')
    .select('id, slug, owner_id, name, category, delivery_time, is_community, logo_url, is_open, is_approved')
    .eq('owner_id', ownerId)
    .maybeSingle();

  if (error) throw error;
  if (!store) return null;

  const { data: menuRows, error: menuErr } = await supabase
    .from('menu_items')
    .select('id, store_id, name, price, item_group, image_url, is_available, sort_order')
    .eq('store_id', store.id)
    .order('sort_order', { ascending: true });

  if (menuErr) throw menuErr;

  return {
    id: store.id,
    slug: store.slug || store.id,
    owner_id: store.owner_id,
    name: store.name,
    category: store.category,
    delivery_time: store.delivery_time,
    is_community: Boolean(store.is_community),
    logo_url: store.logo_url || '',
    is_open: Boolean(store.is_open),
    is_approved: Boolean(store.is_approved),
    menu: (menuRows || []).map((row) => ({
      id: row.id,
      store_id: row.store_id,
      name: row.name,
      price: Number(row.price),
      item_group: (row.item_group as MenuItemGroup) || 'main',
      image_url: row.image_url || '',
      is_available: Boolean(row.is_available),
      sort_order: Number(row.sort_order ?? 0),
    })),
  };
}

export async function updateStoreDetails(
  storeId: string,
  patch: Partial<Pick<Store, 'name' | 'category' | 'delivery_time' | 'is_open' | 'logo_url'>>
): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.from('stores').update(patch).eq('id', storeId);
  if (error) throw error;
}

export async function saveMenuItem(params: {
  id?: string;
  store_id: string;
  name: string;
  price: number;
  item_group: MenuItemGroup;
  image_url?: string;
  is_available?: boolean;
  sort_order?: number;
}): Promise<void> {
  const client = requireSupabase();
  if (params.id) {
    const { error } = await client
      .from('menu_items')
      .update({
        name: params.name.trim(),
        price: params.price,
        item_group: params.item_group,
        image_url: params.image_url ?? '',
        is_available: params.is_available ?? true,
        sort_order: params.sort_order ?? 0,
      })
      .eq('id', params.id);
    if (error) throw error;
  } else {
    const { error } = await client.from('menu_items').insert({
      store_id: params.store_id,
      name: params.name.trim(),
      price: params.price,
      item_group: params.item_group,
      image_url: params.image_url ?? '',
      is_available: params.is_available ?? true,
      sort_order: params.sort_order ?? 10,
    });
    if (error) throw error;
  }
}

export async function toggleMenuItemAvailability(itemId: string, isAvailable: boolean): Promise<void> {
  const client = requireSupabase();
  const { error } = await client
    .from('menu_items')
    .update({ is_available: isAvailable })
    .eq('id', itemId);
  if (error) throw error;
}

export async function removeMenuItem(itemId: string): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.from('menu_items').delete().eq('id', itemId);
  if (error) throw error;
}

export async function uploadStoreAsset(
  folder: 'logos' | 'items',
  storeId: string,
  file: File
): Promise<string> {
  const client = requireSupabase();
  const ext = file.name.split('.').pop()?.replace(/[^a-zA-Z0-9]/g, '') || 'jpg';
  const filePath = `${folder}/${storeId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error: uploadErr } = await client.storage
    .from('store-assets')
    .upload(filePath, file, { upsert: true });
  if (uploadErr) throw uploadErr;

  const { data } = client.storage.from('store-assets').getPublicUrl(filePath);
  return data.publicUrl;
}

export async function fetchStoreOrders(): Promise<StoreOrderPartView[]> {
  if (!supabase || !isSupabaseConfigured) return [];
  const { data, error } = await supabase.rpc('get_store_orders');
  if (error) throw error;
  return (Array.isArray(data) ? data : []) as StoreOrderPartView[];
}

export async function respondToStoreOrderPart(
  partId: string,
  action: 'accept' | 'reject' | 'ready',
  reason = ''
): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.rpc('store_respond_order_part', {
    p_part_id: partId,
    p_action: action,
    p_reason: reason.trim(),
  });
  if (error) throw error;
}

// =========================================================
// DRIVER ACTIONS
// =========================================================

export async function setDriverOnline(online: boolean): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.rpc('driver_set_online', { p_online: online });
  if (error) throw error;
}

export async function fetchDriverDashboard(): Promise<DriverDashboardData> {
  if (!supabase || !isSupabaseConfigured) {
    return { available: [], active: [], history: [] };
  }
  const { data, error } = await supabase.rpc('get_driver_dashboard');
  if (error) throw error;
  return (data || { available: [], active: [], history: [] }) as DriverDashboardData;
}

export async function acceptDriverJob(orderId: string): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.rpc('driver_accept_job', { p_order_id: orderId });
  if (error) throw error;
}

export async function updateDriverDeliveryStatus(
  orderId: string,
  status: 'out_for_delivery' | 'delivered'
): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.rpc('driver_update_delivery_status', {
    p_order_id: orderId,
    p_status: status,
  });
  if (error) throw error;
}

// =========================================================
// ADMIN ACTIONS
// =========================================================

export async function fetchAdminDashboard(): Promise<AdminDashboardData> {
  const client = requireSupabase();
  const { data, error } = await client.rpc('get_admin_dashboard');
  if (error) throw error;
  return data as AdminDashboardData;
}

export async function adminSetStoreApproval(storeId: string, approved: boolean): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.rpc('admin_set_store_approval', {
    p_store_id: storeId,
    p_approved: approved,
  });
  if (error) throw error;
}

export async function adminOnboardVendor(params: {
  name: string;
  category: string;
  dishName: string;
  price: number;
  ownerEmail?: string;
}): Promise<string> {
  const client = requireSupabase();
  const { data, error } = await client.rpc('admin_onboard_vendor', {
    p_name: params.name.trim(),
    p_category: params.category.trim(),
    p_dish_name: params.dishName.trim(),
    p_price: params.price,
    p_owner_email: (params.ownerEmail || '').trim(),
  });
  if (error) throw error;
  return String(data);
}

export async function adminCancelOrder(orderId: string): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.rpc('admin_cancel_order', { p_order_id: orderId });
  if (error) throw error;
}

export async function adminReassignDriver(orderId: string, driverId: string): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.rpc('admin_reassign_driver', {
    p_order_id: orderId,
    p_driver_id: driverId,
  });
  if (error) throw error;
}

export async function adminSetUserActive(userId: string, active: boolean): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.rpc('admin_set_user_active', {
    p_user_id: userId,
    p_active: active,
  });
  if (error) throw error;
}

// =========================================================
// NOTIFICATIONS & REALTIME
// =========================================================

export async function fetchNotifications(userId: string): Promise<AppNotification[]> {
  if (!supabase || !isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from('notifications')
    .select('id, user_id, order_id, text, is_read, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) throw error;
  return (data || []) as AppNotification[];
}

export async function markNotificationsRead(userId: string): Promise<void> {
  if (!supabase || !isSupabaseConfigured) return;
  await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', userId)
    .eq('is_read', false);
}

export function subscribeRealtimeUpdates(params: {
  userId: string | null;
  role: UserRole | null;
  onOrdersOrPartsChange: () => void;
  onMenuChange: () => void;
  onNotificationInsert: (notif: AppNotification) => void;
}): () => void {
  if (!supabase || !isSupabaseConfigured) {
    return () => undefined;
  }

  const client = supabase;
  const channel = client
    .channel(`hazyeats-live-${params.userId || 'anon'}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'menu_items' },
      () => params.onMenuChange()
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'orders' },
      () => params.onOrdersOrPartsChange()
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'order_store_parts' },
      () => params.onOrdersOrPartsChange()
    );

  if (params.userId) {
    channel.on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${params.userId}`,
      },
      (payload) => {
        if (payload.new) {
          params.onNotificationInsert(payload.new as AppNotification);
        }
      }
    );
  }

  channel.subscribe();

  return () => {
    void client.removeChannel(channel);
  };
}
