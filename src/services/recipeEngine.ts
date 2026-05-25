import { Product, PriceEntry, Store } from '../types';
import { stores, getStoreById, products as rawProducts } from '../data/superMarkets';

// ============================================================================
// Recipe Types
// ============================================================================

export interface RecipeIngredient {
  name: string;
  quantity: number;
  unit: string;
  productFacts?: any;
  bestStore?: Store;
  bestPrice?: number;
  stores: { store: Store; price: number }[];
}

export interface Recipe {
  id: string;
  name: string;
  ingredients: RecipeIngredient[];
  totalCostByStore: {
    storeId: string;
    storeName: string;
    storeNameGreek: string;
    total: number;
    itemsAvailable: number;
    itemsMissing: number;
  }[];
  totalCostAcrossStores: number;
  estimatedPriceRange: { min: number; max: number };
  createdAt: string;
}

// ============================================================================
// Greek to English ingredient mapping
// ============================================================================

const GREEK_TO_ENGLISH_INGREDIENTS: Record<string, string> = {
  'νερό': 'water',
  'καθαρό νερό': 'water',
  'λάδι': 'oil',
  'ελαιόλαδο': 'olive oil',
  'αλάτι': 'salt',
  'ζάχαρη': 'sugar',
  'κρέας': 'meat',
  'κότοπουλο': 'chicken',
  'μοσχαρίσιο': 'beef',
  'χοιρινό': 'pork',
  'ψάρι': 'fish',
  'γάλα': 'milk',
  'γιαούρτι': 'yogurt',
  'τυρί': 'cheese',
  'βούτυρο': 'butter',
  'αυγά': 'eggs',
  'αυγό': 'egg',
  'ρύζι': 'rice',
  'μακαρόνι': 'pasta',
  'σπαγγέτι': 'spaghetti',
  'φλούδα': 'flour',
  'ζυμαρικά': 'pasta',
  'ψωμί': 'bread',
  'παξιμάδι': 'rusk',
  'κρουαζάν': 'croissant',
  'κρασί': 'wine',
  'μπύρα': 'beer',
  'καφές': 'coffee',
  'τσάι': 'tea',
  'σοκολάτα': 'chocolate',
  'μπισκότα': 'biscuits',
  'σνακ': 'snack',
  'πατάτες': 'potatoes',
  'ντομάτες': 'tomatoes',
  'κρεμμύδια': 'onions',
  'αγγούρια': 'cucumbers',
  'σαλάτα': 'lettuce',
  'σπανάκι': 'spinach',
  'μπροκόλι': 'broccoli',
  'καρότα': 'carrots',
  'καρφίτσα': 'carrot',
  'κολοκύθια': 'zucchini',
  'καλαμπόκι': 'corn',
  'φασολιά': 'beans',
  'κερατοσπανάκι': 'peas',
  'πιπεριές': 'peppers',
  'σούπα': 'stock',
  'ζωμός': 'stock',
  'κρέμα': 'cream',
  'σούτσα': 'sauce',
  'κετσαπ': 'ketchup',
  'μαγιονέζα': 'mayonnaise',
  'μουστάρδα': 'mustard',
  'μελί': 'honey',
  'ακετάλ': 'vinegar',
  'βαλσαμικό': 'balsamic',
  'τοματοπολτός': 'tomato puree',
  'τριμμένες ντομάτες': 'diced tomatoes',
  'ντομάτες σούτσα': 'tomato sauce',
  'μαύρες ελιές': 'black olives',
  'ελιές': 'olives',
};

// ============================================================================
// Ingredient normalization
// ============================================================================

function normalizeIngredient(name: string): string {
  const lower = name.toLowerCase().trim();
  return GREEK_TO_ENGLISH_INGREDIENTS[lower] || lower;
}

// ============================================================================
// Extract ingredients from recipe text
// ============================================================================

function extractQuantityAndUnit(text: string): { quantity: number; unit: string; ingredient: string } {
  const patterns = [
    /^(\d+\.?\d*)\s*(lt|ml|l|kg|g|pcs|tem|κομ)?\s*(.+)$/i,
    /^(.+?)\s*(\d+\.?\d*)\s*(lt|ml|l|kg|g|pcs|tem|κομ)?$/i,
    /^(\d+\.?\d*)\s*(.+)$/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const quantity = parseFloat(match[1]);
      const unit = match[2] || '';
      const ingredient = match[3] || text;
      return { quantity, unit, ingredient: ingredient.trim() };
    }
  }

  return { quantity: 1, unit: 'pcs', ingredient: text };
}

