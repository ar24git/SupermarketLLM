# SupermarketLLM - Basket Optimization Strategy

## Overview
The app will have **two types of baskets** to help users find the best supermarket:

1. **General Basket** - Generic shopping list (common items)
2. **User-Tailored Basket** - Personalized based on user preferences/history

## Basket Types

### 1. General Basket
- Predefined common items for each household size
- "My family of 4" basket
- "Student basket" (budget-friendly)
- "Single person basket" (small quantities)

### 2. User-Tailored Basket
- Based on user's purchase history
- Favorites and preferred brands
- Dietary preferences (organic, vegan, gluten-free)
- Budget limits and price sensitivity

## Winner Supermarket Logic

### For Each Basket Size:
1. **Calculate total cost** across all 10 stores
2. **Apply user preferences**:
   - If user prefers organic: add premium to non-organic items
   - If user prefers local: add premium to imported items
   - If budget-conscious: weight cheaper items more heavily
3. **Apply basket-specific weights**:
   - Family of 4: bulk items get 2x weight
   - Student: budget items get 2x weight
   - Single: small packages get 2x weight

### Scoring System:
```
Total Score = Σ (item_price × weight × preference_multiplier)

Winner = Store with LOWEST Total Score
```

## User Preferences

### Preference Categories:

1. **Price Sensitivity**
   - High: Price is main factor (±50% weighting)
   - Medium: Balance of price/quality (±25% weighting)
   - Low: Quality/brand matters more (±10% weighting)

2. **Dietary Preferences**
   - Organic: +€0.50 premium for non-organic
   - Vegan: exclude non-vegan items
   - Gluten-free: exclude gluten items

3. **Brand Preferences**
   - Preferred brands: -10% price (if available)
   - Avoided brands: exclude or +20% penalty

4. **Store Preferences**
   - Favorite stores: -5% price (as proxy for loyalty)
   - Avoided stores: exclude

5. **Basket Size Preferences**
   - Small basket (< €10): focus on convenience
   - Medium basket (€10-€50): balance price/quality
   - Large basket (€50+): focus on bulk savings

## Implementation Example

```typescript
interface UserPreferences {
  priceSensitivity: 'low' | 'medium' | 'high';
  dietary: {
    organic: boolean;
    vegan: boolean;
    glutenFree: boolean;
  };
  preferredBrands: string[];
  avoidedBrands: string[];
  favoriteStores: string[];
  avoidedStores: string[];
}

interface Basket {
  userId: string;
  items: BasketItem[];
  size: 'small' | 'medium' | 'large' | 'family';
  preferences: UserPreferences;
}

interface BasketResult {
  storeId: string;
  storeName: string;
  total: number;
  itemsAvailable: number;
  itemsMissing: number;
  score: number; // lower is better
  preferenceApplied: string[]; // what was adjusted
}
```

## Winner Selection Logic

1. **For each store:**
   - Calculate base total for basket items
   - Apply preference adjustments
   - Calculate final score

2. **Rank stores by score** (ascending)

3. **Return top N stores** with score breakdown:
   ```
   🏆 Lidl: €24.50 (score: 18.2)
     - Organic premium: +€0.00 (not applied)
     - Brand preference: -€1.20 (preferred brand found)
     - Basket size discount: -€0.50 (family size)
   
   🥈 AB Vasilopoulos: €25.80 (score: 19.1)
   🥉 Sklavenitis: €26.20 (score: 19.5)
   ```

## Basket Optimization Flow

```
1. User selects or creates basket
   ↓
2. System loads user preferences
   ↓
3. For each store:
   - Check item availability
   - Calculate adjusted prices
   - Apply preference multipliers
   - Compute final score
   ↓
4. Rank stores by score
   ↓
5. Show top 3 stores + score breakdown
   ↓
6. User chooses winner store
   ↓
7. Generate optimized shopping list
```

## Advanced Features

### "Smart Basket" Button
- AI analyzes what user typically buys
- Suggests optimal basket size
- Auto-adds missing items for best savings

### "Adjust for Budget" Button
- User sets max budget: €30
- System recalculates basket with cheaper alternatives
- Shows tradeoffs: "Replace brand X with generic: save €3.50"

### "Compare Baskets" Feature
- Compare general basket vs user basket
- Show savings: "User basket saves €4.20 vs general"

## Example: Family of 4 Basket

**General Basket (common items):**
- Milk (2L) × 2
- Bread (loaf) × 3
- Pasta (500g) × 2
- Tomatoes (500g) × 2
- Chicken (1kg) × 1

**User-Tailored Basket (same + preferences):**
- Milk (2L, organic) × 2 (+€0.50 if not organic)
- Bread (whole wheat, local) × 3 (+€0.30 if not local)
- Pasta (gluten-free) × 2 (if GF preference)
- Tomatoes (organic) × 2
- Chicken (free-range) × 1

**Winner Selection:**
```
Lidl: €24.50 (score: 18.2)
  - Organic milk available: ✓
  - Local bread available: ✓
  - GF pasta available: ✓
  
AB: €25.80 (score: 19.1)
  - Organic milk available: ✓
  - Local bread NOT available: -€0.30
  - GF pasta available: ✓
```

## Storage

### User Profile Schema:
```typescript
interface UserProfile {
  userId: string;
  preferences: UserPreferences;
  purchaseHistory: PurchaseRecord[];
  favoriteBaskets: Basket[];
  basketHistory: {
    basketId: string;
    storeId: string;
    date: string;
    total: number;
    savings: number;
  }[];
}
```

## Benefits

1. **Personalized savings**: Users get the best store for THEIR preferences
2. **Transparent scoring**: Users see why a store wins
3. **Flexible**: Baskets adapt to different household sizes
4. **Smart defaults**: "General basket" works for anyone
5. **Progressive**: Gets smarter with user data over time

---

**Status:** Planned feature, ready for implementation
**Priority:** High (core value proposition)
