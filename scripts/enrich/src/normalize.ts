// scripts/enrich/src/normalize.ts
//
// Post-processing pass on the LLM's classification output.
//
// Why: the model is consistent in concept but inconsistent in vocabulary.
//   "biscuit" / "biscuits" should both collapse to "biscuit".
//   "cleaning_liquid" / "cleaner" / "cleaning_agent" should all collapse
//     to a single canonical type so the search index works.
//   "Snacks/Biscuit" / "Snacks/Biscuits" / "Bakery/Biscuit" should all
//     map to "Snacks/Biscuit" so the UI filter is meaningful.
//
// The normalizer is deterministic, fast, and safe to re-run. It's applied
// after the LLM response in scripts/enrich/src/index.ts.

// ----------------------------------------------------------------------------
// productType synonyms. Both sides are normalized to lowercase.
// Each key is the raw form, value is the canonical form.
// Duplicates are not allowed — when in doubt, the LATER occurrence wins
// because we read the file bottom-up. Keep entries deduplicated.
// ----------------------------------------------------------------------------
const PRODUCT_TYPE_SYNONYMS: Record<string, string> = {
  // Snack/candy disambiguation
  biscuits: 'biscuit',
  wafer: 'wafer',
  wafers: 'wafer',
  cracker: 'cracker',
  crackers: 'cracker',
  pastry: 'pastry',
  pastries: 'pastry',
  cake: 'cake',
  cakes: 'cake',
  candy: 'candy',
  candies: 'candy',
  sweet: 'sweet',
  sweets: 'sweet',
  snack: 'snack',
  snacks: 'snack',
  chips: 'chips',
  chip: 'chips',
  cereal_bar: 'cereal_bar',
  cereal_bars: 'cereal_bar',
  granola_bar: 'cereal_bar',
  dessert_mix: 'dessert_mix',
  dessert: 'dessert_mix',
  pudding: 'dessert_mix',
  custard: 'dessert_mix',
  halva: 'halva',
  halvas: 'halva',
  spread: 'spread',
  spreads: 'spread',
  chocolate_bar: 'chocolate',
  chocolate_bars: 'chocolate',
  gum: 'gum',
  gums: 'gum',
  chewing_gum: 'gum',

  // Cleaning cluster (the "cleaning_*" explosion)
  cleaning: 'cleaner',
  cleaning_liquid: 'cleaner',
  cleaning_liquid_cleaner: 'cleaner',
  cleaning_agent: 'cleaner',
  cleaning_product: 'cleaner',
  cleaning_spray: 'cleaner',
  cleaning_foam: 'cleaner',
  cleaning_gel: 'cleaner',
  cleaning_cream: 'cleaner',
  cleaning_block: 'toilet_cleaner',
  cleaning_wipe: 'wipes',
  cleaning_pad: 'cleaning_pad',
  cleaning_tool: 'cleaning_tool',
  cleaning_powder: 'cleaning_powder',
  cleaner: 'cleaner',
  cleaners: 'cleaner',
  surface_cleaner: 'cleaner',
  multi_cleaner: 'cleaner',
  glass_cleaner: 'glass_cleaner',
  toilet_cleaner: 'toilet_cleaner',
  air_freshener: 'air_freshener',
  air_freshner: 'air_freshener',

  // Dish
  dish_soap: 'dish_soap',
  dish_wash: 'dish_soap',
  dishwashing_liquid: 'dish_soap',
  dishwashing_gel: 'dish_soap',
  dishwashing: 'dish_soap',
  dishwasher_detergent: 'dishwasher_detergent',
  dishwasher_tablet: 'dishwasher_detergent',
  dishwasher_powder: 'dishwasher_detergent',
  dishwasher_rinse: 'dishwasher_detergent',

  // Laundry
  laundry_detergent: 'laundry_detergent',
  laundry_powder: 'laundry_detergent',
  laundry_liquid: 'laundry_detergent',
  laundry_capsules: 'laundry_detergent',
  fabric_softener: 'fabric_softener',

  // Disinfectant / bleach (chlorine bleach IS a disinfectant)
  disinfectant: 'disinfectant',
  disinfectant_spray: 'disinfectant',
  bleach: 'disinfectant',

  // Personal care
  shampoo: 'shampoo',
  shampoos: 'shampoo',
  conditioner: 'conditioner',
  hair_care: 'shampoo',
  hair_mask: 'conditioner',
  hair_lacquer: 'hairspray',
  hairspray: 'hairspray',
  toothpaste: 'toothpaste',
  toothbrush: 'toothbrush',
  deodorant: 'deodorant',
  razor: 'razor',
  skin_cream: 'cream',

  // Pet
  pet_food: 'pet_food',
  cat_food: 'pet_food',
  dog_food: 'pet_food',
  pet_treat: 'pet_treat',
  pet_treats: 'pet_treat',
  dog_treat: 'pet_treat',
  cat_treat: 'pet_treat',

  // Produce — singular form
  tomatoes: 'tomato',
  canned_tomatoes: 'canned_tomato',
  canned_tomato: 'canned_tomato',
  tomato_juice: 'tomato_juice',
  tomato_paste: 'tomato_paste',
  tomato_sauce: 'tomato_sauce',
  olives: 'olive',
  olive_oil: 'olive_oil',
  lentils: 'lentil',
  chickpea: 'chickpea',
  chickpeas: 'chickpea',
  bean: 'bean',
  beans: 'bean',
  fava: 'fava',
  glove: 'glove',
  gloves: 'glove',
  mushroom: 'mushroom',
  mushrooms: 'mushroom',
  apple: 'apple',
  apples: 'apple',
  potato: 'potato',
  potatoes: 'potato',
  onion: 'onion',
  onions: 'onion',
  carrot: 'carrot',
  carrots: 'carrot',
  pepper: 'pepper',
  peppers: 'pepper',
  eggplant: 'eggplant',
  eggplants: 'eggplant',
  lemon: 'lemon',
  lemons: 'lemon',
  orange: 'orange',
  oranges: 'orange',
  banana: 'banana',
  bananas: 'banana',
  vegetable: 'vegetable',
  vegetables: 'vegetable',
  fruit: 'fruit',
  fruits: 'fruit',

  // Bread/bakery
  bread: 'bread',
  breads: 'bread',
  toast: 'bread',
  baguette: 'bread',
  brioche: 'pastry',
  croissant: 'pastry',
  rusk: 'rusk',
  rusks: 'rusk',
  pita: 'rusk',
  pitta: 'rusk',

  // Frozen → fresh re-classification
  frozen_vegetable: 'vegetable',
  frozen_fruit: 'fruit',
  frozen_fish: 'fish',
  frozen_meat: 'meat',
  frozen_pizza: 'pizza',

  // Breakfast
  cereal: 'cereal',
  cereals: 'cereal',
  muesli: 'cereal',
  granola: 'cereal',
  oats: 'cereal',

  // Plant drink
  plant_drink: 'plant_drink',
  plant_drink_milk: 'plant_drink',
  plant_milk: 'plant_drink',
  almond_milk: 'plant_drink',
  soy_milk: 'plant_drink',
  oat_milk: 'plant_drink',
  rice_milk: 'plant_drink',

  // Eggs
  egg: 'egg',
  eggs: 'egg',

  // Misc cleaning tools
  sponge: 'cleaning_pad',
  sponges: 'cleaning_pad',
  mop: 'cleaning_tool',
  broom: 'cleaning_tool',
  brush: 'cleaning_tool',
  dustbin: 'cleaning_tool',
  bin_bag: 'cleaning_tool',
  trash_bag: 'cleaning_tool',
  foil: 'cleaning_tool',
  cling_film: 'cleaning_tool',
  sandwich_bag: 'cleaning_tool',
  food_bag: 'cleaning_tool',
  cotton: 'cotton',
  wipes: 'wipes',

  // πάπια/duck
  duck: 'duck',
  rabbit: 'rabbit',
  venison: 'game',
  game: 'game',

  // Other drink categories
  soft_drink: 'soda',
  cola: 'soda',
  energy_drink: 'soda',
  sports_drink: 'soda',

  // Misc
  fish_sauce: 'fish_sauce',
  soy_sauce: 'fish_sauce',
  noodles: 'noodles',
  instant_noodles: 'noodles',
  instant_beverage: 'instant_beverage',
  instant_coffee: 'coffee',
  instant_brew: 'instant_beverage',
  protein_powder: 'protein_powder',
  protein_shake: 'protein_drink',
  protein_drink: 'protein_drink',
  protein_bar: 'protein_bar',
  dolmades: 'dolma',
  dolma: 'dolma',
  fruit_puree: 'fruit_puree',
  pizza: 'pizza',
  pizzas: 'pizza',
  pizza_base: 'pizza_base',
};

