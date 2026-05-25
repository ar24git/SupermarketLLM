import { Product, PriceEntry, Store } from '../types';
import { stores, prices, getStoreById, products as rawProducts } from '../data/superMarkets';
import enrichedDataJson from '../data/products-enriched.json';

// ============================================================================
// Enriched product type — the LLM-classified shape we get from
// scripts/enrich.
// ============================================================================

export interface EnrichedProduct {
  id: string;
  name: string;
  nameGreek: string;
  unit: string;
  sourceCategory: string;
  productType: string;          // 'milk', 'cheese', 'chicken', ... or 'unknown'
  subtype: string | null;       // 'fresh', 'condensed', ...
  brand: string | null;
  variant: string | null;       // 'light', 'organic', ...
  sizeMl: number | null;
  sizeG: number | null;
  packCount: number | null;
  categoryClean: string;        // 'Dairy/Milk', 'Meat/Chicken', ...
  isFood: boolean;
  confidence: number;
}

interface EnrichedDataFile {
  products: EnrichedProduct[];
}

// ============================================================================
// Public types
// ============================================================================

export interface SortedPrice {
  store: Store;
  price: number;
  currency: string;
  lastUpdated: string;
}

export interface ProductFacts {
  product: Product;
  enriched: EnrichedProduct | null;
  sortedPrices: SortedPrice[]; // cheapest first
  cheapest: SortedPrice | null;
  priciest: SortedPrice | null;
  avg: number | null;
  storeCount: number;
}

// ============================================================================
// Normalization
// ============================================================================

// Plural -> singular variants we collapse so 'snack' and 'snacks' look the same.
// Add here as we discover model inconsistencies.
const TYPE_ALIASES: Record<string, string> = {
  snacks: 'snack',
  biscuits: 'biscuit',
  cookies: 'biscuit',
  cookie: 'biscuit',
  chips: 'snack',
  beverages: 'drink',
  beverage: 'drink',
  juices: 'juice',
  yoghurt: 'yogurt',
  yogurts: 'yogurt',
  cheeses: 'cheese',
  oils: 'oil',
  pastas: 'pasta',
  fishes: 'fish',
  meats: 'meat',
};

function normType(t: string | null | undefined): string {
  if (!t) return '';
  const lower = String(t).toLowerCase().trim();
  return TYPE_ALIASES[lower] ?? lower;
}

function stripDiacritics(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
}

