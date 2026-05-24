import * as fs from 'fs';
import * as path from 'path';

// -------- Config --------

// Base URL: local Ollama by default, or Ollama Cloud (https://ollama.com).
// OLLAMA_BASE_URL is the canonical name; OLLAMA_URL kept as alias for back-compat.
const OLLAMA_URL =
  process.env.OLLAMA_BASE_URL || process.env.OLLAMA_URL || 'http://localhost:11434';
// API key for Ollama Cloud (https://ollama.com). Unset for local Ollama.
const OLLAMA_API_KEY = process.env.OLLAMA_API_KEY || '';
const IS_CLOUD = OLLAMA_API_KEY.length > 0 || /ollama\.com/.test(OLLAMA_URL);
const MODEL = process.env.OLLAMA_MODEL || 'qwen2.5:7b';
const CONCURRENCY = parseInt(process.env.CONCURRENCY || (IS_CLOUD ? '10' : '4'), 10);
const TIMEOUT_MS = IS_CLOUD ? 90_000 : 60_000;

const repoRoot = path.resolve(import.meta.dirname, '..', '..', '..');
const scrapedDataPath = path.join(repoRoot, 'scripts', 'crawler', 'data', 'scraped-data.json');
const progressPath = path.join(repoRoot, 'scripts', 'enrich', 'data', 'enriched.jsonl');
const finalPath = path.join(repoRoot, 'src', 'data', 'products-enriched.json');

// -------- Types --------

interface SourceProduct {
  id: string;
  name: string;
  nameGreek: string;
  category: string;
  unit: string;
}

interface EnrichedProduct {
  id: string;
  // Verbatim fields we just copy through:
  name: string;
  nameGreek: string;
  unit: string;
  sourceCategory: string;
  // LLM-derived classification:
  productType: string;          // milk, cheese, chicken, pork, water, ...
  subtype: string | null;       // fresh, condensed, smoked, ground, fillet, ...
  brand: string | null;         // Δέλτα, Vlachas, Lidl, ...
  variant: string | null;       // light, full-fat, organic, gluten-free, ...
  sizeMl: number | null;        // for liquids, null otherwise
  sizeG: number | null;         // for solids, null otherwise
  packCount: number | null;     // pieces per pack ("12/1L" -> 12)
  categoryClean: string;        // "Dairy/Milk", "Meat/Chicken", ...
  isFood: boolean;
  confidence: number;           // 0..1 self-reported by LLM
}

interface LlmClassification {
  productType?: string;
  subtype?: string | null;
  brand?: string | null;
  variant?: string | null;
  sizeMl?: number | null;
  sizeG?: number | null;
  packCount?: number | null;
  categoryClean?: string;
  isFood?: boolean;
  confidence?: number;
}

// -------- Ollama call --------

async function classify(product: SourceProduct): Promise<EnrichedProduct | null> {
  const prompt = buildPrompt(product);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (OLLAMA_API_KEY) headers['Authorization'] = `Bearer ${OLLAMA_API_KEY}`;

    const res = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: systemPrompt() },
          { role: 'user', content: prompt },
        ],
        stream: false,
        format: 'json',
        options: { temperature: 0 },
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      console.warn(`[${product.id}] HTTP ${res.status}`);
      return null;
    }

    const body = (await res.json()) as { message?: { content?: string } };
    const content = body?.message?.content ?? '';
    const parsed = safeJsonParse(content);
    if (!parsed) {
      console.warn(`[${product.id}] could not parse JSON: ${content.slice(0, 200)}`);
      return null;
    }

    return normalize(product, parsed);
  } catch (err: any) {
    clearTimeout(timeoutId);
    console.warn(`[${product.id}] error: ${err?.message || err}`);
    return null;
  }
}

