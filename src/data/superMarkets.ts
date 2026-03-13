import { Store, Product, PriceEntry } from '../types';

// Greek Supermarket Chains
export const stores: Store[] = [
  { id: 'sklavenitis', name: 'Sklavenitis', nameGreek: 'Σκλαβενίτης', chain: 'Sklavenitis' },
  { id: 'masoutis', name: 'Masoutis', nameGreek: 'Μασούτης', chain: 'Masoutis' },
  { id: 'lidl', name: 'Lidl', nameGreek: 'Lidl', chain: 'Lidl' },
  { id: 'mymarket', name: 'My Market', nameGreek: 'My Market', chain: 'My Market' },
  { id: 'ab', name: 'AB Vasilopoulos', nameGreek: 'ΑΒ Βασιλόπουλος', chain: 'AB' },
  { id: 'koutoudis', name: 'Koutoudis', nameGreek: 'Κουτουδής', chain: 'Koutoudis' },
];

// Sample Products (Greek context)
export const products: Product[] = [
  // Dairy
  { id: 'milk', name: 'Milk', nameGreek: 'Γάλα', category: 'Dairy', unit: 'lt' },
  { id: 'yogurt', name: 'Yogurt', nameGreek: 'Γιαούρτι', category: 'Dairy', unit: 'pcs' },
  { id: 'feta', name: 'Feta Cheese', nameGreek: 'Φέτα', category: 'Dairy', unit: 'kg' },
  { id: 'butter', name: 'Butter', nameGreek: 'Βούτυρο', category: 'Dairy', unit: 'pcs' },
  
  // Bread & Bakery
  { id: 'bread', name: 'Bread', nameGreek: 'Ψωμί', category: 'Bakery', unit: 'pcs' },
  { id: 'baguette', name: 'Baguette', nameGreek: 'Μπαγκέτα', category: 'Bakery', unit: 'pcs' },
  
  // Meat
  { id: 'chicken', name: 'Chicken Breast', nameGreek: 'Στήθος κοτόπουλο', category: 'Meat', unit: 'kg' },
  { id: 'beef', name: 'Beef', nameGreek: 'Βοδινό', category: 'Meat', unit: 'kg' },
  { id: 'pork', name: 'Pork', nameGreek: 'Χοιρινό', category: 'Meat', unit: 'kg' },
  
  // Fish
  { id: 'salmon', name: 'Salmon', nameGreek: 'Σολομός', category: 'Fish', unit: 'kg' },
  { id: 'sardines', name: 'Sardines', nameGreek: 'Σαρδέλες', category: 'Fish', unit: 'kg' },
  
  // Fruits & Vegetables
  { id: 'apple', name: 'Apple', nameGreek: 'Μήλο', category: 'Fruits', unit: 'kg' },
  { id: 'banana', name: 'Banana', nameGreek: 'Μπανάνα', category: 'Fruits', unit: 'kg' },
  { id: 'tomato', name: 'Tomato', nameGreek: 'Ντομάτα', category: 'Vegetables', unit: 'kg' },
  { id: 'potato', name: 'Potato', nameGreek: 'Πατάτα', category: 'Vegetables', unit: 'kg' },
  { id: 'onion', name: 'Onion', nameGreek: 'Κρεμμύδι', category: 'Vegetables', unit: 'kg' },
  { id: 'lemon', name: 'Lemon', nameGreek: 'Λεμόνι', category: 'Fruits', unit: 'kg' },
  
  // Beverages
  { id: 'water', name: 'Water', nameGreek: 'Νερό', category: 'Beverages', unit: 'lt' },
  { id: 'juice', name: 'Juice', nameGreek: 'Χυμός', category: 'Beverages', unit: 'lt' },
  { id: 'coffee', name: 'Coffee', nameGreek: 'Καφές', category: 'Beverages', unit: 'pcs' },
  
  // Staples
  { id: 'rice', name: 'Rice', nameGreek: 'Ρύζι', category: 'Staples', unit: 'kg' },
  { id: 'pasta', name: 'Pasta', nameGreek: 'Μακαρόνια', category: 'Staples', unit: 'pcs' },
  { id: 'oliveoil', name: 'Olive Oil', nameGreek: 'Ελαιόλαδο', category: 'Staples', unit: 'lt' },
  { id: 'flour', name: 'Flour', nameGreek: 'Αλεύρι', category: 'Staples', unit: 'kg' },
  
  // Snacks
  { id: 'chips', name: 'Chips', nameGreek: 'Πατατάκια', category: 'Snacks', unit: 'pcs' },
  { id: 'chocolate', name: 'Chocolate', nameGreek: 'Σοκολάτα', category: 'Snacks', unit: 'pcs' },
];