// Per-productType safety net: even if the enricher labels something as e.g.
// productType="milk", we additionally require the product's name (diacritic-
// stripped, lowercased) to contain at least ONE of these substrings. This
// catches obvious mis-classifications (shower foam tagged as milk, fish sauce
// tagged as milk, etc.) without re-running enrichment.
//
// ProductTypes without an entry here are passed through unchanged — we don't
// want to silently narrow the long tail of less-common categories.
const TYPE_NAME_REQUIREMENTS: Record<string, string[]> = {
  milk: ['γαλα', 'γαλακτ', 'milk', 'του τοπου μας'],
  cheese: ['τυρι', 'φετα', 'cheese', 'gouda', 'edam', 'graviera', 'parmigiano', 'mozzarella', 'philadelphia', 'κασερι', 'μυζηθρ'],
  yogurt: ['γιαουρτ', 'yogurt', 'yoghurt'],
  butter: ['βουτυρ', 'butter'],
  cream: ['κρεμα', 'cream'],
  chocolate: ['σοκολατ', 'chocolate', 'lacta', 'ion', 'nestle', 'merenda', 'kit kat', 'kitkat', 'mars', 'snickers', 'twix', 'bounty', 'milka'],
  biscuit: ['μπισκοτ', 'biscuit', 'cookie', 'παπαδοπουλου', 'oreo', 'cracker', 'κρακερ', 'γκοφρετ', 'wafer'],
  coffee: ['καφε', 'coffee', 'nescafe', 'loumidis', 'λουμιδης', 'jacobs', 'douwe', 'espresso'],
  tea: ['τσαι', 'tea', 'lipton'],
  water: ['νερο', 'water', 'zaros', 'κορπη', 'βικος', 'εψα', 'σαριζα', 'αυρα'],
  juice: ['χυμ', 'juice', 'amita', 'life'],
  soda: ['αναψ', 'soda', 'cola', 'sprite', 'fanta', 'pepsi', '7up'],
  beer: ['μπυρα', 'beer', 'heineken', 'amstel', 'mythos', 'fix'],
  wine: ['κρασι', 'wine', 'οινος'],
  oil: ['ελαιο', 'ελαιολαδ', 'oil', 'ελιας'],
  vinegar: ['ξυδι', 'vinegar'],
  bread: ['ψωμι', 'bread', 'φραντζολ'],
  rusk: ['παξιμαδ', 'rusk', 'φρυγανιες'],
  pasta: ['μακαρον', 'pasta', 'spaghett', 'σπαγγετ', 'pene', 'πεννε', 'φιδες', 'ζυμαρικ', 'misko', 'barilla'],
  rice: ['ρυζι', 'rice', 'basmati'],
  flour: ['αλευρ', 'flour'],
  sugar: ['ζαχαρ', 'sugar'],
  salt: ['αλατι', 'salt'],
  honey: ['μελι', 'honey'],
  egg: ['αυγο', 'αυγα', 'egg'],
  chicken: ['κοτοπ', 'chicken', 'πετμεζ'],
  pork: ['χοιριν', 'pork', 'μπριζολ'],
  beef: ['βοει', 'μοσχ', 'beef', 'veal'],
  lamb: ['αρνι', 'lamb'],
  turkey: ['γαλοπουλ', 'turkey'],
  fish: ['ψαρι', 'fish', 'τονος', 'σαρδελ', 'σολομ', 'γαυρ', 'μπακαλιαρ'],
  shrimp: ['γαριδ', 'shrimp', 'prawn'],
  cereal: ['δημητριακ', 'cereal', 'corn flakes', 'cornflakes', 'kellogg', 'quaker'],
  snack: ['σνακ', 'chip', 'τσιπς', 'pretzel', 'pringles', 'lays', 'tasty'],
  soap: ['σαπουν', 'soap', 'αφρολουτρ', 'αφρ.', 'shower'],
  shampoo: ['σαμπουαν', 'shampoo', 'pantene', 'head & shoulders'],
  detergent: ['απορρυπαντικ', 'detergent', 'fairy', 'ariel', 'skip', 'tide', 'dixan'],
  plant_drink: ['ροφημα', 'plant', 'αμυγδαλ', 'soy', 'σογια', 'βρωμη', 'oat', 'καρυδ'],
  fish_sauce: ['γαρος', 'αλμη'],
};

function passesTypeNameRequirement(productType: string, nameHaystack: string): boolean {
  const required = TYPE_NAME_REQUIREMENTS[productType];
  if (!required || required.length === 0) return true; // no rule = pass through
  return required.some((needle) => nameHaystack.includes(needle));
}

