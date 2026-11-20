import fouaniProductsRaw from './fouaniProducts.json';
import fouaniMetaRaw from './fouaniMeta.json';
import type {
  BrandItem,
  CategoryItem,
  FouaniHomeLayout,
  Product,
  StoreSettings,
} from '../types';

export const DEFAULT_STORE_SETTINGS: StoreSettings = {
  ibadanFreeShippingThresholdNgn: 2000000,
  ibadanStandardFeeNgn: 15000,
  lagosFeeNgn: 35000,
  oyoStateFeeNgn: 25000,
  southWestFeeNgn: 45000,
  otherStatesFeeNgn: 65000,
  deliveryTargetDays: 30,
  saveToBuyRates: {
    '3': 0,
    '6': 12,
    '9': 18,
    '12': 24,
  },
  depositPercent: 50,
  gracePeriodDays: 7,
  weeklyLateFeePercent: 1,
  maxLateFeePercent: 5,
};

export const STORE_BANK_DETAILS = {
  bankName: 'Zenith Bank',
  accountName: 'MIND J-E MULTI CONCEPT',
  accountNumber: '1310307892',
};

export const STORE_CONTACT = {
  brandIdentity: 'JIMMY ELECTRONICS',
  businessName: 'MIND J-E MULTI CONCEPT',
  phone: '+234 9068333910',
  phoneDisplay: '+234 906 833 3910',
  email: 'mindjemulticoncept@gmail.com',
  cityHub: 'Ibadan, Oyo State, Nigeria',
  aboutDescription:
    'Now you can Buy Premium Home Appliances with Warranty, we deliver quality, durability, and trusted performance, Free Shipping Available.',
};

interface RawMetaCategory {
  id: number;
  name: string;
  slug: string;
  image?: string;
  productCount?: number;
  displayOrder: number;
  subCategories?: Array<{
    id: number;
    name: string;
    slug: string;
    parentId: number;
    productCount?: number;
    sortOrder?: number;
  }>;
}

interface RawMetaBrand {
  id: number;
  name: string;
  slug: string;
  image?: string;
  productCount?: number;
  sortOrder?: number;
}

const meta = fouaniMetaRaw as {
  categories: RawMetaCategory[];
  brands: RawMetaBrand[];
  homeLayout: FouaniHomeLayout;
  migratedAt: string;
  totalProducts: number;
};

export const SEED_CATEGORIES: CategoryItem[] = meta.categories.map((cat, idx) => ({
  id: `cat-${cat.id}`,
  numericId: cat.id,
  name: cat.name,
  slug: cat.slug,
  image: cat.image || '',
  productCount: cat.productCount || 0,
  displayOrder: cat.displayOrder ?? idx + 1,
  subCategories: cat.subCategories || [],
  isActive: true,
}));

export const SEED_BRANDS: BrandItem[] = meta.brands.map((b) => ({
  id: `brand-${b.id}`,
  numericId: b.id,
  name: b.name,
  slug: b.slug,
  image: b.image || '',
  productCount: b.productCount || 0,
  isActive: true,
}));

export const HOME_LAYOUT: FouaniHomeLayout = meta.homeLayout;

export const SEED_PRODUCTS: Product[] = (fouaniProductsRaw as Array<Record<string, unknown>>).map(
  (raw) => ({
    id: String(raw.id),
    numericId: typeof raw.numericId === 'number' ? raw.numericId : Number(raw.id),
    name: String(raw.name || ''),
    slug: String(raw.slug || ''),
    sku: String(raw.sku || `JE-${raw.id}`),
    brand: String(raw.brand || 'Generic'),
    brandId: typeof raw.brandId === 'number' ? raw.brandId : undefined,
    category: String(raw.category || 'Others'),
    categories: Array.isArray(raw.categories) ? (raw.categories as string[]) : [String(raw.category || 'Others')],
    subCategories: Array.isArray(raw.subCategories) ? (raw.subCategories as string[]) : [],
    categoryIds: Array.isArray(raw.categoryIds) ? (raw.categoryIds as number[]) : [],
    priceNgn: Number(raw.priceNgn || 0),
    ...(typeof raw.originalPriceNgn === 'number' && raw.originalPriceNgn > 0
      ? { originalPriceNgn: raw.originalPriceNgn }
      : {}),
    stockQty: Number(raw.stockQty ?? 0),
    nbViews: Number(raw.nbViews ?? 0),
    createdAtIso: String(raw.createdAtIso || ''),
    warranty: String(raw.warranty || 'Official Manufacturer Warranty'),
    shortDescription: String(raw.shortDescription || raw.name || ''),
    description: String(raw.description || raw.name || ''),
    images: Array.isArray(raw.images) ? (raw.images as string[]) : [],
    thumbImage: String(raw.thumbImage || ''),
    featured: Boolean(raw.featured),
    onPromotion: Boolean(raw.onPromotion),
    isActive: raw.isActive !== false,
  })
);

export function productMatchesCategory(
  product: Product,
  category?: string,
  subCategory?: string
): boolean {
  if (!category || category === 'ALL') return true;

  const target = category.toLowerCase();
  const catMatches =
    product.category.toLowerCase() === target ||
    (Array.isArray(product.categories) &&
      product.categories.some((c) => c.toLowerCase() === target));

  if (!catMatches) return false;

  if (subCategory && subCategory !== 'ALL') {
    const subTarget = subCategory.toLowerCase();
    return (
      Array.isArray(product.subCategories) &&
      product.subCategories.some((s) => s.toLowerCase() === subTarget)
    );
  }

  return true;
}
