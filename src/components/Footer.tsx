import React from 'react';
import { Phone, Mail, MapPin, Landmark } from 'lucide-react';
import { SEED_BRANDS, SEED_CATEGORIES, STORE_BANK_DETAILS, STORE_CONTACT } from '../data/seedCatalog';
import type { AppRoute } from './Header';

interface FooterProps {
  navigate: (next: AppRoute) => void;
}

export const Footer: React.FC<FooterProps> = ({ navigate }) => {
  return (
    <footer className="bg-[#141619] text-gray-300 border-t border-gray-800 mt-14">
      <div className="max-w-[1440px] mx-auto px-4 lg:px-8 py-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
        {/* Col 1: Logo & About Us (exact Fouani col-1 structure with Jimmy Electronics identity) */}
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <img
              src="/assets/aistudio/file_00000000b84481f4b44d267e06ddd435_d937ff89.png"
              alt="JIMMY ELECTRONICS | MIND J-E MULTI CONCEPT"
              className="w-12 h-12 rounded-full bg-white object-contain p-0.5 shrink-0"
            />
            <div>
              <p className="font-display font-bold text-white text-base leading-tight">
                JIMMY ELECTRONICS
              </p>
              <p className="text-xs font-semibold text-[#EF4444]">
                MIND J-E MULTI CONCEPT
              </p>
            </div>
          </div>
          <p className="text-sm text-gray-300 leading-relaxed">
            {STORE_CONTACT.aboutDescription}
          </p>
          <div className="bg-[#1E2228] border border-gray-800 rounded-lg p-3.5 space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-gray-300">
              <Landmark className="w-3.5 h-3.5 text-[#EF4444]" />
              <span>{STORE_BANK_DETAILS.bankName}</span>
            </div>
            <p className="text-xs text-gray-400">{STORE_BANK_DETAILS.accountName}</p>
            <p className="font-mono-num text-sm font-bold text-white">
              {STORE_BANK_DETAILS.accountNumber}
            </p>
          </div>
        </div>

        {/* Col 2: Categories */}
        <div>
          <h3 className="font-display text-sm font-bold text-[#EF4444] mb-4">
            Categories
          </h3>
          <ul className="flex flex-col gap-2.5 text-sm">
            {SEED_CATEGORIES.slice(0, 9).map((cat) => (
              <li key={cat.id}>
                <button
                  type="button"
                  onClick={() => navigate({ page: 'catalog', category: cat.name })}
                  className="text-gray-300 hover:text-white transition-colors text-left cursor-pointer"
                >
                  {cat.name}
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* Col 3: Top Brands & Policies */}
        <div>
          <h3 className="font-display text-sm font-bold text-[#EF4444] mb-4">
            Top Brands & Policies
          </h3>
          <ul className="flex flex-col gap-2.5 text-sm">
            {SEED_BRANDS.slice(0, 5).map((brand) => (
              <li key={brand.id}>
                <button
                  type="button"
                  onClick={() => navigate({ page: 'catalog', brand: brand.name })}
                  className="text-gray-300 hover:text-white transition-colors text-left cursor-pointer"
                >
                  {brand.name}
                </button>
              </li>
            ))}
            <li className="pt-2 border-t border-gray-800">
              <button
                type="button"
                onClick={() => navigate({ page: 'info', doc: 'delivery' })}
                className="text-gray-300 hover:text-white transition-colors cursor-pointer"
              >
                Delivery Policy (Ibadan Free &gt; ₦2M)
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={() => navigate({ page: 'info', doc: 'returns' })}
                className="text-gray-300 hover:text-white transition-colors cursor-pointer"
              >
                Return & Refund Policy
              </button>
            </li>
          </ul>
        </div>

        {/* Col 4: Contact Us */}
        <div>
          <h3 className="font-display text-sm font-bold text-[#EF4444] mb-4">
            Contact Us
          </h3>
          <ul className="flex flex-col gap-3.5 text-sm">
            <li>
              <a
                href={`tel:${STORE_CONTACT.phone.replace(/\s+/g, '')}`}
                className="flex items-center gap-2.5 text-gray-200 hover:text-white transition-colors"
              >
                <Phone className="w-4 h-4 text-[#EF4444] shrink-0" />
                <span className="tabular-nums">{STORE_CONTACT.phoneDisplay}</span>
              </a>
            </li>
            <li>
              <a
                href={`mailto:${STORE_CONTACT.email}`}
                className="flex items-center gap-2.5 text-gray-200 hover:text-white transition-colors break-all"
              >
                <Mail className="w-4 h-4 text-[#EF4444] shrink-0" />
                <span>{STORE_CONTACT.email}</span>
              </a>
            </li>
            <li className="flex items-center gap-2.5 text-gray-400">
              <MapPin className="w-4 h-4 text-[#EF4444] shrink-0" />
              <span>{STORE_CONTACT.cityHub}</span>
            </li>
            <li className="pt-2">
              <button
                type="button"
                onClick={() => navigate({ page: 'info', doc: 'about' })}
                className="text-xs font-semibold text-gray-300 hover:text-white underline cursor-pointer"
              >
                About JIMMY ELECTRONICS | MIND J-E MULTI CONCEPT
              </button>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="max-w-[1440px] mx-auto px-4 lg:px-8 py-6 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-gray-400">
          <p className="text-center md:text-start">
            © {new Date().getFullYear()} {STORE_CONTACT.brandIdentity} | {STORE_CONTACT.businessName}. All rights reserved.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-6">
            <button
              type="button"
              onClick={() => navigate({ page: 'info', doc: 'privacy' })}
              className="hover:text-white transition-colors cursor-pointer"
            >
              Privacy Policy
            </button>
            <button
              type="button"
              onClick={() => navigate({ page: 'info', doc: 'terms' })}
              className="hover:text-white transition-colors cursor-pointer"
            >
              Terms & Conditions
            </button>
            <button
              type="button"
              onClick={() => navigate({ page: 'info', doc: 'returns' })}
              className="hover:text-white transition-colors cursor-pointer"
            >
              Return Policy
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
};
