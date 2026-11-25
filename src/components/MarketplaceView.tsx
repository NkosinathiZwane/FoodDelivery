import { useState } from 'react';
import type { StoreDTO, UserRole } from '../types.ts';
import { STORE_CATEGORIES, filterStores } from '../utils/marketplace.ts';

interface MarketplaceViewProps {
  stores: StoreDTO[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onSelectStore: (store: StoreDTO) => void;
  onOpenAuth: (mode: 'signin' | 'signup', role?: UserRole) => void;
  onOpenDriverOnboarding: () => void;
}

function StoreBannerVisual({ store }: { store: StoreDTO }) {
  const [imgFailed, setImgFailed] = useState(false);

  if (!store.logo || imgFailed) {
    return (
      <div
        style={{ fontSize: '1.3rem', fontWeight: 900, textAlign: 'center' }}
        className="gold-text"
      >
        {store.name}
      </div>
    );
  }

  return (
    <img
      src={store.logo}
      alt={`${store.name} Logo`}
      className="store-logo-img"
      onError={() => setImgFailed(true)}
    />
  );
}

export function MarketplaceView({
  stores,
  loading,
  error,
  onRetry,
  onSelectStore,
  onOpenAuth,
  onOpenDriverOnboarding,
}: MarketplaceViewProps) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string>('All');

  const filtered = filterStores(stores, query, category);

  return (
    <main id="view-marketplace">
      <section className="hero">
        <div>
          <h1>
            Everything Hazyview, <span className="gold-text">in one black bag.</span>
          </h1>
          <p>
            Order from KFC, Chicken Licken, Debonairs, Woolworths Food, and local Shabalala
            kota &amp; fries vendors in a single checkout. One driver, one R20 fee, delivered
            straight to your doorstep.
          </p>
          <div className="hero-cta">
            <button
              type="button"
              className="btn-gold"
              onClick={() => onOpenAuth('signup', 'buyer')}
            >
              Order Now
            </button>
            <button
              type="button"
              className="btn-outline"
              onClick={onOpenDriverOnboarding}
            >
              Drive &amp; Earn
            </button>
            <button
              type="button"
              className="btn-outline"
              onClick={() => onOpenAuth('signup', 'store')}
            >
              Partner Store / Vendor
            </button>
          </div>
        </div>

        <div className="bag-showcase">
          <div className="luxury-bag">
            <span
              style={{ fontSize: '0.75rem', fontWeight: 900, letterSpacing: '1px' }}
              className="gold-text"
            >
              HAZYEATS
            </span>
            <span style={{ fontSize: '0.6rem', color: '#888', marginTop: '2px' }}>
              SHABALALA VIP
            </span>
          </div>
          <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>
            Multi-Store Single Delivery
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: '4px' }}>
            Combine chains + local spots in 1 order
          </div>
        </div>
      </section>

      <section className="controls" aria-label="Search and filter stores">
        <label htmlFor="search-input" className="sr-only">
          Search stores or dishes
        </label>
        <input
          type="text"
          id="search-input"
          className="search-box"
          placeholder="Search KFC, Kota, Mama Zodwa, Pizza, Chips..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="chips" id="category-chips" role="group" aria-label="Store categories">
          {STORE_CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              className={`chip ${category === cat ? 'active' : ''}`}
              onClick={() => setCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
      </section>

      {error && (
        <div style={{ padding: '20px 5%' }}>
          <div className="form-error" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
            <span>{error}</span>
            <button type="button" className="btn-outline" onClick={onRetry}>
              Retry
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <section className="grid" aria-busy="true" aria-label="Loading stores">
          {Array.from({ length: 8 }).map((_, idx) => (
            <div key={idx} className="store-card" style={{ minHeight: '200px', opacity: 0.5 }}>
              <div className="store-banner" />
              <div className="store-info">
                <div style={{ height: '18px', width: '60%', background: '#27272a', borderRadius: '6px' }} />
                <div style={{ height: '14px', width: '80%', background: '#27272a', borderRadius: '6px', marginTop: '10px' }} />
              </div>
            </div>
          ))}
        </section>
      ) : filtered.length === 0 ? (
        <section style={{ padding: '40px 5%', textAlign: 'center', color: 'var(--text-muted)' }}>
          No Hazyview stores or menu items match "{query || category}". Try another search or clear filters.
        </section>
      ) : (
        <section className="grid" id="stores-grid" data-testid="stores-grid">
          {filtered.map((store) => (
            <button
              key={store.id}
              type="button"
              className="store-card"
              onClick={() => onSelectStore(store)}
            >
              <div className="store-banner">
                <StoreBannerVisual store={store} />
                {store.isCommunity && (
                  <span className="community-badge">SHABALALA LOCAL</span>
                )}
              </div>
              <div className="store-info">
                <div className="store-title">
                  <span>{store.name}</span>
                </div>
                <div className="store-meta">
                  R20.00 flat delivery • {store.time} • {store.category}
                </div>
              </div>
            </button>
          ))}
        </section>
      )}
    </main>
  );
}