function extractIngredientsFromRecipe(text: string): RecipeIngredient[] {
  const lines = text.split('\n').filter(line => {
    const trimmed = line.trim();
    return trimmed && 
           !trimmed.startsWith('#') && 
           !trimmed.match(/^[0-9]+\./) &&
           (trimmed.includes(' - ') || trimmed.includes(' ') || trimmed.match(/(\d)/));
  });

  const ingredients: RecipeIngredient[] = [];

  for (const line of lines) {
    const { quantity, unit, ingredient } = extractQuantityAndUnit(line);
    if (ingredient && quantity > 0) {
      ingredients.push({
        name: ingredient,
        quantity,
        unit,
        stores: [],
      });
    }
  }

  return ingredients;
}

// ============================================================================
// Match ingredients to products
// ============================================================================

function findMatchingProduct(ingredient: RecipeIngredient): any | null {
  const normalized = normalizeIngredient(ingredient.name);
  const ingredientLower = normalized.toLowerCase();

  // This is a simplified version - in production, use enriched data
  // We'll use the existing priceIndex logic through the searchProducts function
  return null;
}

function calculateIngredientPrices(
  ingredient: RecipeIngredient,
  rawProductsList: Product[]
): RecipeIngredient {
  // Find product by name match
  const matchedProduct = rawProductsList.find(p => {
    const ingredientLower = ingredient.name.toLowerCase();
    return p.nameGreek.toLowerCase().includes(ingredientLower) ||
           p.name.toLowerCase().includes(ingredientLower);
  });

  if (!matchedProduct) {
    return { ...ingredient, stores: [] };
  }

  // Find prices for this product
  const productWithPrices = rawProductsList.find(p => p.id === matchedProduct.id);
  if (!productWithPrices) {
    return { ...ingredient, stores: [] };
  }

  const prices = (productWithPrices as any).prices as PriceEntry[];
  if (!prices) {
    return { ...ingredient, stores: [] };
  }

  const storesWithPrices = stores
    .map(store => {
      const priceEntry = prices.find(p => p.storeId === store.id);
      if (priceEntry) {
        return {
          store,
          price: priceEntry.price * ingredient.quantity,
        };
      }
      return null;
    })
    .filter((s): s is { store: Store; price: number } => s !== null);

  const bestStoreEntry = storesWithPrices.sort((a, b) => a.price - b.price)[0];

  return {
    ...ingredient,
    productFacts: { 
      id: matchedProduct.id, 
      name: matchedProduct.name, 
    },
    stores: storesWithPrices,
    bestStore: bestStoreEntry?.store,
    bestPrice: bestStoreEntry?.price,
  };
}

// ============================================================================
// Main recipe engine function
// ============================================================================

export function processRecipe(recipeText: string): Recipe {
  const ingredients = extractIngredientsFromRecipe(recipeText);
  
  // Match each ingredient to products
  const processedIngredients = ingredients.map(ing => 
    calculateIngredientPrices(ing, rawProducts)
  );

  // Calculate total cost by store
  const storeTotals = new Map<string, { 
    store: Store; 
    total: number; 
    itemsAvailable: number; 
    itemsMissing: number;
  }>();

  for (const ing of processedIngredients) {
    if (ing.stores.length > 0) {
      for (const storeEntry of ing.stores) {
        const existing = storeTotals.get(storeEntry.store.id);
        storeTotals.set(storeEntry.store.id, {
          store: storeEntry.store,
          total: (existing?.total ?? 0) + storeEntry.price,
          itemsAvailable: (existing?.itemsAvailable ?? 0) + 1,
          itemsMissing: existing?.itemsMissing ?? 0,
        });
      }
    } else {
      for (const store of stores) {
        const existing = storeTotals.get(store.id);
        storeTotals.set(store.id, {
          store,
          total: existing?.total ?? 0,
          itemsAvailable: existing?.itemsAvailable ?? 0,
          itemsMissing: (existing?.itemsMissing ?? 0) + 1,
        });
      }
    }
  }

  const sortedStores = Array.from(storeTotals.values())
    .filter(s => s.itemsAvailable > 0)
    .sort((a, b) => a.total - b.total);

  const minTotal = sortedStores[0]?.total ?? 0;
  const maxTotal = sortedStores.length > 1 ? sortedStores[sortedStores.length - 1]?.total ?? minTotal : minTotal;

  return {
    id: `recipe-${Date.now()}`,
    name: recipeText.substring(0, 50) + (recipeText.length > 50 ? '...' : ''),
    ingredients: processedIngredients,
    totalCostByStore: sortedStores.map(s => ({
      storeId: s.store.id,
      storeName: s.store.name,
      storeNameGreek: s.store.nameGreek,
      total: s.total,
      itemsAvailable: s.itemsAvailable,
      itemsMissing: s.itemsMissing,
    })),
    totalCostAcrossStores: minTotal,
    estimatedPriceRange: { min: minTotal, max: maxTotal },
    createdAt: new Date().toISOString(),
  };
}

