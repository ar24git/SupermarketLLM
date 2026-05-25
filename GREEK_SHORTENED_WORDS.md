# Greek Ingredient Shortened Words Mapping

## Purpose
This file documents Greek ingredient shortened words that are commonly used in recipes, 
and their full forms to help with better matching to supermarket products.

## How It Works
When a recipe contains a shortened word, we first try to expand it to the full form,
then match against the supermarket database.

## Greek Shortened Words

### Onions
- `κρεμ` / `κρεμμ` → `κρεμμύδι`
- `κρεμ` / `κρεμμ` (plural) → `κρεμμύδια`
- `κρεμμυδούνι` → `κρεμμύδι`

### Tomatoes
- `ντομ` → `ντομάτα`
- `ντομ` (plural) → `ντομάτες`

### Potatoes
- `πατ` → `πατάτα`
- `πατ` (plural) → `πατάτες`

### Carrots
- `καρ` → `καρότο`
- `καρ` (plural) → `καρότα`

### Peppers
- `πιπερ` → `πιπέρι`
- `πιπερ` (plural) → `πιπέρια`

### Zucchini
- `κολ` → `κολοκύθι`
- `κολ` (plural) → `κολοκύθια`

### Olives
- `ελ` → `ελιά`
- `ελ` (plural) → `ελιές`
- `ελαι` → `ελιά`

### Feta Cheese
- `φετ` → `φέτα`

### Yogurt
- `γιαουρ` → `γιαούρτι`

### Chicken
- `κοτ` → `κότοπουλο`

### Beef
- `βοδ` → `βοδινό`

### Pork
- `χοιρ` → `χοιρινό`

### Fish
- `ψαρ` → `ψάρι`

### Shrimp
- `γαρ` → `γαρίδα`

### Mushrooms
- `μαν` → `μανιτάρι`
- `μαν` (plural) → `μανιτάρια`

### Spinach
- `σπαν` → `σπανάκι`

### Eggplant
- `μελ` → `μελιτζάνα`
- `μελ` (plural) → `μελιτζάνες`

### Apples
- `μηλ` → `μήλο`
- `μηλ` (plural) → `μήλα`

### Bananas
- `μπαν` → `μπανάνα`
- `μπαν` (plural) → `μπανάνες`

### Cucumbers
- `αγγ` → `αγγούρι`
- `αγγ` (plural) → `αγγούρια`

### Lemon
- `λεμ` → `λεμόνι`
- `λεμ` (plural) → `λεμόνια`

### Garlic
- `σκορ` → `σκόρδο`

## Implementation Strategy

### Option 1: Add to PHRASE_TO_TYPE mapping
Add shortened forms directly to `PHRASE_TO_TYPE` in priceIndex.ts:
```typescript
const PHRASE_TO_TYPE: Record<string, string> = {
  // ... existing mappings ...
  'κρεμ': 'onion',      // shortened for onion
  'ντομ': 'tomato',     // shortened for tomato
  'πατ': 'potato',      // shortened for potato
  // ...
}
```

### Option 2: Pre-processing step
Add a Greek shortened words preprocessing function:
```typescript
function expandGreekShortenedWords(text: string): string {
  const replacements = {
    'κρεμ': 'κρεμμύδι',
    'κρεμμ': 'κρεμμύδι',
    'ντομ': 'ντομάτ',
    'πατ': 'πατάτ',
    // ...
  };
  // Apply replacements with word boundary awareness
  for (const [short, full] of Object.entries(replacements)) {
    // Replace with word boundaries
    const regex = new RegExp(`\\b${short}\\b`, 'g');
    text = text.replace(regex, full);
  }
  return text;
}
```

### Option 3: Hybrid approach
1. Try exact match first
2. If not found, try expanded form
3. If still not found, use fuzzy matching

## Current State

### Recipe Engine - Greek Mapping (in GREEK_TO_ENGLISH_INGREDIENTS)
The recipe engine has:
- `κρεμμύδια` → `onions` (plural)
- `κρεμμύδι` → `onion` (singular)
- `ντομάτες` → `tomatoes` (plural)
- `ντομάτα` → `tomato` (singular)
- And other full forms...

### What's Missing
- Shortened forms like `κρεμ`, `ντομ`, `πατ`, etc.
- These are commonly used in Greek recipes for brevity

## Recommendation

**Add a preprocessing step** in the recipe engine to expand shortened words 
before matching to products.

This approach:
- Keeps the existing mapping clean
- Is easy to maintain and extend
- Handles edge cases better (word boundaries)
- Can be reused across the app

## Example Implementation

```typescript
const GREEK_SHORTENED_WORDS: Record<string, string> = {
  // Onions
  'κρεμ': 'κρεμμύδι',
  'κρεμμ': 'κρεμμύδι',
  
  // Tomatoes
  'ντομ': 'ντομάτ',
  
  // Potatoes
  'πατ': 'πατάτ',
  
  // Carrots
  'καρ': 'καρότ',
  
  // Peppers
  'πιπερ': 'πιπέρ',
  
  // Zucchini
  'κολ': 'κολοκύθ',
  
  // Olives
  'ελ': 'ελιά',
  
  // Feta
  'φετ': 'φέτ',
  
  // Yogurt
  'γιαουρ': 'γιαούρτ',
  
  // Chicken
  'κοτ': 'κότοπουλ',
  
  // Beef
  'βοδ': 'βοδιν',
  
  // Pork
  'χοιρ': 'χοιριν',
  
  // Fish
  'ψαρ': 'ψάρ',
  
  // Shrimp
  'γαρ': 'γαρίδ',
  
  // Mushrooms
  'μαν': 'μανιτάρ',
  
  // Spinach
  'σπαν': 'σπανάκ',
  
  // Eggplant
  'μελ': 'μελιτζάν',
  
  // Apples
  'μηλ': 'μήλ',
  
  // Bananas
  'μπαν': 'μπανάν',
  
  // Cucumbers
  'αγγ': 'αγγούρ',
  
  // Lemon
  'λεμ': 'λεμόν',
  
  // Garlic
  'σκορ': 'σκόρδ',
};

function expandGreekShortenedWords(text: string): string {
  let result = text;
  
  // Process in order of specificity (longest first)
  const sortedKeys = Object.keys(GREEK_SHORTENED_WORDS)
    .sort((a, b) => b.length - a.length);
  
  for (const short of sortedKeys) {
    const full = GREEK_SHORTENED_WORDS[short];
    const regex = new RegExp(`\\b${short}\\b`, 'gi');
    result = result.replace(regex, full);
  }
  
  return result;
}
```

## Files to Update

1. `src/services/recipeEngine.ts` - Add Greek shortened words mapping and preprocessing
2. `src/services/priceIndex.ts` - May need to update PHRASE_TO_TYPE for consistency
3. `RECIPE_ENGINE.md` - Document this feature
4. `RECIPE_ENGINE_TECHNICAL.md` - Document implementation details
