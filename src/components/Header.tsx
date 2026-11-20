import React, { useEffect, useRef, useState } from 'react';
import {
  Search,
  ShoppingCart,
  User,
  Menu,
  X,
  ShieldCheck,
  Phone,
  ChevronRight,
  LayoutGrid,
  ChevronDown,
} from 'lucide-react';
import { SEED_CATEGORIES, STORE_CONTACT } from '../data/seedCatalog';

export type AppRoute =
  | { page: 'home' }
  | {
      page: 'catalog';
      category?: string;
      subCategory?: string;
      brand?: string;
      promoOnly?: boolean;
      search?: string;
    }
  | { page: 'product'; productId: string }
  | { page: 'checkout'; initialMethod?: 'pay_now' | 'save_to_buy' | 'credably_bnpl' }
  | { page: 'account'; tab?: 'orders' | 'save_to_buy' | 'payments' | 'addresses' | 'profile' }
  | { page: 'admin'; tab?: 'analytics' | 'products' | 'orders' | 'save_to_buy' | 'credably' | 'shipping' }
  | { page: 'info'; doc: 'about' | 'contact' | 'terms' | 'privacy' | 'returns' | 'delivery' };

interface HeaderProps {
  route: AppRoute;
  navigate: (next: AppRoute) => void;
  searchQuery: string;
  onSearchSubmit: (q: string) => void;
  cartCount: number;
  onOpenCart: () => void;
  userEmail?: string | null;
  userName?: string | null;
  isAdmin: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  route,
  navigate,
  searchQuery,
  onSearchSubmit,
  cartCount,
  onOpenCart,
  userEmail,
  userName,
  isAdmin,
}) => {
  const [localQuery, setLocalQuery] = useState(searchQuery);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [megaMenuOpen, setMegaMenuOpen] = useState(false);
  const [expandedCatId, setExpandedCatId] = useState<string | null>(null);
  const megaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLocalQuery(searchQuery);
  }, [searchQuery]);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (megaRef.current && !megaRef.current.contains(e.target as Node)) {
        setMegaMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearchSubmit(localQuery.trim());
    setMobileMenuOpen(false);
    setMegaMenuOpen(false);
  };

  const activeCategory = route.page === 'catalog' ? route.category : undefined;

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-black/10">
      {/* Slim Top Utility Strip */}
      <div className="bg-[#141619] text-gray-200 text-xs">
        <div className="max-w-[1440px] mx-auto px-4 lg:px-8 h-8 flex items-center justify-between gap-4">
          <p className="truncate font-medium">
            Free Shipping within Ibadan strictly above ₦2,000,000 · Official Manufacturer Warranty
          </p>
          <div className="hidden md:flex items-center gap-5 shrink-0">
            <a
              href={`tel:${STORE_CONTACT.phone.replace(/\s+/g, '')}`}
              className="flex items-center gap-1.5 hover:text-white transition-colors whitespace-nowrap"
            >
              <Phone className="w-3.5 h-3.5 text-[#EF4444]" />
              <span className="tabular-nums">{STORE_CONTACT.phoneDisplay}</span>
            </a>
            <button
              type="button"
              onClick={() => navigate({ page: 'info', doc: 'delivery' })}
              className="hover:text-white transition-colors whitespace-nowrap cursor-pointer"
            >
              Delivery Policy
            </button>
            <button
              type="button"
              onClick={() => navigate({ page: 'info', doc: 'about' })}
              className="hover:text-white transition-colors whitespace-nowrap cursor-pointer"
            >
              About Us
            </button>
            <button
              type="button"
              onClick={() => navigate({ page: 'info', doc: 'contact' })}
              className="hover:text-white transition-colors whitespace-nowrap cursor-pointer"
            >
              Contact
            </button>
          </div>
        </div>
      </div>

      {/* Main Nav Row (Fouani layout + Jimmy Electronics branding) */}
      <nav className="max-w-[1440px] mx-auto px-4 lg:px-8 py-3 flex items-center justify-between gap-4 lg:gap-8">
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setMobileMenuOpen((v) => !v)}
            className="lg:hidden p-2 -ml-1.5 rounded-lg text-[#141619] hover:bg-gray-100 min-w-[44px] min-h-[44px] flex items-center justify-center cursor-pointer"
            aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <button
            type="button"
            onClick={() => {
              navigate({ page: 'home' });
              setMegaMenuOpen(false);
            }}
            className="flex items-center gap-2.5 text-left cursor-pointer group shrink-0"
          >
            <img
              src="/assets/aistudio/file_00000000b84481f4b44d267e06ddd435_d937ff89.png"
              alt="JIMMY ELECTRONICS | MIND J-E MULTI CONCEPT Logo"
              className="w-11 h-11 sm:w-12 sm:h-12 rounded-full object-contain bg-white border border-gray-200 shrink-0"
            />
            <div className="leading-tight">
              <span className="block font-display font-extrabold text-sm sm:text-base tracking-tight text-[#141619] group-hover:text-[#DC2626] transition-colors whitespace-nowrap">
                JIMMY ELECTRONICS
              </span>
              <span className="block text-[10px] sm:text-[11px] font-semibold tracking-wider text-[#DC2626] whitespace-nowrap">
                MIND J-E MULTI CONCEPT
              </span>
            </div>
          </button>
        </div>

        {/* Center: Pill Search Bar (matching Fouani rounded-full h-12) */}
        <form onSubmit={handleSubmit} className="hidden lg:flex flex-1 max-w-2xl">
          <div className="relative w-full">
            <input
              type="search"
              value={localQuery}
              onChange={(e) => setLocalQuery(e.target.value)}
              placeholder="Search for products"
              className="w-full h-11 pl-5 pr-12 text-sm bg-[#F4F5F7] border border-gray-200 rounded-full text-[#141619] placeholder:text-gray-500 focus:outline-none focus:bg-white focus:border-[#DC2626] transition-colors"
              aria-label="Search for products"
            />
            <button
              type="submit"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-[#DC2626] hover:bg-[#B91C1C] text-white flex items-center justify-center transition-colors cursor-pointer"
              aria-label="Search"
            >
              <Search className="w-4 h-4" />
            </button>
          </div>
        </form>

        {/* Right: Quick Links + Admin + Cart + Account (Fouani pattern) */}
        <div className="flex items-center gap-2 sm:gap-5 shrink-0">
          {isAdmin && (
            <button
              type="button"
              onClick={() => navigate({ page: 'admin', tab: 'analytics' })}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-full bg-[#141619] text-white hover:bg-[#2A2E35] transition-colors whitespace-nowrap cursor-pointer"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-[#EF4444]" />
              <span>Admin</span>
            </button>
          )}

          <button
            type="button"
            onClick={onOpenCart}
            className="relative inline-flex items-center gap-1.5 px-2.5 py-2 rounded-full text-sm font-semibold text-[#141619] hover:text-[#DC2626] transition-colors cursor-pointer min-h-[44px]"
            aria-label={`Open shopping cart with ${cartCount} items`}
          >
            <div className="relative">
              <ShoppingCart className="w-5 h-5" />
              <span className="bg-[#DC2626] text-white text-[10px] font-bold min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center absolute -top-2 -right-2 tabular-nums">
                {cartCount}
              </span>
            </div>
            <span className="hidden lg:inline ml-1">Cart</span>
          </button>

          <button
            type="button"
            onClick={() => navigate({ page: 'account', tab: 'orders' })}
            className="inline-flex items-center gap-2 px-2.5 py-2 rounded-full text-sm font-semibold text-[#141619] hover:text-[#DC2626] transition-colors cursor-pointer min-h-[44px]"
            aria-label="Account"
          >
            <User className="w-5 h-5 shrink-0" />
            <span className="hidden lg:inline max-w-[130px] truncate">
              {userEmail ? userName || 'My Account' : 'Login / Register'}
            </span>
          </button>
        </div>
      </nav>

      {/* Mobile Search Bar (matching Fouani lg:hidden block) */}
      <div className="lg:hidden px-4 pb-3 bg-white">
        <form onSubmit={handleSubmit} className="relative w-full">
          <input
            type="search"
            value={localQuery}
            onChange={(e) => setLocalQuery(e.target.value)}
            placeholder="Search for products"
            className="w-full h-11 pl-4 pr-12 text-sm bg-[#F4F5F7] border border-gray-200 rounded-full text-[#141619] placeholder:text-gray-500 focus:outline-none focus:bg-white focus:border-[#DC2626]"
            aria-label="Mobile search products"
          />
          <button
            type="submit"
            className="absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-[#DC2626] text-white flex items-center justify-center cursor-pointer"
            aria-label="Submit search"
          >
            <Search className="w-4 h-4" />
          </button>
        </form>
      </div>

      {/* Desktop Secondary Horizontal Category Strip (matching Fouani's All Categories + scrollable categories) */}
      <div ref={megaRef} className="hidden lg:block bg-white border-t border-black/10 relative">
        <div className="max-w-[1440px] mx-auto px-4 lg:px-8 py-2.5 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMegaMenuOpen((v) => !v)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-bold shrink-0 cursor-pointer transition-colors ${
              megaMenuOpen
                ? 'bg-[#141619] text-white'
                : 'text-[#141619] hover:bg-gray-100'
            }`}
          >
            <LayoutGrid className="w-4 h-4 text-[#DC2626]" />
            <span>All Categories</span>
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${megaMenuOpen ? 'rotate-180' : ''}`} />
          </button>

          <div className="flex-1 overflow-x-auto no-scrollbar">
            <div className="flex items-center gap-1">
              {SEED_CATEGORIES.map((cat) => {
                const isSelected = activeCategory === cat.name;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      setMegaMenuOpen(false);
                      navigate({
                        page: 'catalog',
                        category: cat.name,
                        promoOnly: cat.name === 'Promotions' ? true : undefined,
                      });
                    }}
                    className={`shrink-0 px-3.5 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-[#DC2626] text-white font-semibold'
                        : 'text-[#141619] hover:bg-gray-100 hover:text-[#DC2626]'
                    }`}
                  >
                    {cat.name}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* All Categories Mega-Menu Panel */}
        {megaMenuOpen && (
          <div className="absolute left-0 right-0 top-full bg-white border-b border-gray-200 shadow-xl z-50">
            <div className="max-w-[1440px] mx-auto px-4 lg:px-8 py-6">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
                <h2 className="font-display text-base font-bold text-[#141619]">
                  Browse All {SEED_CATEGORIES.length} Departments & Subcategories
                </h2>
                <button
                  type="button"
                  onClick={() => {
                    setMegaMenuOpen(false);
                    navigate({ page: 'catalog' });
                  }}
                  className="text-xs font-semibold text-[#DC2626] hover:underline cursor-pointer"
                >
                  View Full Catalogue →
                </button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6 max-h-[65vh] overflow-y-auto">
                {SEED_CATEGORIES.map((cat) => (
                  <div key={cat.id} className="space-y-2">
                    <button
                      type="button"
                      onClick={() => {
                        setMegaMenuOpen(false);
                        navigate({ page: 'catalog', category: cat.name });
                      }}
                      className="text-sm font-bold text-[#141619] hover:text-[#DC2626] text-left cursor-pointer block"
                    >
                      {cat.name}
                    </button>
                    {cat.subCategories && cat.subCategories.length > 0 && (
                      <ul className="space-y-1">
                        {cat.subCategories.map((sub) => (
                          <li key={sub.id}>
                            <button
                              type="button"
                              onClick={() => {
                                setMegaMenuOpen(false);
                                navigate({
                                  page: 'catalog',
                                  category: cat.name,
                                  subCategory: sub.name,
                                });
                              }}
                              className="text-xs text-gray-600 hover:text-[#DC2626] text-left cursor-pointer"
                            >
                              {sub.name}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-white border-t border-gray-200 px-4 py-4 space-y-4 max-h-[75vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                navigate({ page: 'catalog' });
                setMobileMenuOpen(false);
              }}
              className="py-2.5 px-3 text-left text-sm font-semibold bg-[#F4F5F7] rounded-lg text-[#141619]"
            >
              Shop All Products
            </button>
            <button
              type="button"
              onClick={() => {
                navigate({ page: 'account', tab: 'save_to_buy' });
                setMobileMenuOpen(false);
              }}
              className="py-2.5 px-3 text-left text-sm font-semibold bg-[#F4F5F7] rounded-lg text-[#DC2626]"
            >
              Save to Buy
            </button>
            {isAdmin && (
              <button
                type="button"
                onClick={() => {
                  navigate({ page: 'admin', tab: 'analytics' });
                  setMobileMenuOpen(false);
                }}
                className="col-span-2 py-2.5 px-3 text-left text-sm font-semibold bg-[#141619] text-white rounded-lg flex items-center justify-between"
              >
                <span>Admin Dashboard</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-500 mb-2">Categories</p>
            <div className="divide-y divide-gray-100 border border-gray-200 rounded-lg">
              {SEED_CATEGORIES.map((cat) => {
                const isExpanded = expandedCatId === cat.id;
                const hasSubs = Boolean(cat.subCategories?.length);
                return (
                  <div key={cat.id}>
                    <div className="flex items-center justify-between px-3 py-2.5">
                      <button
                        type="button"
                        onClick={() => {
                          navigate({ page: 'catalog', category: cat.name });
                          setMobileMenuOpen(false);
                        }}
                        className="text-sm font-medium text-[#141619] text-left flex-1"
                      >
                        {cat.name}
                      </button>
                      {hasSubs && (
                        <button
                          type="button"
                          onClick={() => setExpandedCatId(isExpanded ? null : cat.id)}
                          className="p-1 text-gray-500"
                          aria-label={`Expand ${cat.name}`}
                        >
                          <ChevronDown
                            className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                          />
                        </button>
                      )}
                    </div>
                    {isExpanded && cat.subCategories && (
                      <div className="bg-[#F8F9FA] px-4 py-2 space-y-1.5 border-t border-gray-100">
                        {cat.subCategories.map((sub) => (
                          <button
                            key={sub.id}
                            type="button"
                            onClick={() => {
                              navigate({
                                page: 'catalog',
                                category: cat.name,
                                subCategory: sub.name,
                              });
                              setMobileMenuOpen(false);
                            }}
                            className="block w-full text-left text-xs text-gray-700 py-1 hover:text-[#DC2626]"
                          >
                            {sub.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-100 text-xs font-medium text-gray-600">
            <button
              type="button"
              onClick={() => {
                navigate({ page: 'info', doc: 'about' });
                setMobileMenuOpen(false);
              }}
              className="py-2 text-left"
            >
              About Us
            </button>
            <button
              type="button"
              onClick={() => {
                navigate({ page: 'info', doc: 'contact' });
                setMobileMenuOpen(false);
              }}
              className="py-2 text-left"
            >
              Contact Us
            </button>
            <button
              type="button"
              onClick={() => {
                navigate({ page: 'info', doc: 'delivery' });
                setMobileMenuOpen(false);
              }}
              className="py-2 text-left"
            >
              Delivery Policy
            </button>
            <button
              type="button"
              onClick={() => {
                navigate({ page: 'info', doc: 'returns' });
                setMobileMenuOpen(false);
              }}
              className="py-2 text-left"
            >
              Return & Refund Policy
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
