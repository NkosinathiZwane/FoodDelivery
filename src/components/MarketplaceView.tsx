import { useState } from 'react';
import type { Profile, Store } from '../types';

const CATEGORIES = ['All', 'Fast food', 'Pizza', 'Restaurant', 'Groceries', 'Community'];

interface MarketplaceViewProps {
  stores: Store[];
  loading: boolean;
  profile: Profile | null;
  onOpenStore: (store: Store) => void;
  onOpenAuth: (mode: 'signin' | 'signup', defaultRole?: 'buyer' | 'driver' | 'store') => void;
  onSwitchToDashboard: () => void;
}

export function MarketplaceView({
  stores,
  loading,
  profile,
  onOpenStore,
  onOpenAuth,
  onSwitchToDashboard,
}: MarketplaceViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [brokenLogos, setBrokenLogos] = useState<Record<string, boolean>>({});

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredStores = stores.filter((store) => {
    const matchCategory = activeCategory === 'All' || store.category === activeCategory;
    const matchQuery =
      !normalizedQuery ||
      store.name.toLowerCase().includes(normalizedQuery) ||
      store.category.toLowerCase().includes(normalizedQuery) ||
      store.menu.some((item) => item.name.toLowerCase().includes(normalizedQuery));
    return matchCategory && matchQuery;
  });

  function handleHeroCta(role: 'buyer' | 'driver' | 'store') {
    if (profile) {
      onSwitchToDashboard();
      return;
    }
    onOpenAuth('signup', role);
  }

  return (
    <main id="view-marketplace">
      <section className="hero">
        <div>
          <h1>
            Everything Hazyview, <span className="gold-text">in one black bag.</span>
          </h1>
          <p>
            Order from KFC, Chicken Licken, Debonairs, Woolworths Food, and local Shabalala kota
            &amp; fries vendors in a single checkout. One driver, one R20 fee, delivered straight to
            your doorstep.
          </p>
          <div className="hero-cta">
            <button type="button" className="btn-gold" onClick={() => handleHeroCta('buyer')}>
              Order Now
            </button>
            <button type="button" className="btn-outline" onClick={() => handleHeroCta('driver')}>
              Drive &amp; Earn
            </button>
            <button type="button" className="btn-outline" onClick={() => handleHeroCta('store')}>
              Partner Store / Vendor
            </button>
          </div>
        </div>

        <div className="bag-showcase">
          <div className="luxury-bag">
            <span style={{ fontSize: '0.75rem', fontWeight: 900, letterSpacing: '1px' }} className="gold-text">
              HAZYEATS
            </span>
            <span style={{ fontSize: '0.6rem', color: '#888', marginTop: 2 }}>SHABALALA VIP</span>
          </div>
          <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>Multi-Store Single Delivery</div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: 4 }}>
            Combine chains + local spots in 1 order
          </div>
        </div>
      </section>

      <section className="controls">
        <input
          type="text"
          id="search-input"
          className="search-box"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search KFC, Kota, Mama Zodwa, Pizza, Chips..."
          aria-label="Search stores and menu items"
        />
        <div className="chips" id="category-chips">
          {CATEGORIES.map((category) => (
            <button
              key={category}
              type="button"
              className={`chip ${activeCategory === category ? 'active' : ''}`}
              onClick={() => setActiveCategory(category)}
            >
              {category}
            </button>
          ))}
        </div>
      </section>

      <section className="grid" id="stores-grid">
        {loading ? (
          Array.from({ length: 8 }).map((_, idx) => <div key={idx} className="skeleton-card" />)
        ) : filteredStores.length === 0 ? (
          <div className="empty-state" style={{ gridColumn: '1 / -1' }}>
            No matching stores found. Try clearing your search or choosing another category.
          </div>
        ) : (
          filteredStores.map((store) => {
            const showLogo = Boolean(store.logo_url) && !brokenLogos[store.id];
            return (
              <div
                key={store.id}
                className="store-card"
                role="button"
                tabIndex={0}
                onClick={() => onOpenStore(store)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onOpenStore(store);
                  }
                }}
              >
                <div className="store-banner">
                  {showLogo ? (
                    <img
                      src={store.logo_url}
                      alt={`${store.name} Logo`}
                      className="store-logo-img"
                      onError={() =>
                        setBrokenLogos((prev) => ({ ...prev, [store.id]: true }))
                      }
                    />
                  ) : (
                    <div
                      style={{ fontSize: '1.3rem', fontWeight: 900, textAlign: 'center' }}
                      className="gold-text"
                    >
                      {store.name}
                    </div>
                  )}
                  {!store.is_open && <span className="closed-badge-banner">Closed</span>}
                  {store.is_community && <span className="community-badge">SHABALALA LOCAL</span>}
                </div>

                <div className="store-info">
                  <div className="store-title">
                    <span>{store.name}</span>
                    {!store.is_open && <span className="badge badge-cancelled">Closed</span>}
                  </div>
                  <div className="store-meta">
                    R20.00 flat delivery • {store.delivery_time} • {store.category}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </section>
    </main>
  );
}
