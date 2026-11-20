import React from 'react';
import { formatNgn } from '../lib/format';
import { ResilientImage } from './ResilientImage';
import type { Product } from '../types';

interface ProductCardProps {
  product: Product;
  onSelect: (product: Product) => void;
  onAddToCart: (product: Product) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  onSelect,
  onAddToCart,
}) => {
  const outOfStock = product.stockQty <= 0;
  const hasDiscount =
    typeof product.originalPriceNgn === 'number' &&
    product.originalPriceNgn > product.priceNgn;
  const discountPct = hasDiscount
    ? Math.round(((product.originalPriceNgn! - product.priceNgn) / product.originalPriceNgn!) * 100)
    : 0;
  const cardImg = product.thumbImage || product.images?.[0];

  return (
    <article className="group bg-white border border-gray-200 rounded-xl p-2.5 flex flex-col justify-between transition-shadow duration-200 hover:shadow-md h-full relative">
      <div>
        {/* 1:1 Image Link matching Fouani .single-product .imageLink */}
        <button
          type="button"
          onClick={() => onSelect(product)}
          className="relative aspect-square w-full bg-white rounded-lg overflow-hidden flex items-center justify-center cursor-pointer"
        >
          {outOfStock && (
            <span className="absolute top-1.5 left-1.5 z-10 bg-[#141619] text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wide">
              Sold Out
            </span>
          )}
          {!outOfStock && hasDiscount && discountPct > 0 && (
            <span className="absolute top-1.5 left-1.5 z-10 bg-[#DC2626] text-white text-[10px] font-bold px-2 py-0.5 rounded">
              -{discountPct}%
            </span>
          )}
          <ResilientImage
            src={cardImg}
            alt={product.name}
            fallbackLabel={product.name}
            className="w-full h-full object-contain p-1 transition-transform duration-200 group-hover:scale-[1.03]"
          />
        </button>

        {/* Price Row (matching Fouani pricesWrapper) */}
        <div className="mt-2.5 flex items-baseline gap-2 flex-wrap">
          <span className="font-mono-num text-sm sm:text-[15px] font-bold text-[#141619]">
            {formatNgn(product.priceNgn)}
          </span>
          {hasDiscount && (
            <span className="font-mono-num text-xs text-gray-400 line-through">
              {formatNgn(product.originalPriceNgn!)}
            </span>
          )}
        </div>

        {/* 2-Line Clamped Product Title matching Fouani .itemTitle */}
        <button
          type="button"
          onClick={() => onSelect(product)}
          className="text-left w-full cursor-pointer mt-1"
        >
          <h3 className="text-xs sm:text-[13px] font-medium text-[#141619] leading-snug line-clamp-2 min-h-[36px] group-hover:text-[#DC2626] transition-colors">
            {product.name}
          </h3>
        </button>
      </div>

      {/* Full-width rounded Add to Cart / Sold Out button matching Fouani */}
      <button
        type="button"
        disabled={outOfStock}
        onClick={() => onAddToCart(product)}
        className={`w-full mt-3 border rounded-full py-2 px-3 text-xs sm:text-sm font-semibold transition-colors min-h-[38px] ${
          outOfStock
            ? 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed'
            : 'border-[#141619] text-[#141619] hover:bg-[#DC2626] hover:border-[#DC2626] hover:text-white cursor-pointer'
        }`}
      >
        {outOfStock ? 'Sold Out' : 'Add to Cart'}
      </button>
    </article>
  );
};