// Sample Prices (in EUR)
export const prices: PriceEntry[] = [
  // Milk
  { productId: 'milk', storeId: 'sklavenitis', price: 1.29, currency: 'EUR', lastUpdated: '2026-03-10' },
  { productId: 'milk', storeId: 'masoutis', price: 1.19, currency: 'EUR', lastUpdated: '2026-03-10' },
  { productId: 'milk', storeId: 'lidl', price: 0.99, currency: 'EUR', lastUpdated: '2026-03-10' },
  { productId: 'milk', storeId: 'mymarket', price: 1.25, currency: 'EUR', lastUpdated: '2026-03-10' },
  { productId: 'milk', storeId: 'ab', price: 1.35, currency: 'EUR', lastUpdated: '2026-03-10' },
  
  // Feta Cheese
  { productId: 'feta', storeId: 'sklavenitis', price: 8.50, currency: 'EUR', lastUpdated: '2026-03-10' },
  { productId: 'feta', storeId: 'masoutis', price: 7.90, currency: 'EUR', lastUpdated: '2026-03-10' },
  { productId: 'feta', storeId: 'lidl', price: 6.99, currency: 'EUR', lastUpdated: '2026-03-10' },
  { productId: 'feta', storeId: 'mymarket', price: 8.20, currency: 'EUR', lastUpdated: '2026-03-10' },
  
  // Olive Oil
  { productId: 'oliveoil', storeId: 'sklavenitis', price: 7.50, currency: 'EUR', lastUpdated: '2026-03-10' },
  { productId: 'oliveoil', storeId: 'masoutis', price: 7.20, currency: 'EUR', lastUpdated: '2026-03-10' },
  { productId: 'oliveoil', storeId: 'lidl', price: 6.50, currency: 'EUR', lastUpdated: '2026-03-10' },
  { productId: 'oliveoil', storeId: 'mymarket', price: 7.80, currency: 'EUR', lastUpdated: '2026-03-10' },
  { productId: 'oliveoil', storeId: 'koutoudis', price: 6.90, currency: 'EUR', lastUpdated: '2026-03-10' },
  
  // Chicken Breast
  { productId: 'chicken', storeId: 'sklavenitis', price: 5.99, currency: 'EUR', lastUpdated: '2026-03-10' },
  { productId: 'chicken', storeId: 'masoutis', price: 5.49, currency: 'EUR', lastUpdated: '2026-03-10' },
  { productId: 'chicken', storeId: 'lidl', price: 4.99, currency: 'EUR', lastUpdated: '2026-03-10' },
  { productId: 'chicken', storeId: 'mymarket', price: 5.79, currency: 'EUR', lastUpdated: '2026-03-10' },
  
  // Bread
  { productId: 'bread', storeId: 'sklavenitis', price: 1.20, currency: 'EUR', lastUpdated: '2026-03-10' },
  { productId: 'bread', storeId: 'masoutis', price: 1.10, currency: 'EUR', lastUpdated: '2026-03-10' },
  { productId: 'bread', storeId: 'lidl', price: 0.85, currency: 'EUR', lastUpdated: '2026-03-10' },
  
  // Tomatoes
  { productId: 'tomato', storeId: 'sklavenitis', price: 1.99, currency: 'EUR', lastUpdated: '2026-03-10' },
  { productId: 'tomato', storeId: 'masoutis', price: 1.79, currency: 'EUR', lastUpdated: '2026-03-10' },
  { productId: 'tomato', storeId: 'lidl', price: 1.49, currency: 'EUR', lastUpdated: '2026-03-10' },
  { productId: 'tomato', storeId: 'mymarket', price: 1.89, currency: 'EUR', lastUpdated: '2026-03-10' },
  
  // Water (6-pack)
  { productId: 'water', storeId: 'sklavenitis', price: 2.50, currency: 'EUR', lastUpdated: '2026-03-10' },
  { productId: 'water', storeId: 'masoutis', price: 2.20, currency: 'EUR', lastUpdated: '2026-03-10' },
  { productId: 'water', storeId: 'lidl', price: 1.79, currency: 'EUR', lastUpdated: '2026-03-10' },
  
  // Pasta
  { productId: 'pasta', storeId: 'sklavenitis', price: 1.50, currency: 'EUR', lastUpdated: '2026-03-10' },
  { productId: 'pasta', storeId: 'masoutis', price: 1.35, currency: 'EUR', lastUpdated: '2026-03-10' },
  { productId: 'pasta', storeId: 'lidl', price: 0.99, currency: 'EUR', lastUpdated: '2026-03-10' },
  
  // Yogurt
  { productId: 'yogurt', storeId: 'sklavenitis', price: 1.50, currency: 'EUR', lastUpdated: '2026-03-10' },
  { productId: 'yogurt', storeId: 'masoutis', price: 1.29, currency: 'EUR', lastUpdated: '2026-03-10' },
  { productId: 'yogurt', storeId: 'lidl', price: 0.99, currency: 'EUR', lastUpdated: '2026-03-10' },
];

// Helper functions
export function getProductById(id: string): Product | undefined {
  return products.find(p => p.id === id);
}

export function getStoreById(id: string): Store | undefined {
  return stores.find(s => s.id === id);
}

export function getPricesForProduct(productId: string): PriceEntry[] {
  return prices.filter(p => p.productId === productId);
}

export function findCheapestPrice(productId: string): PriceEntry | undefined {
  const productPrices = getPricesForProduct(productId);
  return productPrices.reduce((min, p) => p.price < min.price ? p : min, productPrices[0]);
}