// Common filler words that pollute keyword search if left in.
// 'me' / 'με' is the worst offender — it's the Greek word for "with" and
// appears in literally thousands of product names ("X ΜΕ Y").
const STOPWORDS = new Set<string>([
  // English question/intent words
  'me', 'my', 'the', 'a', 'an', 'is', 'are', 'do', 'show', 'tell', 'give',
  'want', 'need', 'find', 'list', 'cheap', 'cheaper', 'cheapest', 'price',
  'prices', 'all', 'any', 'some', 'please', 'thanks', 'thank', 'you', 'your',
  'what', 'where', 'when', 'how', 'which', 'who', 'why', 'for', 'with', 'and',
  'or', 'of', 'to', 'in', 'on', 'at', 'as',
  // English size / quality / state adjectives — usually meaningless for matching
  'large', 'big', 'small', 'medium', 'mini', 'mega', 'jumbo', 'thick', 'thin',
  'fresh', 'dried', 'frozen', 'raw', 'cooked', 'whole', 'sliced', 'chopped',
  'minced', 'grated', 'ground', 'crushed', 'lean', 'fat', 'low', 'extra',
  'ripe', 'organic', 'classic', 'plain', 'optional', 'garnish', 'recommended',
  'pinch', 'dash', 'about', 'approximately', 'preferred', 'mix',
  // English quantity units (already stripped in preprocessing but defense in depth)
  'lb', 'oz', 'kg', 'ml', 'tsp', 'tbsp', 'cup', 'cups', 'stick', 'sticks',
  'can', 'cans', 'pack', 'piece', 'pieces',
  // Greek question/intent (diacritic-stripped)
  'με', 'και', 'σε', 'ο', 'η', 'το', 'οι', 'τα', 'του', 'της', 'των',
  'στο', 'στη', 'στην', 'στον', 'στους', 'στις', 'για', 'απο', 'ως',
  'φθηνο', 'φθηνος', 'φθηνα', 'τιμη', 'τιμες',
  'δειξε', 'δειχ', 'θελω', 'εχω', 'εχει', 'ποιο', 'ποιος', 'ποια',
  'ολα', 'ολους', 'ολες',
  // Greek size / state adjectives
  'μεγαλο', 'μικρο', 'μετριο', 'πληρες', 'ελαφρυ', 'φρεσκο', 'παγωμενο',
]);

function tokenize(text: string): string[] {
  return stripDiacritics(text)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length >= 2 && !STOPWORDS.has(t));
}

// ============================================================================
// Build indexes once at module load
// ============================================================================

const enrichedData = enrichedDataJson as EnrichedDataFile;
const enrichedById = new Map<string, EnrichedProduct>();
for (const e of enrichedData.products) {
  enrichedById.set(e.id, {
    ...e,
    productType: normType(e.productType),
  });
}

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

// productId -> ProductFacts
const factsByProductId = new Map<string, ProductFacts>();
for (const product of rawProducts) {
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
    enriched: enrichedById.get(product.id) ?? null,
    sortedPrices,
    cheapest: sortedPrices[0] ?? null,
    priciest: sortedPrices[sortedPrices.length - 1] ?? null,
    avg,
    storeCount: sortedPrices.length,
  });
}

// productType -> productIds
const idsByType = new Map<string, Set<string>>();
// category prefix (top-level, e.g. 'Dairy') -> productIds
const idsByCategoryTop = new Map<string, Set<string>>();
// full categoryClean -> productIds
const idsByCategoryFull = new Map<string, Set<string>>();
// brand (normalized) -> productIds
const idsByBrand = new Map<string, Set<string>>();
// keyword token -> productIds (covers name + brand + type)
const idsByToken = new Map<string, Set<string>>();

const ensure = <K, V>(map: Map<K, Set<V>>, key: K, value: V) => {
  const bucket = map.get(key) ?? new Set<V>();
  bucket.add(value);
  map.set(key, bucket);
};

for (const facts of factsByProductId.values()) {
  const id = facts.product.id;
  const enr = facts.enriched;

  if (enr?.productType && enr.productType !== 'unknown') {
    ensure(idsByType, enr.productType, id);
  }

  if (enr?.categoryClean && enr.categoryClean !== 'Unknown/Unknown') {
    const full = enr.categoryClean;
    ensure(idsByCategoryFull, full, id);
    const top = full.split('/')[0];
    if (top) ensure(idsByCategoryTop, top, id);
  }

  if (enr?.brand) {
    ensure(idsByBrand, stripDiacritics(enr.brand), id);
  }

  // Build keyword index across all useful text
  const text = [
    facts.product.name,
    facts.product.nameGreek,
    enr?.brand ?? '',
    enr?.productType ?? '',
    enr?.subtype ?? '',
    enr?.variant ?? '',
    enr?.categoryClean ?? '',
  ].join(' ');
  for (const tok of new Set(tokenize(text))) {
    ensure(idsByToken, tok, id);
  }
}

