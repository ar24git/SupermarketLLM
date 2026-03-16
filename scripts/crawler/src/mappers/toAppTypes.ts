import { z } from 'zod';
import type { RawBasketProduct } from '../extractors/householdBasket.js';
import type { ProductPriceDetail } from '../extractors/productDetail.js';
import { mapChainName, createStoreFromName, type StoreInfo } from './storeMapping.js';

// Zod schemas matching app interfaces
export const ProductSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  nameGreek: z.string().min(1),
  category: z.string().min(1),
  brand: z.string().optional(),
  unit: z.string().min(1),
});

export const StoreSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  nameGreek: z.string().min(1),
  chain: z.string().min(1),
  location: z.string().optional(),
});

export const PriceEntrySchema = z.object({
  productId: z.string().min(1),
  storeId: z.string().min(1),
  price: z.number().positive(),
  currency: z.string().min(1),
  lastUpdated: z.string().min(1),
  promotion: z.string().optional(),
});

export type AppProduct = z.infer<typeof ProductSchema>;
export type AppStore = z.infer<typeof StoreSchema>;
export type AppPriceEntry = z.infer<typeof PriceEntrySchema>;

// Greek-to-English product name translations for common food items
const PRODUCT_TRANSLATIONS: Record<string, string> = {
  'γάλα': 'Milk', 'γιαούρτι': 'Yogurt', 'φέτα': 'Feta Cheese', 'βούτυρο': 'Butter',
  'τυρί': 'Cheese', 'κρέμα': 'Cream', 'αυγά': 'Eggs',
  'ψωμί': 'Bread', 'αλεύρι': 'Flour',
  'κοτόπουλο': 'Chicken', 'βοδινό': 'Beef', 'χοιρινό': 'Pork', 'κιμά': 'Mince',
  'μοσχάρι': 'Veal', 'αρνί': 'Lamb',
  'σολομό': 'Salmon', 'σαρδέλ': 'Sardines', 'τόνο': 'Tuna',
  'μήλα': 'Apples', 'μπανάν': 'Bananas', 'πορτοκάλ': 'Oranges', 'λεμόνι': 'Lemons',
  'ντομάτ': 'Tomatoes', 'πατάτ': 'Potatoes', 'κρεμμύδ': 'Onions', 'αγγούρ': 'Cucumbers',
  'μαρούλι': 'Lettuce', 'καρότ': 'Carrots', 'πιπερι': 'Peppers',
  'νερό': 'Water', 'χυμό': 'Juice', 'καφέ': 'Coffee',
  'ρύζι': 'Rice', 'μακαρόνια': 'Pasta', 'ζυμαρικ': 'Pasta',
  'ελαιόλαδο': 'Olive Oil', 'λάδι': 'Oil',
  'ζάχαρη': 'Sugar', 'αλάτι': 'Salt',
  'σαπούνι': 'Soap', 'απορρυπαντικ': 'Detergent', 'χαρτί': 'Paper',
  'σοκολάτα': 'Chocolate', 'πατατάκι': 'Chips', 'μπισκότ': 'Biscuits',
};

const CATEGORY_TRANSLATIONS: Record<string, string> = {
  'γαλακτοκομικά': 'Dairy', 'αλλαντικά': 'Deli',
  'κρέατα': 'Meat', 'κρέας': 'Meat',
  'ψάρια': 'Fish', 'θαλασσινά': 'Seafood',
  'φρούτα': 'Fruits', 'λαχανικά': 'Vegetables',
  'οπωροκηπευτικά': 'Produce', 'οπωρολαχανικά': 'Produce',
  'ποτά': 'Beverages', 'αναψυκτικά': 'Beverages',
  'αρτοποιείο': 'Bakery', 'αρτοσκευάσματα': 'Bakery',
  'δημητριακά': 'Cereals', 'βασικά': 'Staples',
  'είδη καθαρισμού': 'Cleaning', 'καθαριότητα': 'Cleaning',
  'είδη προσωπικής υγιεινής': 'Personal Care',
  'τρόφιμα': 'Food', 'παντοπωλείο': 'Grocery',
  'κατεψυγμένα': 'Frozen', 'σνακ': 'Snacks',
};

