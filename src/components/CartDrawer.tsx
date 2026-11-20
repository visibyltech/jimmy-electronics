import React from 'react';
import { X, Trash2, Plus, Minus, ShoppingBag, Truck } from 'lucide-react';
import { formatNgn } from '../lib/format';
import { ResilientImage } from './ResilientImage';
import type { CartItem, StoreSettings } from '../types';

interface CartDrawerProps {
  open: boolean;
  onClose: () => void;
  items: CartItem[];
  storeSettings: StoreSettings;
  onUpdateQty: (productId: string, qty: number) => void;
  onRemoveItem: (productId: string) => void;
  onCheckout: () => void;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({
  open,
  onClose,
  items,
  storeSettings,
  onUpdateQty,
  onRemoveItem,
  onCheckout,
}) => {
  if (!open) return null;

  const subtotal = items.reduce((sum, i) => sum + i.priceNgn * i.quantity, 0);
  const threshold = storeSettings.ibadanFreeShippingThresholdNgn;
  const qualifiesIbadanFree = subtotal > threshold;
  const amountNeeded = Math.max(0, threshold + 1 - subtotal);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className="fixed inset-0 bg-black/50 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col z-10"
        aria-label="Shopping Cart"
      >
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-[#DC2626]" />
            <h2 className="font-display text-lg font-bold text-[#141619]">
              Your Shopping Cart ({items.reduce((s, i) => s + i.quantity, 0)})
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 cursor-pointer min-w-[40px] min-h-[40px] flex items-center justify-center"
            aria-label="Close Cart"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Ibadan Free Shipping Status */}
        <div className="px-5 py-3 bg-[#F8F9FA] border-b border-gray-200 flex items-start gap-2.5 text-xs">
          <Truck className="w-4 h-4 text-[#DC2626] shrink-0 mt-0.5" />
          <p className="text-gray-700 leading-relaxed">
            {qualifiesIbadanFree ? (
              <span className="font-semibold text-emerald-700">
                Your order exceeds {formatNgn(threshold)} and qualifies for Free Shipping if delivered within Ibadan.
              </span>
            ) : (
              <span>
                Add <strong className="font-mono-num">{formatNgn(amountNeeded)}</strong> more to unlock Free Shipping within Ibadan (orders strictly above {formatNgn(threshold)}).
              </span>
            )}
          </p>
        </div>

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto px-5 py-4 divide-y divide-gray-100">
          {items.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <ShoppingBag className="w-10 h-10 text-gray-300 mx-auto" />
              <p className="text-sm font-semibold text-gray-700">Your cart is currently empty</p>
              <p className="text-xs text-gray-500">
                Browse our refrigerators, TVs, solar bundles, and home appliances to get started.
              </p>
            </div>
          ) : (
            items.map((item) => (
              <div key={item.productId} className="py-4 flex gap-3.5">
                <div className="w-20 h-20 rounded-lg bg-[#F4F5F7] border border-gray-200 p-1.5 shrink-0">
                  <ResilientImage
                    src={item.image}
                    alt={item.name}
                    className="w-full h-full object-contain"
                  />
                </div>
                <div className="flex-1 min-w-0 space-y-1.5">
                  <p className="text-xs font-semibold text-[#DC2626]">{item.brand}</p>
                  <h3 className="text-sm font-semibold text-[#141619] line-clamp-2 leading-snug">
                    {item.name}
                  </h3>
                  <p className="font-mono-num text-sm font-bold text-[#141619]">
                    {formatNgn(item.priceNgn * item.quantity)}
                  </p>
                  <div className="flex items-center justify-between pt-1">
                    <div className="inline-flex items-center border border-gray-300 rounded-md">
                      <button
                        type="button"
                        onClick={() => onUpdateQty(item.productId, item.quantity - 1)}
                        className="w-8 h-8 flex items-center justify-center text-gray-700 hover:bg-gray-100 cursor-pointer"
                        aria-label="Decrease item quantity"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="w-8 text-center font-mono-num text-xs font-bold">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateQty(
                            item.productId,
                            Math.min(Math.max(1, item.stockQty), item.quantity + 1)
                          )
                        }
                        className="w-8 h-8 flex items-center justify-center text-gray-700 hover:bg-gray-100 cursor-pointer"
                        aria-label="Increase item quantity"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => onRemoveItem(item.productId)}
                      className="p-2 text-gray-400 hover:text-[#DC2626] cursor-pointer"
                      aria-label={`Remove ${item.name}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer Totals */}
        {items.length > 0 && (
          <div className="border-t border-gray-200 px-5 py-4 space-y-4 bg-white">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600 font-medium">Subtotal</span>
              <span className="font-mono-num text-lg font-extrabold text-[#141619]">
                {formatNgn(subtotal)}
              </span>
            </div>
            <p className="text-xs text-gray-500">
              Delivery fee calculated at checkout based on location and Ibadan ₦2,000,000+ threshold.
            </p>
            <button
              type="button"
              onClick={onCheckout}
              className="w-full py-3.5 px-5 bg-[#DC2626] hover:bg-[#B91C1C] text-white font-semibold text-sm rounded-lg transition-colors cursor-pointer min-h-[48px]"
            >
              Proceed to Checkout
            </button>
          </div>
        )}
      </aside>
    </div>
  );
};