// ============================================================================
// Lightweight intent → productType map for natural-language queries.
//
// This is much smaller than the previous INTENTS dictionary because the
// classifier handles the hard work. We just translate user phrasing in EN/EL
// to the canonical productType emitted by the classifier.
// ============================================================================

const PHRASE_TO_TYPE: Record<string, string> = {
  // English — dairy
  milk: 'milk', cheese: 'cheese', cheeses: 'cheese',
  feta: 'cheese', parmesan: 'cheese', kefalotyri: 'cheese', pecorino: 'cheese',
  mozzarella: 'cheese', kasseri: 'cheese', graviera: 'cheese',
  yogurt: 'yogurt', yoghurt: 'yogurt',
  butter: 'butter', cream: 'cream', egg: 'egg', eggs: 'egg',
  // English — meat / fish
  chicken: 'chicken', pork: 'pork', beef: 'beef', veal: 'beef', lamb: 'lamb',
  turkey: 'turkey', fish: 'fish', shrimp: 'shrimp', prawn: 'shrimp',
  // English — staples
  bread: 'bread', pasta: 'pasta', spaghetti: 'pasta', penne: 'pasta',
  bucatini: 'pasta', macaroni: 'pasta', noodles: 'pasta',
  rice: 'rice', flour: 'flour',
  oil: 'oil', olive: 'oil',
  vinegar: 'vinegar', sugar: 'sugar', salt: 'salt', honey: 'honey',
  // English — drinks
  water: 'water', juice: 'juice', soda: 'soda', coffee: 'coffee', tea: 'tea',
  beer: 'beer', wine: 'wine',
  // English — sweets / snacks
  chocolate: 'chocolate', biscuit: 'biscuit', biscuits: 'biscuit',
  cookie: 'biscuit', cookies: 'biscuit', snack: 'snack', snacks: 'snack',
  cereal: 'cereal', cereals: 'cereal',
  // English — household
  soap: 'soap', detergent: 'detergent', shampoo: 'shampoo',
  // English — vegetables / fruit / pantry
  eggplant: 'eggplant', eggplants: 'eggplant', aubergine: 'eggplant',
  onion: 'onion', onions: 'onion',
  garlic: 'garlic',
  tomato: 'tomato', tomatoes: 'tomato',
  potato: 'potato', potatoes: 'potato',
  lemon: 'lemon', lemons: 'lemon',
  apple: 'apple', apples: 'apple', banana: 'banana', bananas: 'banana',
  cucumber: 'cucumber',
  carrot: 'carrot', carrots: 'carrot',
  pepper: 'pepper', peppers: 'pepper',
  spinach: 'spinach',
  mushroom: 'mushroom', mushrooms: 'mushroom',

  // Greek (diacritic-stripped lowercase) — dairy
  γαλα: 'milk', τυρι: 'cheese', φετα: 'cheese', γιαουρτι: 'yogurt',
  βουτυρο: 'butter', κρεμα: 'cream', αυγο: 'egg', αυγα: 'egg',
  // Greek — meat / fish
  κοτοπουλο: 'chicken', χοιρινο: 'pork', βοδινο: 'beef', μοσχαρι: 'beef',
  αρνι: 'lamb', γαλοπουλα: 'turkey', ψαρι: 'fish', γαριδα: 'shrimp',
  // Greek — staples
  ψωμι: 'bread', ζυμαρικα: 'pasta', μακαρονι: 'pasta', σπαγγετο: 'pasta',
  ρυζι: 'rice', αλευρι: 'flour',
  λαδι: 'oil', ελαιολαδο: 'oil', ξυδι: 'vinegar', ζαχαρη: 'sugar',
  αλατι: 'salt', μελι: 'honey',
  // Greek — drinks
  νερο: 'water', χυμος: 'juice', καφες: 'coffee', τσαι: 'tea',
  μπυρα: 'beer', κρασι: 'wine',
  // Greek — sweets / snacks
  σοκολατα: 'chocolate', μπισκοτο: 'biscuit', σνακ: 'snack',
  δημητριακα: 'cereal',
  // Greek — household
  σαπουνι: 'soap', απορρυπαντικο: 'detergent', σαμπουαν: 'shampoo',
  // Greek — vegetables / fruit
  μελιτζανα: 'eggplant', μελιτζανες: 'eggplant',
  κρεμμυδι: 'onion', κρεμμυδια: 'onion',
  σκορδο: 'garlic',
  ντοματα: 'tomato', ντοματες: 'tomato',
  πατατα: 'potato', πατατες: 'potato',
  λεμονι: 'lemon', λεμονια: 'lemon',
  μηλο: 'apple', μηλα: 'apple', μπανανα: 'banana', μπανανες: 'banana',
  αγγουρι: 'cucumber',
  καροτο: 'carrot', καροτα: 'carrot',
  πιπερι: 'pepper', πιπερια: 'pepper', πιπεριες: 'pepper',
  σπανακι: 'spinach',
  μανιταρι: 'mushroom', μανιταρια: 'mushroom',
};