// ----------------------------------------------------------------------------
// EnrichedProduct shape — the single source of truth. Imported by ./index.
// ----------------------------------------------------------------------------
export interface EnrichedProduct {
  id: string;
  name: string;
  nameGreek: string;
  unit: string;
  sourceCategory: string;
  productType: string;
  subtype: string | null;
  brand: string | null;
  variant: string | null;
  sizeMl: number | null;
  sizeG: number | null;
  packCount: number | null;
  categoryClean: string;
  isFood: boolean;
  confidence: number;
}

// ----------------------------------------------------------------------------
// productType synonyms. Both sides are normalized to lowercase.
// Each key is the raw form, value is the canonical form.
// Duplicates are not allowed — when in doubt, the LATER occurrence wins
// because we read the file bottom-up. Keep entries deduplicated.
// ----------------------------------------------------------------------------
const CATEGORY_TOP_CANONICAL: Record<string, string> = {
  beverage: 'Beverages',
  beverages: 'Beverages',
  drink: 'Beverages',
  drinks: 'Beverages',
  dairy: 'Dairy',
  meat: 'Meat',
  fish: 'Meat', // fish is "Meat/Fish"
  seafood: 'Meat',
  produce: 'Produce',
  vegetable: 'Produce',
  vegetables: 'Produce',
  fruit: 'Produce',
  fruits: 'Produce',
  pantry: 'Pantry',
  bakery: 'Bakery',
  snack: 'Snacks',
  snacks: 'Snacks',
  breakfast: 'Breakfast',
  household: 'Household',
  cleaning: 'Household',
  hygiene: 'Personal_Care',
  'personal-care': 'Personal_Care',
  'personal care': 'Personal_Care',
  baby: 'Baby',
  pet: 'Pet',
  pets: 'Pet',
  frozen: 'Pantry', // ambiguous; default
  canned: 'Pantry',
  general: 'Household', // catch-all sourceCategory
  staples: 'Pantry',
  'unknown': 'Unknown',
};