function systemPrompt(): string {
  return `You classify Greek supermarket products into structured JSON. The product name may be Greek (often in CAPS with abbreviations), English, or mixed.

Always return a JSON object with EXACTLY these fields:
{
  "productType": "<lowercase English single word for the core item: milk, cheese, yogurt, butter, cream, chicken, pork, beef, lamb, turkey, fish, shrimp, bread, rusk, pasta, rice, flour, oil, vinegar, sugar, salt, water, juice, soda, coffee, tea, beer, wine, soap, detergent, paper, diaper, chocolate, biscuit, snack, cereal, ...>",
  "subtype": "<optional qualifier: fresh, condensed, sweetened, powdered, evaporated, smoked, cured, ground, fillet, breast, leg, whole, sliced, frozen, ... or null>",
  "brand": "<brand name as it appears, or null if generic>",
  "variant": "<light, full-fat, skim, low-fat, organic, gluten-free, lactose-free, sugar-free, whole-grain, ... or null>",
  "sizeMl": <integer millilitres for liquids, or null>,
  "sizeG": <integer grams for solids, or null>,
  "packCount": <integer if the name says e.g. "12/1L" -> 12, or 1, or null>,
  "categoryClean": "<two-level taxonomy, slash separated, e.g. Dairy/Milk, Dairy/Cheese, Meat/Chicken, Meat/Pork, Beverages/Water, Beverages/Coffee, Bakery/Bread, Snacks/Chocolate, Household/Cleaning, ...>",
  "isFood": <true/false>,
  "confidence": <0..1 number reflecting how sure you are>
}

Critical rules:
- productType is the CORE thing. "ΣΟΚΟΛΑΤΑ ΓΑΛΑΚΤΟΣ" (milk chocolate) -> productType="chocolate", NOT "milk".
- "ΓΑΛΑ ΖΑΧΑΡΟΥΧΟ" (sweetened condensed milk) -> productType="milk", subtype="sweetened_condensed".
- "ΡΟΦΗΜΑ ΑΜΥΓΔΑΛΟ" (almond drink) -> productType="plant_drink", subtype="almond".
- "ΤΥΡΙ ΚΡΕΜΑ" (cream cheese) -> productType="cheese", subtype="cream".
- Packaging codes like "12/1L" mean 12 packs of 1L; set packCount=12, sizeMl=1000.
- "650G" -> sizeG=650. "1. 5L" or "1.5L" -> sizeMl=1500.
- Common Greek abbreviations: ΓΑΛ.=γάλακτος/milk, ΣΟΚ.=σοκολάτα/chocolate, ΦΡΕΣ.=φρέσκο/fresh, ΕΛΑΦΡ.=ελαφρύ/light, ΠΛΗΡΕΣ=full-fat, Υ.Π.=υψηλής παστερίωσης/high-pasteurized, ΑΦ.=αφρόλουτρο/shower-foam, ΓΑΡΟΣ=fish sauce, ΑΛΜΗ=brine, ΚΡΑΝΜΠ.=cranberry, ΡΑΣΜΠ.=raspberry, ΜΠΛΟΥΜΠ.=blueberry.
- Be specific in categoryClean. Use exact slash format, no spaces.

DANGER ZONE — common mistakes to avoid. The product name often contains "γάλα"-related fragments that are NOT milk. Study these:
- "LE PETIT MARSEILLAIS VANILLA ΑΦ. 12/650ML" -> productType="soap", subtype="shower_foam", categoryClean="Household/Soap". "ΑΦ." = αφρόλουτρο (shower foam). NOT milk.
- "ΚΙΣΣΑΣ ΑΛΜΗ ΓΑΡΟΣ 12/1LT" -> productType="fish_sauce", categoryClean="Pantry/Sauce". γάρος is fish sauce / brine. NOT milk.
- "LIFE ΚΡΑΝΜΠ.-ΡΑΣΜΠ.-ΜΠΛΟΥΜΠ. ΜΠ. 12/1L" -> productType="juice", categoryClean="Beverages/Juice". This is a berry juice blend. NOT milk.
- "LACTA ΣΟΚΟΛΑΤΑ ΓΑΛΑΚΤΟΣ 14/85G" -> productType="chocolate", categoryClean="Snacks/Chocolate". A chocolate bar. NOT milk.
- "PHILADELPHIA ΤΥΡΙ ΚΡΕΜΑ 20/200G" -> productType="cheese", subtype="cream", categoryClean="Dairy/Cheese". NOT cream and NOT milk.
- "QUAKER ΤΡΑΓ. ΜΠΟΥΚΙΕΣ ΣΟΚ. ΓΑΛΑΚ. 12/450G" -> productType="cereal", categoryClean="Breakfast/Cereal". A cereal product. NOT milk.

If unsure, lower the confidence. Better confidence=0.4 with correct type than confidence=0.95 with wrong type.

Return ONLY the JSON object. No prose, no markdown.`;
}

function buildPrompt(p: SourceProduct): string {
  const name = p.nameGreek || p.name;
  return `Product name: "${name}"
Source category hint (may be wrong): "${p.category}"
Unit: "${p.unit}"

Classify it.`;
}

function safeJsonParse(s: string): LlmClassification | null {
  // Strip ```json fences if present
  let body = s.trim();
  const fenced = body.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) body = fenced[1].trim();
  // Find first { and last } in case of leading prose
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(body.slice(start, end + 1));
  } catch {
    return null;
  }
}

