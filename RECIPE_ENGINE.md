# SupermarketLLM Recipe Engine

## Overview
The Recipe Engine is a smart shopping assistant that helps users find the best places to buy ingredients for their recipes. It can:

1. **Parse recipes** - Extract ingredients from natural language recipes (Greek or English)
2. **Match ingredients** - Find matching products in the supermarket database
3. **Price comparison** - Show cheapest stores for each ingredient
4. **Multi-store optimization** - Build optimal shopping cart across 2+ stores
5. **Greek language support** - Understand Greek ingredient names

## Features

### 1. Recipe Parsing
```typescript
// Input: Natural language recipe
const recipeText = `Greek Salad:
- 3 κουταλιές ελαιόλαδο
- 2 ντομάτες
- 1 κρεμμύδι
- 100g τυρί φέτα
`;

const recipe = recipeEngine.processRecipe(recipeText);
```

### 2. Price Comparison
Each ingredient shows availability across stores:
```typescript
{
  name: "νερό",
  quantity: 1,
  unit: "L",
  stores: [
    { store: {id: 'lidl', name: 'Lidl'}, price: 0.45 },
    { store: {id: 'ab', name: 'AB Vasilopoulos'}, price: 0.50 },
    // ... all stores
  ],
  bestStore: {id: 'lidl', name: 'Lidl'},
  bestPrice: 0.45
}
```

### 3. Multi-Store Optimization
```typescript
// Instead of shopping at one store, optimize across multiple
const cart = recipeEngine.optimizeShoppingCart(recipe, { maxStores: 2 });

// Result:
// - Milk from Lidl (cheapest)
// - Tomatoes from AB (cheaper than Lidl)
// - Total: €12.50 (vs €14.20 at single cheapest store)
// - Potential savings: €1.70
```

## Usage

### Basic Recipe Processing
```typescript
import { recipeEngine } from './src/services/recipeEngine';

// Process a recipe
const recipe = recipeEngine.processRecipe(recipeText);

// View results
console.log(recipe.ingredients);
console.log(recipe.totalCostByStore); // Sorted: cheapest first
console.log(recipe.estimatedPriceRange);
```

### Shopping Cart Optimization
```typescript
// Get optimized cart across multiple stores
const cart = recipeEngine.optimizeShoppingCart(recipe, { maxStores: 3 });

console.log(cart.total); // €12.50
console.log(cart.storesUsed); // ['lidl', 'ab']
console.log(cart.potentialSavings); // €1.70
```

### Greek Ingredient Support
The engine understands Greek ingredients:
```typescript
// These all work:
recipeEngine.normalizeIngredient('νερό');     // → 'water'
recipeEngine.normalizeIngredient('καθαρό νερό'); // → 'water'
recipeEngine.normalizeIngredient('τυρί');      // → 'cheese'
recipeEngine.normalizeIngredient('μπανανα');   // → 'banana'
```

## Recipe Templates

Built-in Greek recipes:
- Greek Salad (Horiatiko)
- Pasta Carbonara
- Chicken Stir Fry
- Simple Soup (Glyko)
- Greek Omelette (Tyropita)

## Files Created

1. **`src/services/recipeEngine.ts`** - Main recipe engine implementation
2. **`RECIPE_ENGINE.md`** - This documentation

## Next Steps

1. **Create UI/UX** - Recipe input form, store selection checkboxes, price visualization
2. **Add Shopping List Persistence** - Save recipes, track prices over time
3. **Add Price History Tracking** - Monitor price changes, alert on drops
4. **Add Deal Notifications** - Alert when items on recipe go on sale
5. **Add Export Options** - WhatsApp, Todoist, Apple Reminders, email
6. **Add Voice Input** - "Add Greek Salad to recipe list" via voice

### Bonus Ideas

- **Recipe Suggestions** - Based on what's on sale, what you have at home
- **Meal Planning** - 7-day meal plan with auto-generated shopping list
- **Budget Mode** - Find cheapest alternatives while keeping quality
- **Dietary Tags** - Vegetarian, vegan, gluten-free filters
- **Family Mode** - Multiple users sharing shopping lists

## Example: Complete Workflow

```typescript
import { recipeEngine } from './src/services/recipeEngine';

// 1. User inputs recipe
const recipeText = `
Greek Salad:
- 3 κουταλιές ελαιόλαδο
- 2 ντομάτες
- 1 κρεμμύδι
- 100g τυρί φέτα
`;

// 2. Process recipe
const recipe = recipeEngine.processRecipe(recipeText);

// 3. Show best stores
console.log('Best stores for this recipe:');
recipe.totalCostByStore.forEach(store => {
  console.log(`- ${store.storeNameGreek}: €${store.total.toFixed(2)} (${store.itemsAvailable}/${recipe.ingredients.length} items)`);
});

// 4. Optimize across stores
const cart = recipeEngine.optimizeShoppingCart(recipe, { maxStores: 2 });

console.log(`Optimized total: €${cart.total.toFixed(2)}`);
console.log(`Stores to visit: ${cart.storesUsed.join(', ')}`);
console.log(`Potential savings: €${cart.potentialSavings.toFixed(2)}`);
```

## Technical Details

### Ingredient Matching
1. Normalize ingredient name (Greek → English, lowercase)
2. Search against product types in enriched data
3. Fallback to keyword search

### Price Calculation
1. For each ingredient, find all stores where available
2. Calculate price per quantity
3. Sort stores by price
4. Add to total cost

### Multi-Store Optimization
1. For each ingredient, identify the cheapest store
2. Group ingredients by store
3. Calculate per-store totals
4. Return total across all stores

### Greek Language Support
- Direct mapping for common ingredients
- Diacritic stripping for matching
- Greek-to-English translation dictionary
