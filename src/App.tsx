import { useCallback, useEffect, useState } from 'react';
import { AdminDashboard } from './components/AdminDashboard';
import { AuthModal } from './components/AuthModal';
import { BuyerDashboard } from './components/BuyerDashboard';
import { CartModal } from './components/CartModal';
import { DriverDashboard } from './components/DriverDashboard';
import { GoogleOnboardingModal } from './components/GoogleOnboardingModal';
import { Header } from './components/Header';
import { MarketplaceView } from './components/MarketplaceView';
import { SplashScreen } from './components/SplashScreen';
import { StoreDashboard } from './components/StoreDashboard';
import { StoreMenuModal } from './components/StoreMenuModal';
import { ToastContainer } from './components/ToastContainer';
import { isSupabaseConfigured, supabase } from './lib/supabase';
import {
  acceptDriverJob,
  adminCancelOrder,
  adminOnboardVendor,
  adminReassignDriver,
  adminSetStoreApproval,
  adminSetUserActive,
  cancelBuyerOrder,
  completeGoogleOnboarding,
  fetchAdminDashboard,
  fetchBuyerOrders,
  fetchCurrentSessionAndProfile,
  fetchDriverDashboard,
  fetchMarketplaceStores,
  fetchMyStore,
  fetchNotifications,
  fetchStoreOrders,
  loadCart,
  markNotificationsRead,
  persistCart,
  placeOrder,
  removeMenuItem,
  respondToStoreOrderPart,
  saveMenuItem,
  sendPasswordReset,
  setDriverOnline,
  signInWithEmail,
  signInWithGoogle,
  signOutUser,
  signUpWithEmail,
  subscribeRealtimeUpdates,
  updateDriverDeliveryStatus,
  updateStoreDetails,
  uploadStoreAsset,
  toggleMenuItemAvailability,
} from './services/hazyService';
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
  ToastMessage,
} from './types';
import {
  calculateCartTotals,
  canAddMenuItemToCart,
  formatZar,
  removeCartItemCleanly,
} from './utils/format';