function normalize(p: SourceProduct, raw: LlmClassification): EnrichedProduct {
  return {
    id: p.id,
    name: p.name,
    nameGreek: p.nameGreek,
    unit: p.unit,
    sourceCategory: p.category,
    productType: String(raw.productType ?? 'unknown').toLowerCase().trim(),
    subtype: raw.subtype != null ? String(raw.subtype).toLowerCase().trim() : null,
    brand: raw.brand != null ? String(raw.brand).trim() : null,
    variant: raw.variant != null ? String(raw.variant).toLowerCase().trim() : null,
    sizeMl: typeof raw.sizeMl === 'number' ? Math.round(raw.sizeMl) : null,
    sizeG: typeof raw.sizeG === 'number' ? Math.round(raw.sizeG) : null,
    packCount: typeof raw.packCount === 'number' ? Math.round(raw.packCount) : null,
    categoryClean: String(raw.categoryClean ?? 'Unknown/Unknown').trim(),
    isFood: raw.isFood !== false,
    confidence:
      typeof raw.confidence === 'number'
        ? Math.max(0, Math.min(1, raw.confidence))
        : 0.5,
  };
}

// -------- Main --------

async function main() {
  console.log('Enrichment pipeline');
  console.log(`Model: ${MODEL} | Concurrency: ${CONCURRENCY} | Ollama: ${OLLAMA_URL}`);
  console.log('---');

  if (!fs.existsSync(scrapedDataPath)) {
    console.error(`Source data not found: ${scrapedDataPath}`);
    console.error('Run the crawler first: cd scripts/crawler && npm run basket');
    process.exit(1);
  }

  const scraped = JSON.parse(fs.readFileSync(scrapedDataPath, 'utf8')) as {
    products: SourceProduct[];
  };
  const allProducts = scraped.products;
  console.log(`Loaded ${allProducts.length} products from scraper output`);

  // Resume from progress file
  fs.mkdirSync(path.dirname(progressPath), { recursive: true });
  const done = new Map<string, EnrichedProduct>();
  if (fs.existsSync(progressPath)) {
    const lines = fs.readFileSync(progressPath, 'utf8').split('\n').filter(Boolean);
    for (const line of lines) {
      try {
        const obj = JSON.parse(line) as EnrichedProduct;
        if (obj?.id) done.set(obj.id, obj);
      } catch {
        /* ignore */
      }
    }
    console.log(`Resume: ${done.size} products already classified`);
  }

  const todo = allProducts.filter((p) => !done.has(p.id));
  console.log(`To classify: ${todo.length}`);

  if (todo.length === 0) {
    console.log('Nothing to do; assembling final file...');
    writeFinal(allProducts, done);
    return;
  }

  const stream = fs.createWriteStream(progressPath, { flags: 'a' });
  let cursor = 0;
  let completed = 0;
  const total = todo.length;
  const startedAt = Date.now();

  async function worker(id: number): Promise<void> {
    while (true) {
      const idx = cursor++;
      if (idx >= todo.length) return;
      const product = todo[idx];

      const enriched = await classify(product);
      completed++;

      if (enriched) {
        done.set(product.id, enriched);
        stream.write(JSON.stringify(enriched) + '\n');
      }

      if (completed % 25 === 0 || completed === total) {
        const elapsed = (Date.now() - startedAt) / 1000;
        const rate = completed / elapsed;
        const eta = rate > 0 ? Math.round((total - completed) / rate) : 0;
        console.log(
          `  [${completed}/${total}] worker=${id} ${enriched?.productType ?? 'FAIL'} ` +
            `(${rate.toFixed(2)}/s, ETA ${Math.floor(eta / 60)}m${eta % 60}s)`
        );
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, (_, i) => worker(i)));
  stream.end();

  writeFinal(allProducts, done);
}

function writeFinal(
  allProducts: SourceProduct[],
  done: Map<string, EnrichedProduct>
): void {
  const enrichedList: EnrichedProduct[] = [];
  let missing = 0;
  for (const p of allProducts) {
    const e = done.get(p.id);
    if (e) {
      enrichedList.push(e);
    } else {
      missing++;
      // Fallback row so the app still knows about the product
      enrichedList.push({
        id: p.id,
        name: p.name,
        nameGreek: p.nameGreek,
        unit: p.unit,
        sourceCategory: p.category,
        productType: 'unknown',
        subtype: null,
        brand: null,
        variant: null,
        sizeMl: null,
        sizeG: null,
        packCount: null,
        categoryClean: 'Unknown/Unknown',
        isFood: true,
        confidence: 0,
      });
    }
  }

  fs.mkdirSync(path.dirname(finalPath), { recursive: true });
  fs.writeFileSync(
    finalPath,
    JSON.stringify(
      {
        enrichedAt: new Date().toISOString().split('T')[0],
        model: MODEL,
        total: enrichedList.length,
        classified: enrichedList.length - missing,
        missing,
        products: enrichedList,
      },
      null,
      2
    )
  );
  console.log(
    `\nWrote ${finalPath}: ${enrichedList.length - missing}/${enrichedList.length} classified (${missing} missing)`
  );
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