// ============================================================================
// Shopping cart optimization
// ============================================================================

export interface ShoppingCart {
  items: {
    ingredient: RecipeIngredient;
    store: Store;
    price: number;
  }[];
  total: number;
  storesUsed: string[];
  potentialSavings: number;
}

export function optimizeShoppingCart(recipe: Recipe, maxStores = 2): ShoppingCart {
  const cart: ShoppingCart['items'] = [];
  const storesUsed = new Set<string>();
  
  for (const ing of recipe.ingredients) {
    if (ing.stores.length > 0) {
      const sortedStores = [...ing.stores].sort((a, b) => a.price - b.price);
      const bestStore = sortedStores[0];
      
      cart.push({
        ingredient: ing,
        store: bestStore.store,
        price: bestStore.price,
      });
      storesUsed.add(bestStore.store.id);
    }
  }

  const singleStoreTotal = recipe.totalCostByStore[0]?.total ?? 0;
  const optimizedTotal = cart.reduce((sum, item) => sum + item.price, 0);

  return {
    items: cart,
    total: optimizedTotal,
    storesUsed: Array.from(storesUsed).slice(0, maxStores),
    potentialSavings: singleStoreTotal - optimizedTotal,
  };
}

// ============================================================================
// Recipe templates
// ============================================================================

export const RECIPE_TEMPLATES = {
  'Greek Salad': {
    name: 'Greek Salad (Horiatiko)',
    ingredients: `Greek Salad:
- 3 κουταλιές ελαιόλαδο
- 2 ντομάτες
- 1 κρεμμύδι
- 100g τυρί φέτα
- 100g μαύρες ελιές`,
  },
  'Pasta Carbonara': {
    name: 'Pasta Carbonara',
    ingredients: `Pasta Carbonara:
- 400g μακαρόνια
- 4 αυγά
- 50g βούτυρο
- 100g πίτσαμα
- αλάτι
- πιπέρι`,
  },
  'Chicken Stir Fry': {
    name: 'Chicken Stir Fry',
    ingredients: `Chicken Stir Fry:
- 500g κότοπουλο
- 3 πατάτες
- 2 ντομάτες
- 1 κρεμμύδι
- 3 κουταλιές ελαιόλαδο
- αλάτι
- πιπέρι`,
  },
  'Simple Soup': {
    name: 'Simple Soup (Glyko)',
    ingredients: `Simple Soup:
- 2 lt νερό
- 300g κρέας
- 2 πατάτες
- 1 κρεμμύδι
- 1 ντομάτα
- αλάτι
- μάργαρη`,
  },
  'Omelette': {
    name: 'Greek Omelette',
    ingredients: `Greek Omelette:
- 4 αυγά
- 150g τυρί
- 1 κρεμμύδι
- 2 κουταλιές ελαιόλαδο
- αλάτι`,
  },
};

// ============================================================================
// Export public API
// ============================================================================

export const recipeEngine = {
  processRecipe,
  optimizeShoppingCart,
  extractIngredientsFromRecipe,
  normalizeIngredient,
  RECIPE_TEMPLATES,
};