// Top-level category aliases ("dairy" -> "Dairy", "γαλακτοκομικα" -> "Dairy")
const PHRASE_TO_CATEGORY_TOP: Record<string, string> = {
  dairy: 'Dairy', γαλακτοκομικα: 'Dairy',
  meat: 'Meat', κρεας: 'Meat', κρεατα: 'Meat',
  fish: 'Meat',          // most fish products are under Meat in our taxonomy
  bakery: 'Bakery', αρτοποιιο: 'Bakery',
  beverage: 'Beverages', beverages: 'Beverages', ποτα: 'Beverages',
  snacks: 'Snacks',
  household: 'Household', cleaning: 'Household', καθαριστικα: 'Household',
  fruits: 'Fruits', φρουτα: 'Fruits',
  vegetables: 'Vegetables', λαχανικα: 'Vegetables',
  frozen: 'Frozen', κατεψυγμενα: 'Frozen',
};

interface ResolvedIntent {
  productTypes: Set<string>;
  categoriesTop: Set<string>;
  freeTextTokens: string[];
}

function resolveIntent(query: string): ResolvedIntent {
  const tokens = tokenize(query);
  const productTypes = new Set<string>();
  const categoriesTop = new Set<string>();
  const freeTextTokens: string[] = [];

  for (const tok of tokens) {
    const type = PHRASE_TO_TYPE[tok];
    if (type) {
      productTypes.add(type);
      continue;
    }
    const catTop = PHRASE_TO_CATEGORY_TOP[tok];
    if (catTop) {
      categoriesTop.add(catTop);
      continue;
    }
    freeTextTokens.push(tok);
  }
  return { productTypes, categoriesTop, freeTextTokens };
}

// ============================================================================
// Basket comparison
// ============================================================================

export interface BasketLine {
  product: Product;
  quantity: number;
  /** null if the chain doesn't stock this product. */
  unitPrice: number | null;
  /** unitPrice * quantity, or 0 if not stocked. */
  lineTotal: number;
}

export interface ChainBasket {
  store: Store;
  /** Sum of unitPrice * quantity for items this chain stocks. */
  total: number;
  /** Number of distinct basket lines this chain stocks (irrespective of qty). */
  itemsAvailable: number;
  /** Number of distinct basket lines this chain does NOT stock. */
  itemsMissing: number;
  /** Per-line breakdown in the same order as the input. */
  lines: BasketLine[];
}

/**
 * Map of productId -> quantity (>=1). Used as the canonical basket shape.
 */
export type BasketEntries = Map<string, number>;

/**
 * Compare a basket across all chains. Returns chains sorted by:
 *   1. Items available (more is better) — covers the "missing item" trade-off
 *   2. Total price (cheaper wins)
 *
 * Each line is multiplied by its quantity. Items the chain doesn't stock
 * contribute 0 to total and increment itemsMissing.
 */
