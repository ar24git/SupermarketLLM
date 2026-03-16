import { Page } from 'playwright';
import { CONFIG } from '../config.js';

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
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.waitForTimeout(3_000);

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
