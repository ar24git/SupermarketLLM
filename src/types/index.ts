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
}