const CATEGORY_SUB_SYNONYMS: Record<string, string> = {
  // Snacks — fix plural
  biscuit: 'Biscuit',
  biscuits: 'Biscuit',
  cracker: 'Cracker',
  crackers: 'Cracker',
  chocolate: 'Chocolate',
  chocolate_bar: 'Chocolate',
  candy: 'Candy',
  candies: 'Candy',
  sweet: 'Sweet',
  sweets: 'Sweet',
  gum: 'Gum',
  gums: 'Gum',
  spread: 'Spread',
  spreads: 'Spread',
  chips: 'Chips',
  cereal_bar: 'Cereal_Bar',
  cereal_bars: 'Cereal_Bar',
  halva: 'Halva',

  // Beverages
  coffee: 'Coffee',
  tea: 'Tea',
  water: 'Water',
  juice: 'Juice',
  soda: 'Soda',
  soft_drink: 'Soda',
  cola: 'Soda',
  beer: 'Beer',
  wine: 'Wine',
  plant_drink: 'Plant_Drink',
  'plant drink': 'Plant_Drink',
  'plant drinks': 'Plant_Drink',
  plant_milk: 'Plant_Drink',

  // Dairy
  milk: 'Milk',
  cheese: 'Cheese',
  yogurt: 'Yogurt',
  butter: 'Butter',

  // Meat
  chicken: 'Chicken',
  pork: 'Pork',
  beef: 'Beef',
  lamb: 'Lamb',
  turkey: 'Turkey',
  fish: 'Fish',
  shrimp: 'Shrimp',
  seafood: 'Fish',

  // Pantry
  pasta: 'Pasta',
  rice: 'Rice',
  flour: 'Flour',
  oil: 'Oil',
  olive_oil: 'Oil',
  vinegar: 'Vinegar',
  sugar: 'Sugar',
  salt: 'Salt',
  sauce: 'Sauce',
  spice: 'Spice',
  spices: 'Spice',
  legume: 'Legume',
  legumes: 'Legume',
  grain: 'Grain',
  grains: 'Grain',
  dessert_mix: 'Dessert_Mix',
  vegetable: 'Vegetable',
  vegetables: 'Vegetable',
  canned_tomato: 'Tomato',
  canned_fish: 'Fish',
  ketchup: 'Ketchup',
  mustard: 'Mustard',
  mayonnaise: 'Mayonnaise',
  honey: 'Honey',
  broth: 'Broth',
  stock: 'Broth',
  jam: 'Jam',
  marmalade: 'Jam',
  soup: 'Soup',
  salad: 'Salad',
  egg: 'Egg',
  eggs: 'Egg',
  noodles: 'Noodles',
  ice_cream: 'Ice_Cream',
  pizza: 'Pizza',
  tomato: 'Tomato',
  tomatoes: 'Tomato',
  tomato_paste: 'Tomato_Paste',
  potato: 'Potato',
  potatoes: 'Potato',
  olive: 'Olive',
  olives: 'Olive',
  sweetener: 'Sweetener',
  nuts: 'Nuts',
  nut: 'Nuts',
  dried_fruit: 'Dried_Fruit',
  peanut_butter: 'Peanut_Butter',
  condiment: 'Condiment',
  dressings: 'Dressing',
  dressing: 'Dressing',
  extracts: 'Extract',
  extract: 'Extract',
  syrup: 'Syrup',
  baking: 'Baking',

  // Bakery
  bread: 'Bread',
  rusk: 'Rusk',
  pita: 'Rusk',
  pastry: 'Pastry',
  cake: 'Cake',

  // Breakfast
  cereal: 'Cereal',
  cereals: 'Cereal',

  // Household
  cleaning: 'Cleaning',
  soap: 'Soap',
  detergent: 'Detergent',
  laundry: 'Laundry',
  laundry_detergent: 'Laundry',
  fabric_softener: 'Fabric_Softener',
  toilet_cleaner: 'Toilet_Cleaner',
  glass_cleaner: 'Glass_Cleaner',
  disinfectant: 'Disinfectant',
  bleach: 'Disinfectant',
  dish_soap: 'Dishwasher',
  dishwasher: 'Dishwasher',
  dishwasher_detergent: 'Dishwasher',
  paper: 'Paper',
  sponge: 'Sponge',
  tool: 'Tool',
  tools: 'Tool',
  air_freshener: 'Air_Freshener',
  cleaning_pad: 'Sponge',
  cleaning_tool: 'Tool',
  cleaning_liquid: 'Cleaner',
  cleaning_agent: 'Cleaner',
  cleaning_product: 'Cleaner',

  // Personal care
  shampoo: 'Shampoo',
  conditioner: 'Conditioner',
  toothpaste: 'Toothpaste',
  deodorant: 'Deodorant',
  razor: 'Razor',
  cotton: 'Cotton',
  wipes: 'Wipes',
  mask: 'Mask',
  cream: 'Cream',
  body_lotion: 'Lotion',
  shaving_cream: 'Shaving_Cream',
  after_shave: 'After_Shave',
  mouthwash: 'Mouthwash',
  tampon: 'Tampon',
  condom: 'Condom',
  toothbrush: 'Toothbrush',
  depilation: 'Depilatory',
  talc: 'Talc',

  // Baby
  diaper: 'Diaper',
  diapers: 'Diaper',
  formula: 'Formula',
  toiletry: 'Toiletry',

  // Pet
  pet_food: 'Food',
  pet_treat: 'Treat',
  pet_treats: 'Treat',
  chew: 'Treat',
  chews: 'Treat',
  food: 'Food',
  treat: 'Treat',
  treats: 'Treat',

  // Produce
  apple: 'Apple',
  onion: 'Onion',
  mushroom: 'Mushroom',
  mushrooms: 'Mushroom',
  fruit: 'Fruit',

  // Unknown
  unknown: 'Unknown',
};

