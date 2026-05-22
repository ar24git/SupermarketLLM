import { Product, PriceEntry, Store } from '../types';
import { products, stores, prices, getStoreById } from '../data/superMarkets';

export interface SortedPrice {
  store: Store;
  price: number;
  currency: string;
  lastUpdated: string;
}

export interface ProductFacts {
  product: Product;
  sortedPrices: SortedPrice[]; // cheapest first
  cheapest: SortedPrice | null;
  priciest: SortedPrice | null;
  avg: number | null;
  storeCount: number;
}

// ---------- Build indexes once at module load ----------

// productId -> PriceEntry[] (sorted ascending by price)
const pricesByProductId = new Map<string, PriceEntry[]>();
for (const entry of prices) {
  const list = pricesByProductId.get(entry.productId) ?? [];
  list.push(entry);
  pricesByProductId.set(entry.productId, list);
}
for (const list of pricesByProductId.values()) {
  list.sort((a, b) => a.price - b.price);
}

// productId -> precomputed facts (cheapest, avg, etc.)
const factsByProductId = new Map<string, ProductFacts>();
for (const product of products) {
  const entries = pricesByProductId.get(product.id) ?? [];
  const sortedPrices: SortedPrice[] = entries
    .map((e) => {
      const store = getStoreById(e.storeId);
      if (!store) return null;
      return {
        store,
        price: e.price,
        currency: e.currency,
        lastUpdated: e.lastUpdated,
      } as SortedPrice;
    })
    .filter((p): p is SortedPrice => p !== null);

  const avg =
    sortedPrices.length > 0
      ? sortedPrices.reduce((sum, p) => sum + p.price, 0) / sortedPrices.length
      : null;

  factsByProductId.set(product.id, {
    product,
    sortedPrices,
    cheapest: sortedPrices[0] ?? null,
    priciest: sortedPrices[sortedPrices.length - 1] ?? null,
    avg,
    storeCount: sortedPrices.length,
  });
}

// Inverted index: keyword -> productIds
// Strips diacritics, lowercases, splits on non-letters, and indexes every
// token >= 3 chars from name, nameGreek, and category.
const tokenize = (text: string): string[] => {
  const normalized = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
  return normalized
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length >= 3);
};

const keywordIndex = new Map<string, Set<string>>();
for (const product of products) {
  const tokens = new Set<string>([
    ...tokenize(product.name),
    ...tokenize(product.nameGreek),
    ...tokenize(product.category),
  ]);
  for (const token of tokens) {
    const bucket = keywordIndex.get(token) ?? new Set<string>();
    bucket.add(product.id);
    keywordIndex.set(token, bucket);
  }
}

// ---------- Intent dictionary ----------
//
// Maps common consumer terms (in EN and EL, diacritic-stripped + lowercase) to
// a category filter so "cheapest milk" doesn't return "milk chocolate" or
// "milk-flavored cookies". The key is matched against tokenized user input.
//
// `exclude` filters out products whose names contain any of these substrings —
// useful for Greek where 'γαλα' (milk) appears in 'σοκολατα γαλακτος' too.
interface Intent {
  triggers: string[];          // tokens that trigger this intent
  category?: string;           // restrict to this product category
  include?: string[];          // product name MUST contain at least one of these substrings
  exclude?: string[];          // disallow products whose name contains any of these
}

// Common abbreviations to expand to their full forms when matching:
//   σοκ. -> σοκολατ   (chocolate)
//   γαλακ., γαλακτ. -> milk-flavored (used in non-milk products)
const DENY_NON_MILK = [
  'σοκολατ', 'σοκ.', 'σοκ ',           // chocolate (full + abbreviated)
  'μπισκοτ',                            // biscuit
  'γκοφρετ', 'wafer', 'cookie',         // wafer / cookie
  'chocolate',
  'τυρι', 'cheese',                     // cheese
  'κρεμα ', 'cream',                    // spreadable cream
  'τορτελιν', 'pasta',                  // pasta (mis-tagged)
  'γιαουρτ', 'yogurt',                  // yogurt
  'βουτυρ', 'butter',                   // butter
  'μπουκι', 'bites',                    // cereal bites
  'δημητριακ', 'cereal',                // cereals
  'φετα',                               // feta
  // Non-drinking milk forms — exclude from plain "milk" queries.
  'ζαχαρουχ',                           // sweetened condensed (γάλα ζαχαρούχο)
  'συμπυκν',                            // evaporated/condensed (συμπυκνωμένο)
  'σκον',                               // powdered milk (γάλα σε σκόνη)
  'condensed', 'evaporated', 'powdered',
];

