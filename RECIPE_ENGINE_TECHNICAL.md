# Recipe Engine - Technical Documentation

## Overview

The Recipe Engine is the smart shopping assistant for SupermarketLLM. It helps users find the best places to buy ingredients for their recipes by:

1. **Parsing recipes** - Extract ingredients from natural language
2. **Matching ingredients** - Find products in the supermarket database
3. **Price comparison** - Show cheapest stores for each ingredient
4. **Multi-store optimization** - Build optimal cart across 2+ stores
5. **Greek language support** - Understand Greek ingredient names

## Architecture

```
Recipe Engine
├── Input Processing
│   ├── Recipe text parsing
│   ├── Ingredient extraction
│   └── Quantity/unit normalization
├── Product Matching
│   ├── Greek → English translation
│   ├── Product type matching
│   └── Keyword search fallback
├── Price Calculation
│   ├── Find prices per store
│   ├── Calculate totals by quantity
│   └── Store coverage analysis
├── Optimization
│   ├── Single-store shopping
│   ├── Multi-store cart optimization
│   └── Savings calculation
└── Output Generation
    ├── Recipe details
    ├── Store rankings
    └── Shopping cart breakdown
```

## Core Functions

### `processRecipe(recipeText: string): Recipe`

Parses a recipe and returns complete analysis.

**Input:**
```typescript
const recipeText = `Greek Salad:
- 3 κουταλιές ελαιόλαδο
- 2 ντομάτες
- 1 κρεμμύδι
- 100g τυρί φέτα`;
```

**Output:**
```typescript
{
  id: "recipe-1716675200000",
  name: "Greek Salad...",
  ingredients: [
    {
      name: "ελαιόλαδο",
      quantity: 3,
      unit: "κουταλιές",
      stores: [{ store: Lidl, price: 2.10 }, ...],
      bestStore: Lidl,
      bestPrice: 2.10
    },
    // ...
  ],
  totalCostByStore: [
    { storeId: 'lidl', storeName: 'Lidl', total: 8.50, itemsAvailable: 4 },
    { storeId: 'ab', storeName: 'AB Vasilopoulos', total: 9.20, itemsAvailable: 4 },
    // sorted by price
  ],
  totalCostAcrossStores: 8.50,
  estimatedPriceRange: { min: 8.50, max: 12.30 },
  createdAt: "2026-05-25T..."
}
```

### `optimizeShoppingCart(recipe: Recipe, maxStores = 2): ShoppingCart`

Optimizes shopping across multiple stores.

**Output:**
```typescript
{
  items: [
    { ingredient: "ελαιόλαδο", store: Lidl, price: 2.10 },
    { ingredient: "ντομάτες", store: AB, price: 1.50 },
    // cheapest for each ingredient
  ],
  total: 8.50,
  storesUsed: ['lidl', 'ab'],
  potentialSavings: 1.70 // vs single best store
}
```

## Greek Ingredient Translation

Common Greek ingredients mapped to English:

| Greek | English |
|-------|---------|
| νερό | water |
| λάδι | oil |
| ελαιόλαδο | olive oil |
| αλάτι | salt |
| ζάχαρη | sugar |
| κρέας | meat |
| κότοπουλο | chicken |
| ψάρι | fish |
| γάλα | milk |
| γιαούρτι | yogurt |
| τυρί | cheese |
| βούτυρο | butter |
| αυγά | eggs |
| ρύζι | rice |
| μακαρόνι | pasta |
| φλούδα | flour |
| ψωμί | bread |
| σοκολάτα | chocolate |
| μπισκότα | biscuits |
| πατάτες | potatoes |
| ντομάτες | tomatoes |
| κρεμμύδια | onions |
| αγγούρια | cucumbers |
| σπανάκι | spinach |
| μπροκόλι | broccoli |
| καρότα | carrots |
| μελί | honey |
| μαύρες ελιές | black olives |

## Recipe Templates