export default function App() {
  const [stores, setStores] = useState<Store[]>([]);
  const [storesLoading, setStoresLoading] = useState(true);
  const [activeView, setActiveView] = useState<'marketplace' | 'dashboard'>('marketplace');

  const [profile, setProfile] = useState<Profile | null>(null);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const [cart, setCart] = useState<CartItem[]>(() => loadCart());
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutBusy, setCheckoutBusy] = useState(false);

  const [authModal, setAuthModal] = useState<{
    open: boolean;
    mode: 'signin' | 'signup';
    role: 'buyer' | 'driver' | 'store';
  }>({ open: false, mode: 'signin', role: 'buyer' });

  // Role dashboards state
  const [dashLoading, setDashLoading] = useState(false);
  const [buyerOrders, setBuyerOrders] = useState<BuyerOrder[]>([]);
  const [myStore, setMyStore] = useState<Store | null>(null);
  const [storeOrders, setStoreOrders] = useState<StoreOrderPartView[]>([]);
  const [driverData, setDriverData] = useState<DriverDashboardData>({
    available: [],
    active: [],
    history: [],
  });
  const [adminData, setAdminData] = useState<AdminDashboardData | null>(null);

  const pushToast = useCallback((text: string, tone: ToastMessage['tone'] = 'info') => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev.slice(-3), { id, text, tone }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const refreshStores = useCallback(async () => {
    try {
      const next = await fetchMarketplaceStores();
      setStores(next);
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Unable to load stores.', 'error');
    } finally {
      setStoresLoading(false);
    }
  }, [pushToast]);

  const refreshRoleDashboard = useCallback(
    async (prof: Profile | null) => {
      if (!prof || !isSupabaseConfigured) return;
      setDashLoading(true);
      try {
        if (prof.role === 'buyer') {
          setBuyerOrders(await fetchBuyerOrders());
        } else if (prof.role === 'store') {
          const [owned, incoming] = await Promise.all([
            fetchMyStore(prof.id),
            fetchStoreOrders(),
          ]);
          setMyStore(owned);
          setStoreOrders(incoming);
        } else if (prof.role === 'driver') {
          setDriverData(await fetchDriverDashboard());
        } else if (prof.role === 'admin') {
          setAdminData(await fetchAdminDashboard());
        }
      } catch (err) {
        pushToast(err instanceof Error ? err.message : 'Unable to refresh dashboard.', 'error');
      } finally {
        setDashLoading(false);
      }
    },
    [pushToast]
  );

  const syncAuthAndData = useCallback(async () => {
    try {
      const session = await fetchCurrentSessionAndProfile();
      setProfile(session.profile);
      if (session.profile) {
        const [notifs] = await Promise.all([
          fetchNotifications(session.profile.id),
          refreshRoleDashboard(session.profile),
        ]);
        setNotifications(notifs);
      } else {
        setNotifications([]);
        setBuyerOrders([]);
        setMyStore(null);
        setStoreOrders([]);
        setDriverData({ available: [], active: [], history: [] });
        setAdminData(null);
        setActiveView('marketplace');
      }
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Unable to verify session.', 'error');
    }
  }, [pushToast, refreshRoleDashboard]);

  useEffect(() => {
    void refreshStores();
    void syncAuthAndData();
  }, [refreshStores, syncAuthAndData]);

  useEffect(() => {
    if (!supabase || !isSupabaseConfigured) return;
    const { data: listener } = supabase.auth.onAuthStateChange((_event) => {
      void syncAuthAndData();
    });
    return () => {
      listener.subscription.unsubscribe();
    };
  }, [syncAuthAndData]);

  useEffect(() => {
    const unsubscribe = subscribeRealtimeUpdates({
      userId: profile?.id ?? null,
      role: profile?.role ?? null,
      onMenuChange: () => {
        void refreshStores();
        if (profile?.role === 'store') {
          void refreshRoleDashboard(profile);
        }
      },
      onOrdersOrPartsChange: () => {
        if (profile) {
          void refreshRoleDashboard(profile);
        }
      },
      onNotificationInsert: (notif) => {
        setNotifications((prev) => [notif, ...prev]);
        pushToast(notif.text, 'info');
      },
    });
    return unsubscribe;
  }, [profile, pushToast, refreshRoleDashboard, refreshStores]);

  function updateCart(next: CartItem[]) {
    setCart(next);
    persistCart(next);
  }

  function handleAddToCart(store: Store, item: MenuItem) {
    const check = canAddMenuItemToCart(cart, store.id, item, store.is_open);
    if (!check.allowed) {
      pushToast(check.reason || 'Cannot add this item right now.', 'error');
      return;
    }
    const existing = cart.find((c) => c.menuItemId === item.id);
    if (existing) {
      updateCart(
        cart.map((c) => (c.menuItemId === item.id ? { ...c, qty: c.qty + 1 } : c))
      );
    } else {
      updateCart([
        ...cart,
        {
          storeId: store.id,
          storeName: store.name,
          menuItemId: item.id,
          itemName: item.name,
          price: item.price,
          itemGroup: item.item_group,
          qty: 1,
        },
      ]);
    }
    pushToast(`Added ${item.name} to your Black Bag.`, 'success');
  }

  function handleUpdateCartQty(menuItemId: string, delta: number) {
    const target = cart.find((c) => c.menuItemId === menuItemId);
    if (!target) return;
    const nextQty = target.qty + delta;
    if (nextQty <= 0) {
      updateCart(removeCartItemCleanly(cart, menuItemId));
      return;
    }
    updateCart(cart.map((c) => (c.menuItemId === menuItemId ? { ...c, qty: nextQty } : c)));
  }

  function handleRemoveCartItem(menuItemId: string) {
    updateCart(removeCartItemCleanly(cart, menuItemId));
  }

  async function handleCheckout(address: string, phone: string, notes: string) {
    setCheckoutBusy(true);
    try {
      const result = await placeOrder({
        address,
        phone,
        notes,
        items: cart.map((c) => ({ menuItemId: c.menuItemId, qty: c.qty })),
      });
      updateCart([]);
      setCartOpen(false);
      setActiveView('dashboard');
      pushToast(`Order ${result.code} placed (${formatZar(result.total)}).`, 'success');
      if (profile) {
        await refreshRoleDashboard(profile);
      }
    } finally {
      setCheckoutBusy(false);
    }
  }

  const selectedStore = stores.find((s) => s.id === selectedStoreId) || null;
  const cartTotals = calculateCartTotals(cart);

  return (
    <>
      <SplashScreen />

      <ToastContainer
        toasts={toasts}
        onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))}
      />

      <Header
        profile={profile}
        activeView={activeView}
        notifications={notifications}
        onSwitchView={(view) => {
          if (view === 'dashboard' && !profile) {
            setAuthModal({ open: true, mode: 'signin', role: 'buyer' });
            return;
          }
          setActiveView(view);
        }}
        onOpenAuth={(mode, defaultRole = 'buyer') =>
          setAuthModal({ open: true, mode, role: defaultRole })
        }
        onLogout={async () => {
          await signOutUser();
          setProfile(null);
          setActiveView('marketplace');
          pushToast('Signed out cleanly.', 'info');
        }}
        onMarkNotificationsRead={() => {
          if (!profile) return;
          setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
          void markNotificationsRead(profile.id);
        }}
      />

      {activeView === 'marketplace' && (
        <MarketplaceView
          stores={stores}
          loading={storesLoading}
          profile={profile}
          onOpenStore={(store) => setSelectedStoreId(store.id)}
          onOpenAuth={(mode, defaultRole = 'buyer') =>
            setAuthModal({ open: true, mode, role: defaultRole })
          }
          onSwitchToDashboard={() => setActiveView('dashboard')}
        />
      )}

      {activeView === 'dashboard' && profile && (
        <section id="view-dashboard" className="dashboard-panel active">
          {profile.role === 'buyer' && (
            <BuyerDashboard
              profile={profile}
              orders={buyerOrders}
              loading={dashLoading}
              onStartNewOrder={() => setActiveView('marketplace')}
              onCancelOrder={async (orderId) => {
                try {
                  await cancelBuyerOrder(orderId);
                  pushToast('Order cancelled.', 'info');
                  await refreshRoleDashboard(profile);
                } catch (err) {
                  pushToast(
                    err instanceof Error ? err.message : 'Could not cancel order.',
                    'error'
                  );
                }
              }}
            />
          )}

          {profile.role === 'store' && (
            <StoreDashboard
              store={myStore}
              orders={storeOrders}
              loading={dashLoading}
              onRespondOrderPart={async (partId, action, reason = '') => {
                try {
                  await respondToStoreOrderPart(partId, action, reason);
                  pushToast('Order status updated.', 'success');
                  await refreshRoleDashboard(profile);
                } catch (err) {
                  pushToast(
                    err instanceof Error ? err.message : 'Unable to update order.',
                    'error'
                  );
                }
              }}
              onToggleStoreOpen={async (isOpen) => {
                if (!myStore) return;
                try {
                  await updateStoreDetails(myStore.id, { is_open: isOpen });
                  pushToast(isOpen ? 'Store is now Open.' : 'Store is now Closed.', 'info');
                  await Promise.all([refreshRoleDashboard(profile), refreshStores()]);
                } catch (err) {
                  pushToast(err instanceof Error ? err.message : 'Update failed.', 'error');
                }
              }}
              onUpdateStoreDetails={async (patch) => {
                if (!myStore) return;
                try {
                  await updateStoreDetails(myStore.id, patch);
                  pushToast('Store details updated.', 'success');
                  await Promise.all([refreshRoleDashboard(profile), refreshStores()]);
                } catch (err) {
                  pushToast(err instanceof Error ? err.message : 'Update failed.', 'error');
                }
              }}
              onSaveMenuItem={async (params: {
                id?: string;
                name: string;
                price: number;
                item_group: MenuItemGroup;
                image_url?: string;
                is_available?: boolean;
              }) => {
                if (!myStore) return;
                try {
                  await saveMenuItem({ ...params, store_id: myStore.id });
                  pushToast('Menu item saved.', 'success');
                  await Promise.all([refreshRoleDashboard(profile), refreshStores()]);
                } catch (err) {
                  pushToast(err instanceof Error ? err.message : 'Could not save item.', 'error');
                }
              }}
              onToggleItemAvailability={async (itemId, isAvailable) => {
                try {
                  await toggleMenuItemAvailability(itemId, isAvailable);
                  pushToast(
                    isAvailable ? 'Item marked available.' : 'Item marked sold out.',
                    'info'
                  );
                  await Promise.all([refreshRoleDashboard(profile), refreshStores()]);
                } catch (err) {
                  pushToast(err instanceof Error ? err.message : 'Update failed.', 'error');
                }
              }}
              onDeleteMenuItem={async (itemId) => {
                try {
                  await removeMenuItem(itemId);
                  pushToast('Menu item removed.', 'info');
                  await Promise.all([refreshRoleDashboard(profile), refreshStores()]);
                } catch (err) {
                  pushToast(err instanceof Error ? err.message : 'Delete failed.', 'error');
                }
              }}
              onUploadAsset={async (folder, file) => {
                if (!myStore) throw new Error('Store not found.');
                try {
                  const url = await uploadStoreAsset(folder, myStore.id, file);
                  pushToast('Image uploaded.', 'success');
                  return url;
                } catch (err) {
                  pushToast(err instanceof Error ? err.message : 'Upload failed.', 'error');
                  throw err;
                }
              }}
            />
          )}

          {profile.role === 'driver' && (
            <DriverDashboard
              profile={profile}
              data={driverData}
              loading={dashLoading}
              onToggleOnline={async (online) => {
                try {
                  await setDriverOnline(online);
                  const nextProfile = { ...profile, is_online: online };
                  setProfile(nextProfile);
                  pushToast(online ? 'You are now Online.' : 'You are now Offline.', 'info');
                  await refreshRoleDashboard(nextProfile);
                } catch (err) {
                  pushToast(err instanceof Error ? err.message : 'Toggle failed.', 'error');
                }
              }}
              onAcceptJob={async (orderId) => {
                try {
                  await acceptDriverJob(orderId);
                  pushToast('Pickup job accepted!', 'success');
                  await refreshRoleDashboard(profile);
                } catch (err) {
                  pushToast(err instanceof Error ? err.message : 'Job unavailable.', 'error');
                  await refreshRoleDashboard(profile);
                }
              }}
              onUpdateStatus={async (orderId, status) => {
                try {
                  await updateDriverDeliveryStatus(orderId, status);
                  pushToast(
                    status === 'delivered' ? 'Delivery confirmed (R20 earned).' : 'Marked Picked Up.',
                    'success'
                  );
                  await refreshRoleDashboard(profile);
                } catch (err) {
                  pushToast(err instanceof Error ? err.message : 'Update failed.', 'error');
                }
              }}
            />
          )}

          {profile.role === 'admin' && (
            <AdminDashboard
              data={adminData}
              loading={dashLoading}
              currentUserId={profile.id}
              onSetStoreApproval={async (storeId, approved) => {
                try {
                  await adminSetStoreApproval(storeId, approved);
                  pushToast(approved ? 'Store approved.' : 'Store suspended.', 'info');
                  await Promise.all([refreshRoleDashboard(profile), refreshStores()]);
                } catch (err) {
                  pushToast(err instanceof Error ? err.message : 'Action failed.', 'error');
                }
              }}
              onOnboardVendor={async (params) => {
                try {
                  await adminOnboardVendor(params);
                  pushToast(`${params.name} is now live on HazyEats!`, 'success');
                  await Promise.all([refreshRoleDashboard(profile), refreshStores()]);
                } catch (err) {
                  pushToast(err instanceof Error ? err.message : 'Onboard failed.', 'error');
                }
              }}
              onCancelOrder={async (orderId) => {
                try {
                  await adminCancelOrder(orderId);
                  pushToast('Order cancelled.', 'info');
                  await refreshRoleDashboard(profile);
                } catch (err) {
                  pushToast(err instanceof Error ? err.message : 'Cancel failed.', 'error');
                }
              }}
              onReassignDriver={async (orderId, driverId) => {
                try {
                  await adminReassignDriver(orderId, driverId);
                  pushToast('Driver assigned to order.', 'success');
                  await refreshRoleDashboard(profile);
                } catch (err) {
                  pushToast(err instanceof Error ? err.message : 'Reassign failed.', 'error');
                }
              }}
              onSetUserActive={async (userId, active) => {
                try {
                  await adminSetUserActive(userId, active);
                  pushToast(active ? 'User reactivated.' : 'User suspended.', 'info');
                  await refreshRoleDashboard(profile);
                } catch (err) {
                  pushToast(err instanceof Error ? err.message : 'Update failed.', 'error');
                }
              }}
            />
          )}
        </section>
      )}

      <button
        type="button"
        id="cart-float"
        className={`cart-float ${cartTotals.itemCount > 0 ? 'visible' : ''}`}
        onClick={() => setCartOpen(true)}
      >
        <span>
          Black Bag (<span id="cart-count">{cartTotals.itemCount}</span>)
        </span>
        <span>•</span>
        <span id="cart-total-float">{formatZar(cartTotals.total)}</span>
      </button>

      <StoreMenuModal
        store={selectedStore}
        cart={cart}
        onClose={() => setSelectedStoreId(null)}
        onAddItem={handleAddToCart}
      />

      <CartModal
        open={cartOpen}
        cart={cart}
        profile={profile}
        submitting={checkoutBusy}
        onClose={() => setCartOpen(false)}
        onUpdateQty={handleUpdateCartQty}
        onRemoveItem={handleRemoveCartItem}
        onCheckout={handleCheckout}
        onRequireSignIn={() => {
          pushToast('Please sign in or create an account to place your order.', 'info');
          setAuthModal({ open: true, mode: 'signin', role: 'buyer' });
        }}
      />

      <AuthModal
        open={authModal.open}
        initialMode={authModal.mode}
        initialRole={authModal.role}
        onClose={() => setAuthModal((prev) => ({ ...prev, open: false }))}
        onSignIn={async (email, password) => {
          await signInWithEmail(email, password);
          pushToast('Signed in to HazyEats.', 'success');
          setActiveView('dashboard');
        }}
        onSignUp={async (params) => {
          const res = await signUpWithEmail(params);
          if (!res.needsEmailConfirmation) {
            pushToast('Account created! Welcome to HazyEats.', 'success');
            setActiveView('dashboard');
          }
          return res;
        }}
        onGoogleSignIn={async () => {
          await signInWithGoogle();
        }}
        onForgotPassword={async (email) => {
          await sendPasswordReset(email);
          pushToast('Password reset link sent to your email.', 'success');
        }}
      />

      <GoogleOnboardingModal
        profile={profile}
        onComplete={async (params) => {
          const updated = await completeGoogleOnboarding(params);
          setProfile(updated);
          pushToast('Profile completed! Welcome to HazyEats.', 'success');
          setActiveView('dashboard');
          await refreshRoleDashboard(updated);
        }}
      />

      <footer>
        HazyEats by <span className="gold-text">ZikCode</span> • Connecting Hazyview &amp; Shabalala.
      </footer>
    </>
  );
}