const UNIT_PATTERNS: Array<[RegExp, string]> = [
  [/(\d+)\s*κιλ|(\d+)\s*kg/i, 'kg'],
  [/(\d+)\s*γρ|(\d+)\s*gr/i, 'g'],
  [/(\d+)\s*λίτρ|(\d+)\s*lt|(\d+)\s*ml/i, 'lt'],
  [/(\d+)\s*τεμ|(\d+)\s*pcs/i, 'pcs'],
  [/κιλ[όο]/i, 'kg'],
  [/λίτρ/i, 'lt'],
  [/τεμάχι/i, 'pcs'],
];

export function translateProductName(greekName: string): string {
  const lower = greekName.toLowerCase();
  for (const [greekPart, english] of Object.entries(PRODUCT_TRANSLATIONS)) {
    if (lower.includes(greekPart)) return english;
  }
  // Return the Greek name if no translation found
  return greekName;
}

function translateCategory(greekCategory: string): string {
  const lower = greekCategory.toLowerCase();
  for (const [greekPart, english] of Object.entries(CATEGORY_TRANSLATIONS)) {
    if (lower.includes(greekPart)) return english;
  }
  return greekCategory || 'General';
}

function parseUnit(productName: string): string {
  for (const [pattern, unit] of UNIT_PATTERNS) {
    if (pattern.test(productName)) return unit;
  }
  return 'pcs'; // default
}

function makeProductId(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-zα-ωά-ώ0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 40);
}

export interface MappedData {
  stores: AppStore[];
  products: AppProduct[];
  prices: AppPriceEntry[];
  warnings: string[];
}

export function mapBasketData(
  rawProducts: RawBasketProduct[],
  chainNames: string[],
  scrapeDate: string
): MappedData {
  const warnings: string[] = [];
  const storeMap = new Map<string, AppStore>();
  const products: AppProduct[] = [];
  const prices: AppPriceEntry[] = [];

  // Map chain names to stores
  for (const chainName of chainNames) {
    const storeInfo = mapChainName(chainName);
    if (storeInfo) {
      storeMap.set(chainName, {
        id: storeInfo.id,
        name: storeInfo.name,
        nameGreek: storeInfo.nameGreek,
        chain: storeInfo.chain,
      });
    } else {
      const created = createStoreFromName(chainName);
      storeMap.set(chainName, {
        id: created.id,
        name: created.name,
        nameGreek: created.nameGreek,
        chain: created.chain,
      });
      warnings.push(`Unknown chain "${chainName}" - created new store entry "${created.id}"`);
    }
  }

  // Map products and prices
  for (const raw of rawProducts) {
    const productId = makeProductId(raw.name);
    if (!productId) {
      warnings.push(`Skipped product with empty name`);
      continue;
    }

    const product: AppProduct = {
      id: productId,
      name: translateProductName(raw.name),
      nameGreek: raw.name,
      category: translateCategory(raw.category),
      unit: parseUnit(raw.name),
    };

    const validation = ProductSchema.safeParse(product);
    if (!validation.success) {
      warnings.push(`Invalid product "${raw.name}": ${validation.error.message}`);
      continue;
    }

    products.push(product);

    // Map prices for this product
    for (const [chainName, price] of Object.entries(raw.prices)) {
      if (price === null || price <= 0) continue;

      const store = storeMap.get(chainName);
      if (!store) continue;

      const priceEntry: AppPriceEntry = {
        productId,
        storeId: store.id,
        price,
        currency: 'EUR',
        lastUpdated: scrapeDate,
      };

      const priceValidation = PriceEntrySchema.safeParse(priceEntry);
      if (priceValidation.success) {
        prices.push(priceEntry);
      } else {
        warnings.push(`Invalid price for "${raw.name}" at "${chainName}": ${priceValidation.error.message}`);
      }
    }
  }

  // Deduplicate stores
  const uniqueStores = [...storeMap.values()];
  const seenStoreIds = new Set<string>();
  const stores = uniqueStores.filter((s) => {
    if (seenStoreIds.has(s.id)) return false;
    seenStoreIds.add(s.id);
    return true;
  });

  return { stores, products, prices, warnings };
}