const INTENTS: Intent[] = [
  {
    // Milk specifically. Source-data categories are inconsistent (some real
    // milk products are tagged "General" instead of "Dairy"), so we don't
    // restrict by category here — we rely on the include/exclude filters.
    //
    // include[] are name fragments that identify a product as milk. Most
    // products say 'γαλα' literally; brand lines (e.g. Δέλτα "Του Τόπου Μας"
    // ΕΛΑΦΡΥ/ΠΛΗΡΕΣ) don't, so we whitelist that brand pattern too.
    triggers: ['milk', 'γαλα', 'φρεσκο'],
    include: ['γαλα', 'του τοπου μας'],
    exclude: [
      ...DENY_NON_MILK,
      'ροφημα',      // non-milk plant drinks (Δέλτα ροφήμα αμύγδαλο/βρώμη)
      'αμυγδαλ',     // almond drink
      'βρωμη',       // oat drink
      'καρυδ',       // coconut
      'σογια', 'soy', // soy drink
      'ρυζι',        // rice drink
      'κακαο', 'cocoa', // cocoa-flavored milk drink — not plain milk
      'χυμ',         // juice (ΧΥΜΟΣ)
    ],
  },
  {
    triggers: ['dairy', 'γαλακτοκομικα', 'γαλακτοκομικο'],
    category: 'Dairy',
  },
  { triggers: ['cheese', 'τυρι', 'φετα'], category: 'Dairy', include: ['τυρι', 'φετα', 'cheese'] },
  { triggers: ['yogurt', 'γιαουρτι'], category: 'Dairy', include: ['γιαουρτ', 'yogurt'] },
  { triggers: ['butter', 'βουτυρο'], category: 'Dairy', include: ['βουτυρ', 'butter'] },
  { triggers: ['meat', 'κρεας'], category: 'Meat' },
  { triggers: ['chicken', 'κοτοπουλο', 'κοτοπ'], category: 'Meat', include: ['κοτοπ', 'chicken'] },
  { triggers: ['pork', 'χοιρινο'], category: 'Meat', include: ['χοιριν', 'pork'] },
  { triggers: ['beef', 'βοειο', 'μοσχαρι'], category: 'Meat', include: ['βοει', 'μοσχ', 'beef'] },
  { triggers: ['fish', 'ψαρι', 'ψαρια'], category: 'Fish' },
  { triggers: ['bread', 'ψωμι'], category: 'Bakery', include: ['ψωμι', 'bread'] },
  { triggers: ['vegetable', 'vegetables', 'λαχανικα'], category: 'Vegetables' },
  { triggers: ['fruit', 'fruits', 'φρουτα'], category: 'Fruits' },
  { triggers: ['water', 'νερο'], category: 'Beverages', include: ['νερο', 'water'] },
  { triggers: ['coffee', 'καφες'], category: 'Beverages', include: ['καφε', 'coffee'] },
  { triggers: ['drink', 'beverage', 'ποτο'], category: 'Beverages' },
  { triggers: ['cleaning', 'καθαριστικ'], category: 'Cleaning' },
  { triggers: ['frozen', 'κατεψυγμενα'], category: 'Frozen' },
  { triggers: ['snack', 'snacks', 'σνακ'], category: 'Snacks' },
];

function detectIntent(tokens: string[]): Intent | null {
  for (const intent of INTENTS) {
    for (const t of intent.triggers) {
      if (tokens.some((tok) => tok === t || tok.startsWith(t) || t.startsWith(tok))) {
        return intent;
      }
    }
  }
  return null;
}