/**
 * Lookup table: when the LLM gives us {Top}/Unknown and the productType is
 * well-known, infer a sensible sub from productType. Format:
 *   TYPE_TO_SUB_FALLBACK[productType][topCategory] = sub
 */
const TYPE_TO_SUB_FALLBACK: Record<string, Record<string, string>> = {
  honey: { Pantry: 'Honey', Snacks: 'Sweet' },
  mayonnaise: { Pantry: 'Mayonnaise' },
  broth: { Pantry: 'Broth' },
  stock: { Pantry: 'Broth' },
  bean: { Pantry: 'Legume' },
  beans: { Pantry: 'Legume' },
  lentil: { Pantry: 'Legume' },
  lentils: { Pantry: 'Legume' },
  chickpea: { Pantry: 'Legume' },
  chickpeas: { Pantry: 'Legume' },
  jam: { Pantry: 'Jam' },
  marmalade: { Pantry: 'Jam' },
  egg: { Pantry: 'Egg' },
  eggs: { Pantry: 'Egg' },
  soup: { Pantry: 'Soup' },
  mustard: { Pantry: 'Mustard' },
  ketchup: { Pantry: 'Ketchup' },
  ice_cream: { Pantry: 'Ice_Cream' },
  salad: { Pantry: 'Salad' },
  noodles: { Pantry: 'Noodles' },
  pizza: { Pantry: 'Pizza' },
  tomato_paste: { Pantry: 'Tomato_Paste' },
  canned_tomato: { Pantry: 'Tomato' },
  canned_tomatoes: { Pantry: 'Tomato' },
  olive: { Pantry: 'Olive' },
  olives: { Pantry: 'Olive' },
  canned_fish: { Pantry: 'Fish' },
  canned_vegetables: { Pantry: 'Vegetable' },
  canned: { Pantry: 'Canned' },
  dressings: { Pantry: 'Dressing' },
  dressing: { Pantry: 'Dressing' },
  condiment: { Pantry: 'Condiment' },
  sweetener: { Pantry: 'Sweetener' },
  nuts: { Pantry: 'Nuts' },
  nut: { Pantry: 'Nuts' },
  dried_fruit: { Pantry: 'Dried_Fruit' },
  peanut_butter: { Pantry: 'Peanut_Butter' },
  tofu: { Pantry: 'Legume' },
  falafel: { Pantry: 'Legume' },
  extract: { Pantry: 'Extract' },
  syrup: { Pantry: 'Syrup' },
  vinegar: { Pantry: 'Vinegar' },
  rice: { Pantry: 'Rice' },
  flour: { Pantry: 'Flour' },
  pasta: { Pantry: 'Pasta' },
  oil: { Pantry: 'Oil' },
  olive_oil: { Pantry: 'Oil' },
  salt: { Pantry: 'Salt' },
  sugar: { Pantry: 'Sugar' },
  spice: { Pantry: 'Spice' },
  spices: { Pantry: 'Spice' },
  grain: { Pantry: 'Grain' },
  grains: { Pantry: 'Grain' },
  cereal: { Pantry: 'Cereal', Breakfast: 'Cereal' },
  muesli: { Pantry: 'Cereal', Breakfast: 'Cereal' },
  granola: { Pantry: 'Cereal', Breakfast: 'Cereal' },
  oats: { Pantry: 'Cereal', Breakfast: 'Cereal' },
  // Personal care
  toothpaste: { Personal_Care: 'Toothpaste', Household: 'Toothpaste' },
  razor: { Personal_Care: 'Razor', Household: 'Razor' },
  shampoo: { Personal_Care: 'Shampoo', Household: 'Shampoo' },
  conditioner: { Personal_Care: 'Conditioner', Household: 'Conditioner' },
  deodorant: { Personal_Care: 'Deodorant', Household: 'Deodorant' },
  toothbrush: { Personal_Care: 'Toothbrush', Household: 'Toothbrush' },
  cotton: { Personal_Care: 'Cotton', Household: 'Cotton' },
  wipes: { Personal_Care: 'Wipes', Baby: 'Wipes', Household: 'Wipes' },
  wet_wipe: { Personal_Care: 'Wipes', Baby: 'Wipes', Household: 'Wipes' },
  mask: { Personal_Care: 'Mask', Household: 'Mask' },
  // Meat
  chicken: { Meat: 'Chicken' },
  pork: { Meat: 'Pork' },
  beef: { Meat: 'Beef' },
  lamb: { Meat: 'Lamb' },
  turkey: { Meat: 'Turkey' },
  fish: { Meat: 'Fish' },
  shrimp: { Meat: 'Shrimp' },
  // Dairy
  milk: { Dairy: 'Milk' },
  cheese: { Dairy: 'Cheese' },
  yogurt: { Dairy: 'Yogurt' },
  butter: { Dairy: 'Butter' },
  // Beverages
  water: { Beverages: 'Water' },
  juice: { Beverages: 'Juice' },
  soda: { Beverages: 'Soda' },
  coffee: { Beverages: 'Coffee' },
  tea: { Beverages: 'Tea' },
  beer: { Beverages: 'Beer' },
  wine: { Beverages: 'Wine' },
  plant_drink: { Beverages: 'Plant_Drink' },
  // Snacks
  biscuit: { Snacks: 'Biscuit', Bakery: 'Biscuit' },
  biscuits: { Snacks: 'Biscuit' },
  wafer: { Snacks: 'Wafer' },
  crackers: { Snacks: 'Cracker', Bakery: 'Cracker' },
  chocolate: { Snacks: 'Chocolate' },
  spread: { Snacks: 'Spread', Pantry: 'Spread' },
  halva: { Snacks: 'Halva' },
  sweet: { Snacks: 'Sweet' },
  pastry: { Snacks: 'Pastry', Bakery: 'Pastry' },
  cake: { Snacks: 'Cake', Bakery: 'Cake' },
  cereal_bar: { Snacks: 'Cereal_Bar' },
  // Bakery
  bread: { Bakery: 'Bread' },
  rusk: { Bakery: 'Rusk' },
  // Household
  detergent: { Household: 'Detergent' },
  cleaner: { Household: 'Cleaner' },
  glass_cleaner: { Household: 'Glass_Cleaner' },
  toilet_cleaner: { Household: 'Toilet_Cleaner' },
  dish_soap: { Household: 'Dishwasher' },
  dishwasher_detergent: { Household: 'Dishwasher' },
  laundry_detergent: { Household: 'Laundry' },
  fabric_softener: { Household: 'Fabric_Softener' },
  disinfectant: { Household: 'Disinfectant' },
  air_freshener: { Household: 'Air_Freshener' },
  soap: { Household: 'Soap' },
  paper: { Household: 'Paper' },
  diaper: { Household: 'Diaper', Baby: 'Diaper' },
  cleaning_tool: { Household: 'Tool' },
  cleaning_pad: { Household: 'Sponge' },
  // Pet
  pet_food: { Pet: 'Food' },
  pet_treat: { Pet: 'Treat' },
  // Baby
  infant_formula: { Baby: 'Formula' },
  // Personal care
  shaving_cream: { Personal_Care: 'Shaving_Cream' },
  after_shave: { Personal_Care: 'After_Shave' },
  body_lotion: { Personal_Care: 'Lotion' },
  depilation: { Personal_Care: 'Depilatory' },
  talc: { Personal_Care: 'Talc' },
  // Produce fallback
  tomato: { Produce: 'Tomato', Pantry: 'Tomato' },
  potatoes: { Produce: 'Potato', Pantry: 'Potato' },
  lemon: { Produce: 'Lemon' },
  apple: { Produce: 'Apple' },
  orange: { Produce: 'Orange' },
  banana: { Produce: 'Banana' },
  mushroom: { Produce: 'Mushroom' },
  // Pantry extras (some keys already in main fallback above)
  sausage: { Pantry: 'Sausage', Meat: 'Sausage' },
  tomato_juice: { Beverages: 'Juice' },
  margarine: { Pantry: 'Margarine' },
  ham: { Pantry: 'Ham', Meat: 'Ham' },
  tuna: { Pantry: 'Fish' },
  squid: { Pantry: 'Fish', Meat: 'Fish' },
  camping_stove: { Household: 'Tool' },
  glove: { Household: 'Tool' },
  jelly: { Snacks: 'Sweet' },
  cream: { Dairy: 'Cream', Personal_Care: 'Cream' },
  condom: { Personal_Care: 'Condom', Household: 'Condom' },
  mouthwash: { Personal_Care: 'Mouthwash', Household: 'Mouthwash' },
  tampon: { Personal_Care: 'Tampon', Household: 'Tampon' },
  // additional produces
  eggplant: { Produce: 'Eggplant' },
  potato: { Produce: 'Potato', Pantry: 'Potato' },
  spinach: { Produce: 'Spinach' },
  pumpkin: { Produce: 'Pumpkin' },
  chestnut: { Produce: 'Chestnut' },
  cucumber: { Produce: 'Cucumber' },
  cooking_stove: { Household: 'Tool' },
  lighter_fluid: { Household: 'Tool' },
  dough: { Pantry: 'Dough' },
  insecticide: { Household: 'Insecticide' },
  instant_beverage: { Beverages: 'Instant' },
  protein_bar: { Snacks: 'Cereal_Bar' },
  tahini: { Pantry: 'Sauce' },
  battery: { Household: 'Battery' },
  bar: { Snacks: 'Cereal_Bar' },
  bandage: { Personal_Care: 'Bandage', Household: 'Bandage' },
  spirit: { Beverages: 'Spirit' },
  // snacks
  snacks: { Snacks: 'Chips' },
  snack_mix: { Snacks: 'Chips' },
  // Default fallback: best-guess top category
  default: { Unknown: 'Unknown' },
};

