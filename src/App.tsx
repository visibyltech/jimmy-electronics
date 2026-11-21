import React, { useEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { CheckCircle2 } from 'lucide-react';
import { auth, isBootstrappedAdminEmail, testFirestoreConnection } from './lib/firebase';
import {
  checkIsUserAdmin,
  ensureUserProfile,
  fetchStoreSettings,
  subscribeCatalogProducts,
} from './lib/firestoreService';
import { DEFAULT_STORE_SETTINGS, SEED_PRODUCTS } from './data/seedCatalog';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Header, type AppRoute } from './components/Header';
import { Footer } from './components/Footer';
import { HomePage } from './components/HomePage';
import { CatalogPage } from './components/CatalogPage';
import { ProductDetailPage } from './components/ProductDetailPage';
import { CartDrawer } from './components/CartDrawer';
import { CheckoutPage } from './components/CheckoutPage';
import { AccountPage } from './components/AccountPage';
import { AdminDashboardPage } from './components/AdminDashboardPage';
import { LegalAndInfoPages } from './components/LegalAndInfoPages';
import type { CartItem, Product, StoreSettings, UserProfile } from './types';

const CART_STORAGE_KEY = 'jimmy_electronics_cart_v1';

export default function App() {
  const [route, setRoute] = useState<AppRoute>({ page: 'home' });
  const [searchQuery, setSearchQuery] = useState('');
  const [products, setProducts] = useState<Product[]>(SEED_PRODUCTS);
  const [storeSettings, setStoreSettings] = useState<StoreSettings>(DEFAULT_STORE_SETTINGS);

  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem(CART_STORAGE_KEY);
      return saved ? (JSON.parse(saved) as CartItem[]) : [];
    } catch {
      return [];
    }
  });
  const [cartOpen, setCartOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  useEffect(() => {
    // Register the initial route so Back from the first in-app page stays in the app.
    const initialState =
      window.history.state && typeof window.history.state === 'object'
        ? window.history.state
        : {};
    window.history.replaceState(
      {
        ...initialState,
        __jimmyElectronicsRoute: route,
        __jimmyElectronicsScrollY: window.scrollY,
      },
      '',
      window.location.href
    );

    const handlePopState = (event: PopStateEvent) => {
      const previousRoute = event.state?.__jimmyElectronicsRoute as AppRoute | undefined;
      const previousScrollY = Number(event.state?.__jimmyElectronicsScrollY ?? 0);

      setRoute(previousRoute ?? { page: 'home' });
      window.requestAnimationFrame(() => {
        window.scrollTo({ top: previousScrollY, behavior: 'auto' });
      });
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    testFirestoreConnection();
    fetchStoreSettings().then(setStoreSettings).catch(() => {});
    const unsubCatalog = subscribeCatalogProducts(setProducts);
    return () => unsubCatalog();
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    } catch {
      // Ignore storage quota issues
    }
  }, [cart]);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (!firebaseUser) {
        setProfile(null);
        setIsAdmin(false);
        return;
      }

      const adminCheck =
        isBootstrappedAdminEmail(firebaseUser.email) ||
        (await checkIsUserAdmin(firebaseUser.uid));
      setIsAdmin(Boolean(adminCheck));

      try {
        const prof = await ensureUserProfile({
          uid: firebaseUser.uid,
          fullName: firebaseUser.displayName || 'Valued Customer',
          email: firebaseUser.email || '',
        });
        setProfile(prof);
      } catch {
        // Handled safely
      }
    });
    return () => unsubAuth();
  }, []);

  const navigate = (next: AppRoute) => {
    // Save the current in-app page and scroll position before navigating.
    const currentState =
      window.history.state && typeof window.history.state === 'object'
        ? window.history.state
        : {};
    window.history.replaceState(
      { ...currentState, __jimmyElectronicsRoute: route, __jimmyElectronicsScrollY: window.scrollY },
      '',
      window.location.href
    );

    // Add an in-app history entry so Android/browser Back returns to the previous page.
    window.history.pushState(
      { __jimmyElectronicsRoute: next, __jimmyElectronicsScrollY: 0 },
      '',
      window.location.href
    );

    setRoute(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 2800);
  };

  const handleAddToCart = (product: Product, qty = 1) => {
    if (product.stockQty <= 0) return;
    setCart((prev) => {
      const existing = prev.find((i) => i.productId === product.id);
      if (existing) {
        return prev.map((i) =>
          i.productId === product.id
            ? { ...i, quantity: Math.min(product.stockQty, i.quantity + qty) }
            : i
        );
      }
      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          sku: product.sku,
          brand: product.brand,
          category: product.category,
          priceNgn: product.priceNgn,
          image: product.images?.[0] || '/assets/aistudio/file_00000000b84481f4b44d267e06ddd435_d937ff89.png',
          warranty: product.warranty,
          quantity: Math.min(product.stockQty, qty),
          stockQty: product.stockQty,
        },
      ];
    });
    showToast(`Added "${product.name}" to cart`);
  };

  const handleBuyNow = (
    product: Product,
    qty: number,
    method: 'pay_now' | 'save_to_buy' | 'credably_bnpl'
  ) => {
    handleAddToCart(product, qty);
    navigate({ page: 'checkout', initialMethod: method });
  };

  const handleUpdateQty = (productId: string, qty: number) => {
    if (qty <= 0) {
      setCart((prev) => prev.filter((i) => i.productId !== productId));
      return;
    }
    setCart((prev) =>
      prev.map((i) => (i.productId === productId ? { ...i, quantity: qty } : i))
    );
  };

  const handleRemoveCartItem = (productId: string) => {
    setCart((prev) => prev.filter((i) => i.productId !== productId));
  };

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const selectedProduct =
    route.page === 'product'
      ? products.find((p) => p.id === route.productId) || products[0]
      : null;

  return (
    <ErrorBoundary>
      <div className="min-h-screen flex flex-col bg-white text-[#141619]">
        <Header
          route={route}
          navigate={navigate}
          searchQuery={searchQuery}
          onSearchSubmit={(q) => {
            setSearchQuery(q);
            navigate({ page: 'catalog', search: q });
          }}
          cartCount={cartCount}
          onOpenCart={() => setCartOpen(true)}
          userEmail={user?.email}
          userName={profile?.fullName || user?.displayName}
          isAdmin={isAdmin}
        />

        {toastMsg && (
          <div className="fixed bottom-5 right-5 z-50 bg-[#141619] text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 text-xs font-semibold">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{toastMsg}</span>
          </div>
        )}

        <main className="flex-1">
          {route.page === 'home' && (
            <HomePage
              products={products}
              navigate={navigate}
              onAddToCart={(p) => handleAddToCart(p, 1)}
            />
          )}

          {route.page === 'catalog' && (
            <CatalogPage
              products={products}
              initialCategory={route.category}
              initialSubCategory={route.subCategory}
              initialBrand={route.brand}
              initialPromoOnly={route.promoOnly}
              initialSearch={route.search ?? searchQuery}
              onSelectProduct={(p) => navigate({ page: 'product', productId: p.id })}
              onAddToCart={(p) => handleAddToCart(p, 1)}
            />
          )}

          {route.page === 'product' && selectedProduct && (
            <ProductDetailPage
              product={selectedProduct}
              allProducts={products}
              storeSettings={storeSettings}
              navigate={navigate}
              onAddToCart={handleAddToCart}
              onBuyNow={handleBuyNow}
            />
          )}

          {route.page === 'checkout' && (
            <CheckoutPage
              items={cart}
              storeSettings={storeSettings}
              user={user}
              profile={profile}
              initialMethod={route.initialMethod}
              navigate={navigate}
              onClearCart={() => setCart([])}
            />
          )}

          {route.page === 'account' && (
            <AccountPage
              user={user}
              profile={profile}
              initialTab={route.tab}
              onProfileUpdated={async () => {
                if (user?.emailVerified) {
                  const prof = await ensureUserProfile({
                    uid: user.uid,
                    fullName: user.displayName || 'Customer',
                    email: user.email || '',
                  });
                  setProfile(prof);
                }
              }}
            />
          )}

          {route.page === 'admin' && (
            isAdmin && user ? (
              <AdminDashboardPage
                user={user}
                products={products}
                storeSettings={storeSettings}
                onSettingsUpdated={setStoreSettings}
                initialTab={route.tab}
              />
            ) : (
              <div className="max-w-lg mx-auto px-4 py-16 text-center space-y-4">
                <h1 className="font-display text-2xl font-bold text-[#141619]">
                  Administrator Access Required
                </h1>
                <p className="text-sm text-gray-600">
                  Sign in with an authorized administrator account to access store management tools.
                </p>
                <button
                  type="button"
                  onClick={() => navigate({ page: 'account', tab: 'orders' })}
                  className="px-6 py-3 bg-[#DC2626] text-white text-sm font-semibold rounded-lg cursor-pointer"
                >
                  Go to Account Sign In
                </button>
              </div>
            )
          )}

          {route.page === 'info' && <LegalAndInfoPages doc={route.doc} />}
        </main>

        <Footer navigate={navigate} />

        <CartDrawer
          open={cartOpen}
          onClose={() => setCartOpen(false)}
          items={cart}
          storeSettings={storeSettings}
          onUpdateQty={handleUpdateQty}
          onRemoveItem={handleRemoveCartItem}
          onCheckout={() => {
            setCartOpen(false);
            navigate({ page: 'checkout' });
          }}
        />
      </div>
    </ErrorBoundary>
  );
}
