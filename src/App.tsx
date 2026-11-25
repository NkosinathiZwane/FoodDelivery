import { useCallback, useEffect, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from './lib/firebase.ts';
import {
  acceptDelivery,
  addStoreMenuItem,
  completeDelivery,
  fetchAdminOverview,
  fetchCurrentUser,
  fetchDriverApplications,
  fetchOrders,
  fetchStores,
  getMemoryAuthToken,
  onboardVendorStore,
  placeOrder,
  setMemoryAuthToken,
  subscribeOrderStream,
  syncGoogleSession,
  updateDriverApplicationStatus,
  updateStorePrepStatus,
} from './services/api.ts';
import { SplashScreen } from './components/SplashScreen.tsx';
import { Header } from './components/Header.tsx';
import { MarketplaceView } from './components/MarketplaceView.tsx';
import { StoreMenuModal } from './components/StoreMenuModal.tsx';
import { CartModal } from './components/CartModal.tsx';
import { AuthModal } from './components/AuthModal.tsx';
import { DriverOnboardingModal } from './components/DriverOnboardingModal.tsx';
import { DashboardView } from './components/DashboardView.tsx';
import { formatZarFromCents } from './utils/marketplace.ts';
import { calculateCartTotals, mergeOrderMessagesIdempotent } from './utils/orders.ts';
import type {
  AdminOverviewDTO,
  CartItem,
  CheckoutPaymentInput,
  DriverApplicationDTO,
  OrderDTO,
  OrderMessageDTO,
  StoreDTO,
  UserProfile,
  UserRole,
} from './types.ts';

export default function App() {
  const [stores, setStores] = useState<StoreDTO[]>([]);
  const [storesLoading, setStoresLoading] = useState(true);
  const [storesError, setStoresError] = useState<string | null>(null);

  const [user, setUser] = useState<UserProfile | null>(null);
  const [view, setView] = useState<'marketplace' | 'dashboard'>(() => {
    if (typeof window !== 'undefined' && getMemoryAuthToken()) {
      return window.sessionStorage.getItem('hazyeats_active_view') === 'dashboard'
        ? 'dashboard'
        : 'marketplace';
    }
    return 'marketplace';
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (user) {
      window.sessionStorage.setItem('hazyeats_active_view', view);
    }
  }, [view, user]);

  const [orders, setOrders] = useState<OrderDTO[]>([]);
  const [realtimeMessagesByOrder, setRealtimeMessagesByOrder] = useState<
    Record<string, OrderMessageDTO[]>
  >({});
  const [adminOverview, setAdminOverview] = useState<AdminOverviewDTO | null>(null);
  const [driverApplications, setDriverApplications] = useState<DriverApplicationDTO[]>([]);
  const [dashLoading, setDashLoading] = useState(false);
  const [dashError, setDashError] = useState<string | null>(null);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedStore, setSelectedStore] = useState<StoreDTO | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [authDefaultRole, setAuthDefaultRole] = useState<UserRole>('buyer');
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const [authPrefill, setAuthPrefill] = useState<{
    name?: string;
    email?: string;
    phone?: string;
    vehicle?: string;
  } | null>(null);

  const [driverOnboardingOpen, setDriverOnboardingOpen] = useState(false);

  const loadStores = useCallback(async () => {
    setStoresLoading(true);
    setStoresError(null);
    try {
      const list = await fetchStores();
      setStores(list);
    } catch (err) {
      setStoresError(
        err instanceof Error ? err.message : 'Unable to load stores right now.'
      );
    } finally {
      setStoresLoading(false);
    }
  }, []);

  const loadDashboardData = useCallback(
    async (activeUser: UserProfile, options?: { silent?: boolean }) => {
      if (!options?.silent) {
        setDashLoading(true);
      }
      setDashError(null);
      try {
        const shouldLoadApps = activeUser.role === 'admin' || activeUser.role === 'driver';
        const [ordersList, overview, apps] = await Promise.all([
          fetchOrders(),
          activeUser.role === 'admin' ? fetchAdminOverview() : Promise.resolve(null),
          shouldLoadApps ? fetchDriverApplications() : Promise.resolve([]),
        ]);
        setOrders(ordersList);
        setAdminOverview(overview);
        setDriverApplications(apps);
      } catch (err) {
        if (!options?.silent) {
          setDashError(err instanceof Error ? err.message : 'Failed to load dashboard.');
        }
      } finally {
        if (!options?.silent) {
          setDashLoading(false);
        }
      }
    },
    []
  );

  useEffect(() => {
    void loadStores();
    const savedToken = getMemoryAuthToken();
    if (savedToken) {
      void fetchCurrentUser()
        .then((profile) => {
          setUser((prev) => prev ?? profile);
        })
        .catch(() => {
          setMemoryAuthToken(null);
        });
    }
  }, [loadStores]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (!fbUser) return;
      try {
        const idToken = await fbUser.getIdToken();
        const { user: synced } = await syncGoogleSession(idToken);
        setUser((prev) => prev ?? synced);
      } catch {
        // Ignore silent restore failures
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    void loadDashboardData(user);

    const stopSse = subscribeOrderStream(
      () => {
        void loadDashboardData(user, { silent: true });
      },
      ({ orderId, message }) => {
        setRealtimeMessagesByOrder((prev) => ({
          ...prev,
          [orderId]: mergeOrderMessagesIdempotent(prev[orderId] ?? [], message),
        }));
      }
    );

    const intervalId = window.setInterval(() => {
      void loadDashboardData(user, { silent: true });
    }, 15000);

    return () => {
      stopSse();
      window.clearInterval(intervalId);
    };
  }, [user, loadDashboardData]);

  const handleOpenAuth = (
    mode: 'signin' | 'signup',
    defaultRole: UserRole = 'buyer',
    notice: string | null = null,
    prefill: { name?: string; email?: string; phone?: string; vehicle?: string } | null = null
  ) => {
    setAuthMode(mode);
    setAuthDefaultRole(defaultRole);
    setAuthNotice(notice);
    setAuthPrefill(prefill);
    setAuthModalOpen(true);
  };

  const handleAuthenticated = (loggedInUser: UserProfile) => {
    setDashLoading(true);
    setOrders([]);
    setRealtimeMessagesByOrder({});
    setAdminOverview(null);
    setDriverApplications([]);
    setUser(loggedInUser);
    setAuthModalOpen(false);
    setAuthNotice(null);
    setAuthPrefill(null);
    if (cartOpen && loggedInUser.role === 'buyer') {
      return;
    }
    setView('dashboard');
  };

  const handleLogout = async () => {
    setMemoryAuthToken(null);
    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem('hazyeats_active_view');
    }
    setUser(null);
    setOrders([]);
    setRealtimeMessagesByOrder({});
    setAdminOverview(null);
    setDriverApplications([]);
    setView('marketplace');
    try {
      await signOut(auth);
    } catch {
      // Ignore if signed in via local email/password
    }
  };

  const handleAddToCart = (
    store: StoreDTO,
    item: StoreDTO['menu'][number]
  ) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.itemId === item.id);
      if (existing) {
        return prev.map((c) =>
          c.itemId === item.id ? { ...c, qty: c.qty + 1 } : c
        );
      }
      return [
        ...prev,
        {
          storeId: store.id,
          storeName: store.name,
          itemId: item.id,
          itemName: item.name,
          priceCents: item.priceCents,
          price: item.price,
          qty: 1,
        },
      ];
    });
  };

  const handleUpdateQty = (itemId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) =>
          item.itemId === itemId ? { ...item, qty: item.qty + delta } : item
        )
        .filter((item) => item.qty > 0)
    );
  };

  const handleRemoveCartItem = (itemId: string) => {
    setCart((prev) => prev.filter((item) => item.itemId !== itemId));
  };

  const handlePlaceOrder = async (address: string, payment: CheckoutPaymentInput) => {
    if (!user) {
      handleOpenAuth(
        'signin',
        'buyer',
        'Please sign in or create an account to complete payment and place your multi-store order.'
      );
      return;
    }

    setCheckoutError(null);
    setCheckoutBusy(true);
    try {
      const created = await placeOrder({
        address,
        items: cart.map((c) => ({ itemId: c.itemId, qty: c.qty })),
        payment,
      });
      setCart([]);
      setCartOpen(false);
      setOrders((prev) => [created, ...prev]);
      setView('dashboard');
      void loadDashboardData(user, { silent: true });
    } catch (err) {
      setCheckoutError(
        err instanceof Error ? err.message : 'Unable to place order.'
      );
    } finally {
      setCheckoutBusy(false);
    }
  };

  const cartTotals = calculateCartTotals(cart);

  return (
    <>
      <SplashScreen />

      <Header
        user={user}
        onNavigate={(next) => {
          if (next === 'dashboard' && !user) {
            handleOpenAuth('signin');
            return;
          }
          setView(next);
        }}
        onOpenAuth={(mode) => handleOpenAuth(mode)}
        onLogout={handleLogout}
      />

      {view === 'dashboard' && user ? (
        <DashboardView
          user={user}
          orders={orders}
          realtimeMessagesByOrder={realtimeMessagesByOrder}
          adminOverview={adminOverview}
          driverApplications={driverApplications}
          loading={dashLoading}
          error={dashError}
          onStartNewOrder={() => setView('marketplace')}
          onOpenDriverOnboarding={() => setDriverOnboardingOpen(true)}
          onUpdateDriverAppStatus={async (applicationId, status) => {
            await updateDriverApplicationStatus(applicationId, status);
            await loadDashboardData(user);
          }}
          onUpdateStorePrepStatus={async (orderId, status, storeName) => {
            await updateStorePrepStatus(orderId, status, storeName);
            await loadDashboardData(user);
          }}
          onAcceptDelivery={async (orderId) => {
            await acceptDelivery(orderId);
            await loadDashboardData(user);
          }}
          onCompleteDelivery={async (orderId) => {
            await completeDelivery(orderId);
            await loadDashboardData(user);
          }}
          onOnboardVendor={async (payload) => {
            await onboardVendorStore(payload);
            await Promise.all([loadStores(), loadDashboardData(user)]);
          }}
          onAddStoreMenuItem={async (storeName, payload) => {
            await addStoreMenuItem(storeName, payload);
            await loadStores();
          }}
        />
      ) : (
        <MarketplaceView
          stores={stores}
          loading={storesLoading}
          error={storesError}
          onRetry={loadStores}
          onSelectStore={setSelectedStore}
          onOpenAuth={(mode, defaultRole) => handleOpenAuth(mode, defaultRole)}
          onOpenDriverOnboarding={() => setDriverOnboardingOpen(true)}
        />
      )}

      {cartTotals.itemCount > 0 && (
        <button
          type="button"
          id="cart-float"
          className="cart-float"
          onClick={() => {
            setCheckoutError(null);
            setCartOpen(true);
          }}
        >
          <span>
            🛍️ Black Bag (<span id="cart-count">{cartTotals.itemCount}</span>)
          </span>
          <span>•</span>
          <span id="cart-total-float">{formatZarFromCents(cartTotals.totalCents)}</span>
        </button>
      )}

      <StoreMenuModal
        store={selectedStore}
        cart={cart}
        onClose={() => setSelectedStore(null)}
        onAddItem={handleAddToCart}
      />

      <CartModal
        open={cartOpen}
        cart={cart}
        submitting={checkoutBusy}
        serverError={checkoutError}
        onClose={() => setCartOpen(false)}
        onUpdateQty={handleUpdateQty}
        onRemoveItem={handleRemoveCartItem}
        onSubmitOrder={handlePlaceOrder}
      />

      {authModalOpen && (
        <AuthModal
          open={authModalOpen}
          initialMode={authMode}
          initialRole={authDefaultRole}
          notice={authNotice}
          prefill={authPrefill}
          onClose={() => setAuthModalOpen(false)}
          onAuthenticated={handleAuthenticated}
          onOpenDriverOnboarding={() => {
            setAuthModalOpen(false);
            setDriverOnboardingOpen(true);
          }}
        />
      )}

      <DriverOnboardingModal
        open={driverOnboardingOpen}
        user={user}
        onClose={() => setDriverOnboardingOpen(false)}
        onSubmitted={() => {
          if (user) void loadDashboardData(user);
        }}
        onProceedToSignUp={(prefill) =>
          handleOpenAuth(
            'signup',
            'driver',
            'Complete your driver account registration below.',
            prefill
          )
        }
      />

      <footer className="hazy-footer">
        <strong>HazyEats</strong> by <span className="gold-text">ZikCode</span> • Connecting
        Hazyview &amp; Shabalala.
        <br />
        Everything Hazyview, in one black bag — synchronized across stores, drivers, and buyers.
      </footer>
    </>
  );
}