/**
 * If both top and sub are Unknown, infer top from productType.
 * This rescues cases where the LLM gave up entirely.
 */
function inferTopFromProductType(productType: string): string | null {
  const pt = productType.toLowerCase();
  const FOOD_TOP_TYPES = new Set([
    'milk', 'cheese', 'yogurt', 'butter', 'cream', 'ice_cream',
    'chicken', 'pork', 'beef', 'lamb', 'turkey', 'fish', 'shrimp',
    'pasta', 'rice', 'flour', 'oil', 'olive_oil', 'vinegar', 'sugar',
    'salt', 'honey', 'jam', 'soup', 'broth', 'mustard', 'mayonnaise',
    'ketchup', 'salad', 'noodles', 'pizza', 'cereal', 'muesli',
    'water', 'juice', 'soda', 'coffee', 'tea', 'beer', 'wine',
    'plant_drink', 'biscuit', 'wafer', 'cracker', 'chocolate',
    'spread', 'halva', 'pastry', 'cake', 'candy', 'gum', 'sweet',
    'bread', 'rusk', 'snack', 'tomato', 'potato', 'onion', 'apple',
    'lemon', 'orange', 'banana', 'mushroom', 'pepper', 'carrot',
    'pepper', 'lentil', 'bean', 'chickpea', 'olive', 'fava',
  ]);
  const HOUSEHOLD_TOP_TYPES = new Set([
    'soap', 'shampoo', 'conditioner', 'toothpaste', 'toothbrush',
    'deodorant', 'razor', 'cotton', 'wipes', 'detergent', 'cleaner',
    'glass_cleaner', 'toilet_cleaner', 'dish_soap', 'dishwasher_detergent',
    'laundry_detergent', 'fabric_softener', 'disinfectant', 'air_freshener',
    'cleaning_tool', 'cleaning_pad', 'hairspray', 'mask', 'tampon',
    'condom', 'mouthwash', 'shaving_cream', 'after_shave', 'body_lotion',
    'depilation', 'talc', 'paper', 'diaper',
  ]);
  const PET_TOP_TYPES = new Set(['pet_food', 'pet_treat', 'cat_food', 'dog_food', 'dog_treat', 'cat_treat']);
  const BABY_TOP_TYPES = new Set(['infant_formula', 'baby_food', 'baby_wipes']);

  if (FOOD_TOP_TYPES.has(pt)) return 'Pantry';
  if (HOUSEHOLD_TOP_TYPES.has(pt)) return 'Household';
  if (PET_TOP_TYPES.has(pt)) return 'Pet';
  if (BABY_TOP_TYPES.has(pt)) return 'Baby';
  return null;
}

