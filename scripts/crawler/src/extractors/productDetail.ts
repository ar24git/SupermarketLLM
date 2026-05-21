import { Page, Browser } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import { CONFIG } from '../config.js';
import { newPage } from '../browser.js';

export interface ProductPriceDetail {
  productId: string;
  productName: string;
  retailerPrices: Array<{ retailerName: string; price: number }>;
}

/**
 * Scrape per-retailer prices from a product detail page.
 * Each .product-market-container has a retailer logo img + name text + .product-price-number
 */
export async function scrapeProductDetail(
  page: Page,
  productId: string,
  debug = false
): Promise<ProductPriceDetail | null> {
  const url = `${CONFIG.baseUrl}/product/${productId}`;

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20_000 });
    await page.waitForSelector('.product-market-container, .product-name', { timeout: 8_000 }).catch(() => {});

    const data = await page.evaluate(`
      (function() {
        // Get product name
        var nameEl = document.querySelector('p.product-name, h1, .product-title');
        var productName = nameEl ? nameEl.textContent.trim() : '';

        // Each .product-market-container holds one retailer's price
        var containers = document.querySelectorAll('.product-market-container');
        var prices = [];
        for (var i = 0; i < containers.length; i++) {
          var c = containers[i];
          var img = c.querySelector('img');
          var retailerName = '';

          // The retailer name is text in the container (not the price text)
          var textNodes = c.querySelectorAll('div, span, p');
          for (var j = 0; j < textNodes.length; j++) {
            var t = textNodes[j].textContent.trim();
            if (t && !t.match(/^[\\d.,]+\\s*€/) && !t.match(/€\\s*ανά/) && t.length < 50 && t.length > 1) {
              retailerName = t;
              break;
            }
          }

          // Fallback: get name from logo image filename
          if (!retailerName && img) {
            var src = img.src || '';
            var filename = src.split('/').pop().replace('.png', '').replace('.jpg', '');
            retailerName = filename;
          }

          // Get price from .product-price-number
          var priceEl = c.querySelector('.product-price-number');
          var priceText = priceEl ? priceEl.textContent.trim() : '';
          var price = parseFloat(priceText.replace('€', '').replace(',', '.').trim());

          if (retailerName && !isNaN(price) && price > 0) {
            prices.push({ retailerName: retailerName, price: price });
          }
        }

        return { productName: productName, prices: prices };
      })()
    `) as { productName: string; prices: Array<{ retailerName: string; price: number }> };

    if (debug && data.prices.length > 0) {
      console.log(`  ${data.productName}: ${data.prices.length} retailers`);
    }

    return {
      productId,
      productName: data.productName,
      retailerPrices: data.prices,
    };
  } catch (err) {
    if (debug) console.log(`  Failed to scrape product ${productId}: ${err}`);
    return null;
  }
}

/**
 * Scrape per-retailer prices for multiple products, with rate limiting
 */
export async function scrapeProductDetails(
  page: Page,
  productIds: string[],
  debug = false,
  delayMs = 2000
): Promise<ProductPriceDetail[]> {
  const results: ProductPriceDetail[] = [];

  for (let i = 0; i < productIds.length; i++) {
    const id = productIds[i];
    if ((i + 1) % 10 === 0 || i === 0) {
      console.log(`  [${i + 1}/${productIds.length}] Scraping product ${id}...`);
    }

    const detail = await scrapeProductDetail(page, id, debug);
    if (detail && detail.retailerPrices.length > 0) {
      results.push(detail);
    }

    // Rate limiting
    if (i < productIds.length - 1) {
      await page.waitForTimeout(delayMs);
    }
  }

  return results;
}

/**
 * Scrape product detail pages in parallel using N worker pages.
 * Supports resume via a JSONL progress file: each completed product is appended
 * as a single line. On restart, already-seen IDs are skipped.
 */
export async function scrapeProductDetailsParallel(
  headless: boolean,
  productIds: string[],
  concurrency: number,
  progressPath: string,
  debug = false
): Promise<ProductPriceDetail[]> {
  fs.mkdirSync(path.dirname(progressPath), { recursive: true });

  const done = new Map<string, ProductPriceDetail>();
  if (fs.existsSync(progressPath)) {
    const lines = fs.readFileSync(progressPath, 'utf8').split('\n').filter(Boolean);
    for (const line of lines) {
      try {
        const entry = JSON.parse(line) as ProductPriceDetail;
        if (entry?.productId) done.set(entry.productId, entry);
      } catch { /* ignore malformed line */ }
    }
    console.log(`Resume: found ${done.size} already-scraped products in ${progressPath}`);
  }

  const todo = productIds.filter((id) => !done.has(id));
  console.log(`To scrape: ${todo.length} (skipping ${productIds.length - todo.length} already done)`);

  if (todo.length === 0) return [...done.values()];

  // Shared queue
  let cursor = 0;
  let completed = 0;
  const total = todo.length;
  const progressStream = fs.createWriteStream(progressPath, { flags: 'a' });

  const startedAt = Date.now();

  async function worker(workerId: number): Promise<void> {
    const page = await newPage(headless);
    try {
      while (true) {
        const idx = cursor++;
        if (idx >= todo.length) break;
        const id = todo[idx];

        const detail = await scrapeProductDetail(page, id, debug);
        completed++;

        if (detail && detail.retailerPrices.length > 0) {
          done.set(id, detail);
          progressStream.write(JSON.stringify(detail) + '\n');
        }

        if (completed % 20 === 0 || completed === total) {
          const elapsed = (Date.now() - startedAt) / 1000;
          const rate = completed / elapsed;
          const eta = rate > 0 ? Math.round((total - completed) / rate) : 0;
          console.log(
            `  [${completed}/${total}] worker=${workerId} id=${id} ` +
            `(${rate.toFixed(2)}/s, ETA ${Math.floor(eta / 60)}m${eta % 60}s)`
          );
        }
      }
    } finally {
      await page.context().close().catch(() => {});
    }
  }

  await Promise.all(Array.from({ length: concurrency }, (_, i) => worker(i)));
  progressStream.end();

  return [...done.values()];
}