// ---------- Public API ----------

export const allStores: Store[] = stores;

export function getFacts(productId: string): ProductFacts | undefined {
  return factsByProductId.get(productId);
}

/**
 * Search products by free-text query. Returns matches scored by how many
 * tokens overlap, then by number of available prices (so we prefer products
 * actually stocked across stores).
 *
 * When the query matches a known intent (e.g. "milk" -> Dairy), results are
 * pre-filtered by category and a deny-list, so we don't return "milk chocolate"
 * for a "cheapest milk" query.
 */
export function searchProducts(query: string, max = 20): ProductFacts[] {
  const tokens = tokenize(query);
  if (tokens.length === 0) return [];

  const intent = detectIntent(tokens);

  // Candidate pool — narrowed by intent category if present.
  const candidateIds = new Set<string>();
  if (intent?.category) {
    for (const product of products) {
      if (product.category === intent.category) candidateIds.add(product.id);
    }
  }

  const isCandidate = (id: string) =>
    candidateIds.size === 0 || candidateIds.has(id);

  const productHaystack = (id: string): string => {
    const product = factsByProductId.get(id)?.product;
    if (!product) return '';
    return `${product.name} ${product.nameGreek}`
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '');
  };

  const passesIncludeFilter = (id: string): boolean => {
    if (!intent?.include || intent.include.length === 0) return true;
    const hay = productHaystack(id);
    if (!hay) return false;
    return intent.include.some((needle) => hay.includes(needle));
  };

  const isExcluded = (id: string): boolean => {
    if (!intent?.exclude || intent.exclude.length === 0) return false;
    const hay = productHaystack(id);
    if (!hay) return true;
    return intent.exclude.some((bad) => hay.includes(bad));
  };

  const scores = new Map<string, number>();
  const bump = (id: string, delta: number) => {
    if (!isCandidate(id) || isExcluded(id) || !passesIncludeFilter(id)) return;
    scores.set(id, (scores.get(id) ?? 0) + delta);
  };

  for (const token of tokens) {
    const exact = keywordIndex.get(token);
    if (exact) {
      for (const id of exact) bump(id, 2);
    }
    // Substring fallback only when there's no useful exact match.
    // Prevents 'γαλα' from matching everything containing 'γαλακτ-'.
    if (token.length >= 5 && (!exact || exact.size === 0)) {
      for (const [key, ids] of keywordIndex) {
        if (key === token) continue;
        if (key.includes(token) || token.includes(key)) {
          for (const id of ids) bump(id, 1);
        }
      }
    }
  }

  // Intent-only fallback: if no tokens matched the keyword index (e.g. query
  // is in English while data is in Greek), use the intent's include/exclude
  // alone. Iterate either the category subset or all products if no category
  // was specified for this intent.
  if (scores.size === 0 && intent) {
    const pool: Iterable<string> =
      candidateIds.size > 0
        ? candidateIds
        : products.map((p) => p.id);
    for (const id of pool) {
      if (!isExcluded(id) && passesIncludeFilter(id)) scores.set(id, 1);
    }
  }

  return [...scores.entries()]
    .map(([id, score]) => {
      const facts = factsByProductId.get(id);
      if (!facts) return null;
      const coverageBoost = Math.min(facts.storeCount, 5) * 0.1;
      return { facts, score: score + coverageBoost };
    })
    .filter((r): r is { facts: ProductFacts; score: number } => r !== null)
    .sort((a, b) => b.score - a.score)
    .slice(0, max)
    .map((r) => r.facts);
}

/**
 * Compact TSV rows for one product — for LLM consumption.
 * Columns: product, unit, store, price_eur, rank
 * `rank` is 1 for cheapest, 2 for next, etc., so the model never has to sort.
 */
