// Product type
export interface Product {
  id: string;
  name: string;
  nameGreek: string;
  category: string;
  brand?: string;
  unit: string; // e.g., "kg", "lt", "pcs"
}

// Price entry for a specific store
export interface PriceEntry {
  productId: string;
  storeId: string;
  price: number;
  currency: string;
  lastUpdated: string;
  promotion?: string;
}

// Store type
export interface Store {
  id: string;
  name: string;
  nameGreek: string;
  chain: string; // e.g., "Sklavenitis", "Lidl", "My Market"
  location?: string;
}

// LLM Query result
export interface QueryResult {
  answer: string;
  products?: Product[];
  prices?: PriceEntry[];
  cheapestStore?: Store;
  recipe?: Recipe;
}

// Recipe Engine types
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