Built-in Greek recipes ready to use:

### 1. Greek Salad (Horiatiko)
- Olive oil, tomatoes, onion, feta cheese, black olives

### 2. Pasta Carbonara
- Pasta, eggs, butter, bacon, salt, pepper

### 3. Chicken Stir Fry
- Chicken, potatoes, tomatoes, onion, olive oil, salt, pepper

### 4. Simple Soup (Glyko)
- Water, meat, potatoes, onion, tomato, salt, marjoram

### 5. Greek Omelette
- Eggs, cheese, onion, olive oil, salt

## Usage Examples

### Example 1: Basic Recipe Processing

```typescript
import { recipeEngine } from './src/services/recipeEngine';

const recipeText = `Greek Salad:
- 3 κουταλιές ελαιόλαδο
- 2 ντομάτες
- 1 κρεμμύδι
- 100g τυρί φέτα
- 100g μαύρες ελιές`;

const recipe = recipeEngine.processRecipe(recipeText);

console.log('Best stores:');
recipe.totalCostByStore.forEach(s => {
  console.log(`${s.storeNameGreek}: €${s.total.toFixed(2)}`);
});
```

### Example 2: Multi-Store Optimization

```typescript
const cart = recipeEngine.optimizeShoppingCart(recipe, { maxStores: 3 });

console.log(`Total: €${cart.total.toFixed(2)}`);
console.log(`Stores: ${cart.storesUsed.join(', ')}`);
console.log(`Savings: €${cart.potentialSavings.toFixed(2)}`);
```

### Example 3: Using Recipe Templates

```typescript
const salad = recipeEngine.RECIPE_TEMPLATES['Greek Salad'];
const recipe = recipeEngine.processRecipe(salad.ingredients);
```

## Technical Details

### Ingredient Normalization

1. Lowercase conversion
2. Diacritic stripping (Greek accents)
3. Greek → English translation
4. Type normalization (e.g., "milk" vs "milk")

### Product Matching Strategy

1. **Exact type match** - Check if product type matches normalized ingredient
2. **Name contains match** - Search product names for ingredient keywords
3. **Keyword search fallback** - Use existing priceIndex search

### Price Calculation

For each ingredient:
1. Find all stores where product is available
2. Calculate price × quantity
3. Sort stores by price
4. Store cheapest price and store reference

### Multi-Store Optimization

Algorithm:
1. For each ingredient, identify cheapest store
2. Add to cart with that store
3. Track unique stores used
4. Calculate total across all stores
5. Compare vs single-store shopping

## File Structure

```
SupermarketLLM/
├── src/
│   └── services/
│       ├── recipeEngine.ts      # Main engine implementation
│       └── priceIndex.ts        # Existing price search
├── RECIPE_ENGINE.md            # This documentation
└── RECIPE_ENGINE_TECHNICAL.md  # This file
```

## Future Enhancements

### Priority 1 - UI/UX
- Recipe input form
- Store selection checkboxes
- Price visualization charts
- Export options

### Priority 2 - Data
- Shopping list persistence
- Price history tracking
- Deal notifications

### Priority 3 - Intelligence
- Recipe suggestions based on sales
- Meal planning automation
- Budget mode for cheaper alternatives
- Dietary filters (vegan, vegetarian, gluten-free)

### Priority 4 - Voice
- Voice input for recipes
- Voice assistant integration
- Hands-free shopping list creation

## Testing

Run recipe engine tests:

```bash
cd /Users/arthur/SupermarketLLM
npx tsc --noEmit --skipLibCheck
```

Test in Node.js:

```bash
node -e "
const { recipeEngine } = require('./src/services/recipeEngine');
const recipe = recipeEngine.processRecipe('Test');
console.log(recipe.totalCostByStore);
"
```

## Support

For questions or issues, check:
- [SupermarketLLM README](../README.md)
- [Project Documentation](../../docs)
- [GitHub Issues](https://github.com/...)