/**
 * Normalize a categoryClean string to "{Top}/{Sub}" canonical form.
 * If the sub is "Unknown" and we know the productType, fall back to a
 * type-based sub lookup.
 *
 * @param input The raw categoryClean from the LLM
 * @param productTypeHint Optional productType to use as fallback when sub is unknown
 */
export function normalizeCategoryClean(
  input: string | null | undefined,
  productTypeHint?: string
): string {
  if (!input) return 'Unknown/Unknown';
  const cleaned = String(input).trim().replace(/\s*\/\s*/g, '/');
  if (!cleaned || cleaned === '/') return 'Unknown/Unknown';

  const [rawTop, rawSub] = cleaned.split('/');
  let top = CATEGORY_TOP_CANONICAL[(rawTop || '').toLowerCase()] ?? 'Unknown';
  let sub = CATEGORY_SUB_SYNONYMS[(rawSub || '').toLowerCase()] ?? 'Unknown';
  // Fallback 1: top is Unknown, infer from productType
  if (top === 'Unknown' && productTypeHint) {
    const inferred = inferTopFromProductType(productTypeHint);
    if (inferred) top = inferred;
  }
  // Fallback 2: sub is Unknown, derive sub from productType
  if (sub === 'Unknown' && productTypeHint) {
    const fallback = TYPE_TO_SUB_FALLBACK[productTypeHint.toLowerCase()];
    if (fallback && fallback[top]) {
      sub = fallback[top];
    }
  }
  return `${top}/${sub}`;
}