export function compareBasketByChain(
  basket: BasketEntries | string[]
): ChainBasket[] {
  // Accept legacy string[] for backward compatibility — treat each id as qty=1.
  const entries: BasketEntries =
    basket instanceof Map
      ? basket
      : new Map(basket.map((id) => [id, 1] as [string, number]));
  if (entries.size === 0) return [];

  const result: ChainBasket[] = [];

  for (const store of stores) {
    const lines: BasketLine[] = [];
    let total = 0;
    let itemsAvailable = 0;

    for (const [id, qtyRaw] of entries) {
      const facts = factsByProductId.get(id);
      if (!facts) continue;
      const quantity = Math.max(1, Math.floor(qtyRaw || 1));
      const match = facts.sortedPrices.find((sp) => sp.store.id === store.id);
      if (match) {
        const lineTotal = match.price * quantity;
        lines.push({
          product: facts.product,
          quantity,
          unitPrice: match.price,
          lineTotal,
        });
        total += lineTotal;
        itemsAvailable += 1;
      } else {
        lines.push({
          product: facts.product,
          quantity,
          unitPrice: null,
          lineTotal: 0,
        });
      }
    }

    if (itemsAvailable === 0) continue;

    result.push({
      store,
      total,
      itemsAvailable,
      itemsMissing: lines.length - itemsAvailable,
      lines,
    });
  }

  result.sort((a, b) => {
    if (a.itemsAvailable !== b.itemsAvailable) {
      return b.itemsAvailable - a.itemsAvailable;
    }
    return a.total - b.total;
  });

  return result;
}

// ============================================================================
// Public API
// ============================================================================

export const allStores: Store[] = stores;

export function getFacts(productId: string): ProductFacts | undefined {
  return factsByProductId.get(productId);
}

/**
 * True iff the user's query (after tokenization) hits a known productType
 * or category phrase. Used by the chat UI to decide whether a search result
 * is trustworthy "by intent" or whether a stricter lexical-overlap check
 * needs to be applied on top.
 */
export function queryHasIntent(query: string): boolean {
  const tokens = tokenize(query);
  for (const tok of tokens) {
    if (PHRASE_TO_TYPE[tok] || PHRASE_TO_CATEGORY_TOP[tok]) return true;
  }
  return false;
}

/**
 * Resolve a free-text query to a ranked list of matching products.
 *
 * Order of preference:
 *   1. If the query maps to a known productType (e.g. 'milk'), return all
 *      products of that type — sorted by store coverage then by cheapest price.
 *   2. Else if the query maps to a category (e.g. 'dairy'), return all products
 *      in that category.
 *   3. Else fall back to keyword search on the inverted index.
 */