export function mapDetailData(
  details: ProductPriceDetail[],
  scrapeDate: string
): MappedData {
  const warnings: string[] = [];
  const storeMap = new Map<string, AppStore>();
  const products: AppProduct[] = [];
  const prices: AppPriceEntry[] = [];
  const seenProductIds = new Set<string>();

  for (const detail of details) {
    if (!detail.productName || detail.retailerPrices.length === 0) continue;

    const productId = makeProductId(detail.productName);
    if (!productId || seenProductIds.has(productId)) continue;
    seenProductIds.add(productId);

    const product: AppProduct = {
      id: productId,
      name: translateProductName(detail.productName),
      nameGreek: detail.productName,
      category: guessCategoryFromName(detail.productName),
      unit: parseUnit(detail.productName),
    };

    const validation = ProductSchema.safeParse(product);
    if (!validation.success) {
      warnings.push(`Invalid product "${detail.productName}": ${validation.error.message}`);
      continue;
    }

    products.push(product);

    for (const rp of detail.retailerPrices) {
      // Map retailer name to store
      let store = storeMap.get(rp.retailerName);
      if (!store) {
        const storeInfo = mapChainName(rp.retailerName);
        if (storeInfo) {
          store = { id: storeInfo.id, name: storeInfo.name, nameGreek: storeInfo.nameGreek, chain: storeInfo.chain };
        } else {
          const created = createStoreFromName(rp.retailerName);
          store = { id: created.id, name: created.name, nameGreek: created.nameGreek, chain: created.chain };
          warnings.push(`Unknown chain "${rp.retailerName}" → "${created.id}"`);
        }
        storeMap.set(rp.retailerName, store);
      }

      prices.push({
        productId,
        storeId: store.id,
        price: rp.price,
        currency: 'EUR',
        lastUpdated: scrapeDate,
      });
    }
  }

  const stores = [...storeMap.values()];
  // Deduplicate by id
  const seenIds = new Set<string>();
  const uniqueStores = stores.filter(s => {
    if (seenIds.has(s.id)) return false;
    seenIds.add(s.id);
    return true;
  });

  return { stores: uniqueStores, products, prices, warnings };
}

function guessCategoryFromName(name: string): string {
  const lower = name.toLowerCase();
  const categoryPatterns: Array<[string[], string]> = [
    [['κοτόπ', 'κοτοπ', 'chicken', 'βοδιν', 'χοιριν', 'μοσχ', 'αρνί', 'κιμά', 'μπριζ', 'σουβλ', 'μπιφτ'], 'Meat'],
    [['γάλα', 'γαλα', 'γιαούρτ', 'φέτα', 'τυρί', 'τυρι', 'βούτυρ', 'κρέμα', 'noynoy', 'νουνου'], 'Dairy'],
    [['ψωμί', 'ψωμι', 'αρτ', 'bread'], 'Bakery'],
    [['σολομ', 'σαρδ', 'τόνο', 'ψάρι', 'fish', 'γαρίδ'], 'Fish'],
    [['μήλα', 'μπανάν', 'πορτοκ', 'λεμόν', 'αχλάδ', 'σταφ', 'φράουλ'], 'Fruits'],
    [['ντομάτ', 'πατάτ', 'κρεμμύδ', 'αγγούρ', 'μαρούλ', 'καρότ', 'πιπερ', 'μελιτζ'], 'Vegetables'],
    [['νερό', 'νερο', 'χυμό', 'χυμο', 'καφέ', 'καφε', 'coca', 'pepsi', 'μπύρα', 'μπίρα'], 'Beverages'],
    [['ρύζι', 'ρυζι', 'μακαρόν', 'μακαρον', 'ζυμαρ', 'ελαιόλ', 'λάδι', 'αλεύρ', 'αλευρ', 'ζάχαρ'], 'Staples'],
    [['σαπούν', 'απορρυπ', 'χαρτί', 'χαρτι', 'καθαρ', 'πλυντ'], 'Cleaning'],
    [['σοκολ', 'πατατάκ', 'μπισκότ', 'κρουασ', 'γκοφρ', 'τσιπς', 'chips'], 'Snacks'],
    [['κατεψ', 'frozen', 'κτψ'], 'Frozen'],
  ];

  for (const [keywords, category] of categoryPatterns) {
    if (keywords.some(k => lower.includes(k))) return category;
  }
  return 'General';
}