// ----------------------------------------------------------------------------
// Brand extraction fallback — fill missing brand from the name regex.
// Greek product names often have a brand in CAPS at the start: "DELTA ΓΑΛΑ 1L"
// We capture the FIRST all-caps word only — multi-word brands like
// "LE PETIT MARSEILLAIS" or "ALFA" are rare in this dataset and the LLM
// usually catches them. The first-word heuristic is the most robust.
// ----------------------------------------------------------------------------
const BRAND_REGEXES: RegExp[] = [
  // Greek all-caps word of 3+ letters (Unicode boundary via lookahead)
  /^([A-ZΑ-Ω]{3,})(?=\s|$|[^A-ZΑ-Ω0-9])/u,
  // English/Latin all-caps word of 3+ chars (allow ' and &)
  /^([A-Z][A-Z0-9'\-&]{2,})(?=\s|$|[^A-Z0-9'\-&])/,
];

const BRAND_STOP_WORDS = new Set([
  'ΚΑΙ', 'ΜΕ', 'ΓΙΑ', 'ΑΠΟ', 'ΧΩΡΙΣ', 'EXTRA', 'ΝΕΟ', 'LIGHT', 'BIO',
  'PLUS', 'SUPER', 'TOP', 'NEW', 'PRO', 'MAX', 'MINI', 'ΒΑΜΒΑΚΙ',
  // Common Greek product descriptors (NOT brands) that often appear first
  'ΜΠΡΙΖΟΛΑ', 'ΑΡΝΙΑ', 'ΧΟΙΡΙΝΟΣ', 'ΒΟΕΙΟΝ', 'ΜΕΛΙΤΖΑΝΑ', 'ΜΕΛΙΤΖΑΝΕΣ',
  'ΠΑΤΑΤΕΣ', 'ΚΡΕΜΜΥΔΙΑ', 'ΛΕΜΟΝΙΑ', 'ΝΤΟΜΑΤΕΣ', 'ΤΟΜΑΤΕΣ', 'ΜΗΛΑ',
  'ΠΟΡΤΟΚΑΛΙΑ', 'ΜΠΑΝΑΝΕΣ', 'ΚΑΡΟΤΑ', 'ΑΧΛΑΔΙΑ', 'ΣΤΑΦΥΛΙΑ', 'ΦΡΑΟΥΛΕΣ',
  'ΣΠΑΛΑ', 'ΚΙΛΟΤΟ', 'ΛΑΠΑ', 'ΣΤΗΘΟΣ', 'ΜΠΟΥΤΙ', 'ΣΟΥΒΛΑΚΙ',
  'ΦΙΛΕΤΟ', 'ΦΕΤΕΣ', 'ΨΑΡΙ', 'ΓΑΡΙΔΕΣ', 'ΚΑΛΑΜΑΡΙ', 'ΧΤΑΠΟΔΙ',
  'ΚΟΤΟΠΟΥΛΟ', 'ΓΑΛΟΠΟΥΛΑ', 'ΛΟΥΚΑΝΙΚΟ', 'ΜΠΕΪΚΟΝ', 'ΖΑΜΠΟΝ',
  'ΤΥΡΙ', 'ΓΙΑΟΥΡΤΙ', 'ΓΑΛΑ', 'ΒΟΥΤΥΡΟ', 'ΨΩΜΙ', 'ΚΡΟΥΑΣΑΝ',
  'ΣΟΚΟΛΑΤΑ', 'ΜΠΙΣΚΟΤΑ', 'ΚΡΑΚΕΡ', 'ΠΑΣΤΑ', 'ΖΥΜΑΡΙΚΑ', 'ΡΥΖΙ',
  'ΑΛΕΥΡΙ', 'ΛΑΔΙ', 'ΕΛΑΙΟΛΑΔΟ', 'ΞΥΔΙ', 'ΑΛΑΤΙ', 'ΖΑΧΑΡΗ',
  'ΚΑΦΕΣ', 'ΤΣΑΙ', 'ΝΕΡΟ', 'ΧΥΜΟΣ', 'ΑΝΑΨΥΚΤΙΚΟ', 'ΚΡΑΣΙ', 'ΜΠΥΡΑ',
]);