export function searchProducts(query: string, max = 20): ProductFacts[] {
  const intent = resolveIntent(query);

  let candidateIds: Set<string> | null = null;

  if (intent.productTypes.size > 0) {
    candidateIds = new Set<string>();
    for (const type of intent.productTypes) {
      const bucket = idsByType.get(type);
      if (!bucket) continue;
      for (const id of bucket) {
        // Defense-in-depth: even if the enricher tagged this product with the
        // requested type, require the product's name to actually contain a
        // type-specific keyword. Skips enricher false-positives like shower
        // foam tagged as milk.
        const facts = factsByProductId.get(id);
        if (!facts) continue;
        const haystack = stripDiacritics(
          `${facts.product.name} ${facts.product.nameGreek}`
        );
        if (passesTypeNameRequirement(type, haystack)) {
          candidateIds.add(id);
        }
      }
    }
  } else if (intent.categoriesTop.size > 0) {
    candidateIds = new Set<string>();
    for (const cat of intent.categoriesTop) {
      const bucket = idsByCategoryTop.get(cat);
      if (bucket) for (const id of bucket) candidateIds.add(id);
    }
  }

  // Score: count of free-text tokens that match in the product's keyword set,
  // plus a coverage bonus for products stocked at many stores.
  const scoreOf = (id: string): number => {
    const facts = factsByProductId.get(id);
    if (!facts) return -1;
    let score = 1;
    if (intent.freeTextTokens.length > 0) {
      for (const tok of intent.freeTextTokens) {
        const bucket = idsByToken.get(tok);
        if (bucket && bucket.has(id)) score += 2;
      }
    }
    score += Math.min(facts.storeCount, 5) * 0.1;
    return score;
  };

  // If we have a candidate set from intent, score within it.
  if (candidateIds && candidateIds.size > 0) {
    return [...candidateIds]
      .map((id) => ({ id, score: scoreOf(id) }))
      .filter((r) => r.score >= 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, max)
      .map((r) => factsByProductId.get(r.id)!)
      .filter(Boolean);
  }

  // The user intended a specific productType/category but we have nothing for
  // it (e.g. asked for shampoo but data has no shampoos yet). Return empty
  // rather than falling through to keyword search — keyword fallback would
  // surface random products that share unrelated tokens.
  if (intent.productTypes.size > 0 || intent.categoriesTop.size > 0) {
    return [];
  }

  // Pure keyword fallback for unrecognised queries.
  const tokenScores = new Map<string, number>();
  for (const tok of intent.freeTextTokens) {
    const bucket = idsByToken.get(tok);
    if (!bucket) continue;
    for (const id of bucket) tokenScores.set(id, (tokenScores.get(id) ?? 0) + 2);
  }
  if (tokenScores.size === 0) return [];

  return [...tokenScores.entries()]
    .map(([id, base]) => {
      const facts = factsByProductId.get(id);
      if (!facts) return null;
      return { facts, score: base + Math.min(facts.storeCount, 5) * 0.1 };
    })
    .filter((r): r is { facts: ProductFacts; score: number } => r !== null)
    .sort((a, b) => b.score - a.score)
    .slice(0, max)
    .map((r) => r.facts);
}

/**
 * List all products in a top-level category (e.g. 'Dairy', 'Meat').
 */
export function listByCategoryTop(categoryTop: string, max = 50): ProductFacts[] {
  const ids = idsByCategoryTop.get(categoryTop);
  if (!ids) return [];
  return [...ids]
    .map((id) => factsByProductId.get(id)!)
    .filter((f) => f && f.cheapest)
    .sort((a, b) => (a.cheapest!.price - b.cheapest!.price))
    .slice(0, max);
}

/**
 * List all known productTypes (for autocomplete, debugging).
 */
export function listProductTypes(): { type: string; count: number }[] {
  return [...idsByType.entries()]
    .map(([type, ids]) => ({ type, count: ids.size }))
    .sort((a, b) => b.count - a.count);
}

/**
 * List top-level categories (first segment of categoryClean, e.g. 'Dairy')
 * with product counts, sorted by count desc. Used by the "Create Basket"
 * category picker.
 */
export function listTopCategories(): { name: string; count: number }[] {
  return [...idsByCategoryTop.entries()]
    .map(([name, ids]) => ({ name, count: ids.size }))
    .filter((c) => c.count > 0)
    .sort((a, b) => b.count - a.count);
}

/**
 * Group a list of ProductFacts by their enriched productType. Used to render
 * sub-sections under a top category. Products with no productType land in
 * the empty-key bucket and the caller can decide to skip them.
 */
export function groupByProductType(
  facts: ProductFacts[]
): Map<string, ProductFacts[]> {
  const grouped = new Map<string, ProductFacts[]>();
  for (const f of facts) {
    const type = f.enriched?.productType ?? '';
    const bucket = grouped.get(type) ?? [];
    bucket.push(f);
    grouped.set(type, bucket);
  }
  return grouped;
}

// ============================================================================
// Formatters
// ============================================================================

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
 * Build a focused facts block for a free-text query.
 *   format='cheapest' -> one row per product, cheapest store only (LLM-friendly)
 *   format='tsv'      -> all per-store prices in TSV (LLM input, verbose)
 *   format='human'    -> readable multi-line summary (fallback UI)
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
