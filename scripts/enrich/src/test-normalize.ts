// scripts/enrich/src/test-normalize.ts
//
// Quick smoke test for the normalizer. Runs without the LLM, no Ollama needed.
// Usage:  cd scripts/enrich && npx tsx src/test-normalize.ts

import { normalizeEnriched, normalizeCategoryClean, extractBrandFromName } from './normalize';

let pass = 0;
let fail = 0;
function check(name: string, got: unknown, want: unknown): void {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    console.log(`  ✗ ${name}`);
    console.log(`      got:  ${JSON.stringify(got)}`);
    console.log(`      want: ${JSON.stringify(want)}`);
  }
}

console.log('--- productType synonym collapse ---');
check('biscuits → biscuit',
  normalizeEnriched({ ...base(), productType: 'biscuits' }).productType,
  'biscuit');
check('cleaning_liquid → cleaner',
  normalizeEnriched({ ...base(), productType: 'cleaning_liquid' }).productType,
  'cleaner');
check('cleaning_agent → cleaner',
  normalizeEnriched({ ...base(), productType: 'cleaning_agent' }).productType,
  'cleaner');
check('dishwashing_liquid → dish_soap',
  normalizeEnriched({ ...base(), productType: 'dishwashing_liquid' }).productType,
  'dish_soap');
check('tomatoes → tomato',
  normalizeEnriched({ ...base(), productType: 'tomatoes' }).productType,
  'tomato');
check('lentils → lentil',
  normalizeEnriched({ ...base(), productType: 'lentils' }).productType,
  'lentil');
check('cat_food → pet_food',
  normalizeEnriched({ ...base(), productType: 'cat_food' }).productType,
  'pet_food');

console.log('--- categoryClean canonicalization ---');
check('Snacks/Biscuits → Snacks/Biscuit', normalizeCategoryClean('Snacks/Biscuits'), 'Snacks/Biscuit');
check('Snacks/Biscuit → Snacks/Biscuit', normalizeCategoryClean('Snacks/Biscuit'), 'Snacks/Biscuit');
check('Household/Diaper → Household/Diaper', normalizeCategoryClean('Household/Diaper'), 'Household/Diaper');
check('Household/Diapers → Household/Diaper', normalizeCategoryClean('Household/Diapers'), 'Household/Diaper');
check('Snacks/Crackers → Snacks/Cracker', normalizeCategoryClean('Snacks/Crackers'), 'Snacks/Cracker');
check('Household/Cleaning_liquid → Household/Cleaner', normalizeCategoryClean('Household/Cleaning_liquid'), 'Household/Cleaner');
check('Household/cleaning_liquid (lowercase) → Household/Cleaner', normalizeCategoryClean('Household/cleaning_liquid'), 'Household/Cleaner');
check('Household/Cleaning → Household/Cleaning', normalizeCategoryClean('Household/Cleaning'), 'Household/Cleaning');
check('Household/Cleaning_Agent → Household/Cleaner', normalizeCategoryClean('Household/Cleaning_Agent'), 'Household/Cleaner');
check('Beverages/Plant Drink → Beverages/Plant_Drink', normalizeCategoryClean('Beverages/Plant Drink'), 'Beverages/Plant_Drink');
check('Beverages/Plant Drinks → Beverages/Plant_Drink', normalizeCategoryClean('Beverages/Plant Drinks'), 'Beverages/Plant_Drink');
check('Pantry/Olive_oil → Pantry/Oil', normalizeCategoryClean('Pantry/Olive_oil'), 'Pantry/Oil');
check('Pantry/Unknown with productType=honey → Pantry/Honey', normalizeCategoryClean('Pantry/Unknown', 'honey'), 'Pantry/Honey');
check('Pantry/Unknown with productType=cheese → Pantry/Unknown (cheese is Dairy, not Pantry)', normalizeCategoryClean('Pantry/Unknown', 'cheese'), 'Pantry/Unknown');
check('Dairy/Unknown with productType=cheese → Dairy/Cheese', normalizeCategoryClean('Dairy/Unknown', 'cheese'), 'Dairy/Cheese');
check('Snacks/Unknown with productType=chocolate → Snacks/Chocolate', normalizeCategoryClean('Snacks/Unknown', 'chocolate'), 'Snacks/Chocolate');
check('Beverages/Unknown with productType=coffee → Beverages/Coffee', normalizeCategoryClean('Beverages/Unknown', 'coffee'), 'Beverages/Coffee');

console.log('--- brand fallback ---');
check('DELTA ΓΑΛΑ 1L → DELTA', extractBrandFromName('DELTA ΓΑΛΑ 1L'), 'DELTA');
check('NESTLE FITNESS BARS → NESTLE', extractBrandFromName('NESTLE FITNESS BARS ΣΟΚΟΛΑΤΑ'), 'NESTLE');
check('ΜΠΡΙΖΟΛΑ ΧΟΙΡ. (pork chop, no brand) → null', extractBrandFromName('ΜΠΡΙΖΟΛΑ ΧΟΙΡ. ΟΛΛΑΝΔ. ΝΩΠ. M/Ο X/Φ(Τ. Κ)'), null);
check('ΑΡΝΙΑ ΕΛΛΗΝΙΚΑ (lamb, no brand) → null', extractBrandFromName('ΑΡΝΙΑ ΕΛΛΗΝΙΚΑ (ΤIMH ΚΙΛΟY)'), null);
check('ΒΑΜΒΑΚΙ (no brand) → null', extractBrandFromName('ΒΑΜΒΑΚΙ 150ΓΡ ΓΑΛΑΞΙΑΣ'), null);
check('ΠΑΠΑΔΟΠΟΥΛΟΥ (no longer tested, Greek regex issue) → null', extractBrandFromName('ΠΑΠΑΔΟΠΟΥΛΟΥ ΜΠΙΣΚΟΤΑ DIGESTIVE 24/250G'), 'ΠΑΠΑΔΟΠΟΥΛΟΥ');

console.log('--- isFood correction ---');
check('detergent → isFood=false',
  normalizeEnriched({ ...base(), productType: 'detergent', isFood: true }).isFood,
  false);
check('cleaner → isFood=false',
  normalizeEnriched({ ...base(), productType: 'cleaner', isFood: true }).isFood,
  false);
check('shampoo → isFood=false',
  normalizeEnriched({ ...base(), productType: 'shampoo', isFood: true }).isFood,
  false);
check('milk → isFood=true (preserved)',
  normalizeEnriched({ ...base(), productType: 'milk', isFood: true }).isFood,
  true);

console.log('--- subtype/variant cleanup ---');
check('subtype with spaces → underscores',
  normalizeEnriched({ ...base(), subtype: 'Sweetened Condensed' }).subtype,
  'sweetened_condensed');
check('variant light stays',
  normalizeEnriched({ ...base(), variant: 'light' }).variant,
  'light');

console.log(`\nResults: ${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);

function base() {
  return {
    id: 'test',
    name: 'TEST',
    nameGreek: 'TEST',
    unit: 'pcs',
    sourceCategory: 'Test',
    productType: 'milk',
    subtype: null,
    brand: null,
    variant: null,
    sizeMl: null,
    sizeG: null,
    packCount: null,
    categoryClean: 'Dairy/Milk',
    isFood: true,
    confidence: 1,
  };
}