/** Extract a brand guess from the product name. Returns null if nothing looks like a brand. */
export function extractBrandFromName(name: string | null | undefined): string | null {
  if (!name) return null;
  const trimmed = name.trim();
  for (const re of BRAND_REGEXES) {
    const m = trimmed.match(re);
    if (m) {
      const candidate = m[1].trim();
      if (!BRAND_STOP_WORDS.has(candidate)) {
        return candidate;
      }
    }
  }
  return null;
}

// ----------------------------------------------------------------------------
// productTypes that are always non-food (used to fix isFood flag)
// ----------------------------------------------------------------------------
const HOUSEHOLD_TYPES = new Set<string>([
  'soap', 'shampoo', 'conditioner', 'toothpaste', 'toothbrush', 'deodorant',
  'razor', 'cream', 'cotton', 'wipes', 'detergent', 'cleaner',
  'glass_cleaner', 'toilet_cleaner', 'dish_soap', 'dishwasher_detergent',
  'laundry_detergent', 'fabric_softener', 'disinfectant', 'air_freshener',
  'cleaning_tool', 'cleaning_pad', 'hairspray', 'mask', 'cleaning_powder',
]);

// ----------------------------------------------------------------------------
// Main entry: normalize a single EnrichedProduct in place and return it.
// ----------------------------------------------------------------------------
export function normalizeEnriched(p: EnrichedProduct): EnrichedProduct {
  // 1. productType
  const rawType = (p.productType || '').toLowerCase().trim();
  const canonType = PRODUCT_TYPE_SYNONYMS[rawType] ?? rawType;
  p.productType = canonType || 'unknown';

  // 2. categoryClean (use productType as fallback when sub is Unknown)
  p.categoryClean = normalizeCategoryClean(p.categoryClean, p.productType);

  // 3. subtype — collapse to snake_case
  if (p.subtype) {
    p.subtype = p.subtype
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_/-]/g, '');
  }

  // 4. variant — same
  if (p.variant) {
    p.variant = p.variant
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_/-]/g, '');
  }

  // 5. brand fallback
  if (!p.brand && p.nameGreek) {
    const guess = extractBrandFromName(p.nameGreek);
    if (guess) p.brand = guess;
  }

  // 6. isFood sanity for known non-food types
  if (HOUSEHOLD_TYPES.has(p.productType)) {
    p.isFood = false;
  }

  return p;
}