export function formatFactsTsv(facts: ProductFacts, language: 'en' | 'el'): string {
  const { product, sortedPrices } = facts;
  if (sortedPrices.length === 0) return '';
  const productName = language === 'el' ? product.nameGreek : product.name;
  const storeName = (s: Store) => (language === 'el' ? s.nameGreek : s.name);
  return sortedPrices
    .map(
      (p, i) =>
        `${productName}\t${product.unit}\t${storeName(p.store)}\t${p.price.toFixed(2)}\t${i + 1}`
    )
    .join('\n');
}

/**
 * Human-readable summary for one product — for the UI fallback path.
 */
export function formatFactsHuman(facts: ProductFacts, language: 'en' | 'el'): string {
  const { product, cheapest, priciest, avg, sortedPrices } = facts;
  if (!cheapest) {
    return language === 'el'
      ? `${product.nameGreek}: δεν υπάρχουν διαθέσιμες τιμές.`
      : `${product.name}: no price data available.`;
  }

  const name = language === 'el' ? product.nameGreek : product.name;
  const storeName = (s: Store) => (language === 'el' ? s.nameGreek : s.name);

  const lines: string[] = [];
  lines.push(`${name} [${product.unit}]`);
  lines.push(
    language === 'el'
      ? `  Φθηνότερο: €${cheapest.price.toFixed(2)} @ ${storeName(cheapest.store)}`
      : `  Cheapest: €${cheapest.price.toFixed(2)} @ ${storeName(cheapest.store)}`
  );
  if (priciest && priciest.price !== cheapest.price) {
    lines.push(
      language === 'el'
        ? `  Ακριβότερο: €${priciest.price.toFixed(2)} @ ${storeName(priciest.store)}`
        : `  Most expensive: €${priciest.price.toFixed(2)} @ ${storeName(priciest.store)}`
    );
  }
  if (avg !== null && sortedPrices.length > 1) {
    lines.push(
      language === 'el'
        ? `  Μέσος όρος: €${avg.toFixed(2)} (${sortedPrices.length} καταστήματα)`
        : `  Avg: €${avg.toFixed(2)} (${sortedPrices.length} stores)`
    );
  }
  lines.push(language === 'el' ? '  Όλες οι τιμές:' : '  All prices:');
  for (const p of sortedPrices) {
    lines.push(`    - ${storeName(p.store)}: €${p.price.toFixed(2)}`);
  }
  return lines.join('\n');
}

/**
 * Build a focused facts block for a free-text user query.
 *   format='cheapest' -> one row per product, only the cheapest store (LLM-safe)
 *   format='tsv'      -> all per-store prices in TSV (LLM input, verbose)
 *   format='human'    -> readable multi-line summary (fallback UI)
 * Returns an empty string if nothing relevant was found.
 */
export function buildFactsBlock(
  query: string,
  language: 'en' | 'el',
  maxProducts = 8,
  format: 'cheapest' | 'tsv' | 'human' = 'cheapest'
): string {
  const matches = searchProducts(query, maxProducts);
  if (matches.length === 0) return '';

  if (format === 'cheapest') {
    const header = 'product\tunit\tcheapest_store\tprice_eur\tstore_count';
    const rows = matches
      .filter((m) => m.cheapest !== null)
      .map((m) => {
        const productName = language === 'el' ? m.product.nameGreek : m.product.name;
        const storeName =
          language === 'el' ? m.cheapest!.store.nameGreek : m.cheapest!.store.name;
        return `${productName}\t${m.product.unit}\t${storeName}\t${m.cheapest!.price.toFixed(2)}\t${m.storeCount}`;
      });
    return [header, ...rows].join('\n');
  }

  if (format === 'tsv') {
    const header = 'product\tunit\tstore\tprice_eur\trank';
    const rows = matches
      .map((m) => formatFactsTsv(m, language))
      .filter((s) => s.length > 0);
    return [header, ...rows].join('\n');
  }

  const header =
    language === 'el'
      ? `Σχετικά προϊόντα (${matches.length}), ταξινομημένα από τη φθηνότερη τιμή:`
      : `Relevant products (${matches.length}), sorted cheapest-first:`;

  return [header, ...matches.map((m) => formatFactsHuman(m, language))].join('\n\n');
}
