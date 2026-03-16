import { Page } from 'playwright';
import { CONFIG } from '../config.js';

export interface RawBasketProduct {
  name: string;
  category: string;
  prices: Record<string, number | null>; // chainName -> price
}

export interface BasketScrapeResult {
  products: RawBasketProduct[];
  chainNames: string[];
  scrapedAt: string;
}

export async function scrapeHouseholdBasket(
  page: Page,
  debug = false
): Promise<BasketScrapeResult> {
  const url = `${CONFIG.baseUrl}${CONFIG.householdBasketPath}`;
  console.log(`Navigating to ${url}...`);

  await page.goto(url, { waitUntil: 'networkidle' });
  console.log('Waiting for Ember app to load data...');
  await page.waitForTimeout(8_000);

  // Step 1: Discover Ember store structure
  console.log('Exploring Ember data store...');
  const storeInfo = await page.evaluate(() => {
    const w = window as any;
    if (!w.Ember?.Namespace?.NAMESPACES_BY_ID) return null;

    const appKey = Object.keys(w.Ember.Namespace.NAMESPACES_BY_ID)
      .find((k: string) => k.includes('katanalotis'));
    if (!appKey) return null;

    const container = w.Ember.Namespace.NAMESPACES_BY_ID[appKey]?.__container__;
    if (!container) return null;

    const store = container.cache?.['service:store'] || container.lookup?.('service:store');
    if (!store) return null;

    const arrays = store.recordArrayManager?._liveRecordArrays;
    if (!arrays?.product?.content) return null;

    const records = Array.from(arrays.product.content) as any[];
    if (records.length === 0) return null;

    const sample = records[0];

    // Safely read primitive properties only (avoid circular refs)
    const sampleData: Record<string, string> = {};
    const propsToTry = ['name', 'barcode', 'image', 'minPrice', 'maxPrice', 'avgPrice',
      'category', 'sub_category', 'subcategory', 'unit', 'shelf_price', 'currentPrice',
      'id', 'modelName', 'min_price', 'max_price', 'avg_price'];

    for (const prop of propsToTry) {
      try {
        let val = undefined;
        try { val = sample.get?.(prop); } catch {}
        if (val === undefined) val = sample[prop];
        if (val !== undefined && val !== null && typeof val !== 'object' && typeof val !== 'function') {
          sampleData[prop] = String(val);
        }
      } catch { /* ignore */ }
    }

    // Check _record for raw data (only primitives)
    const internal = sample._record || sample._internalModel?._data || sample._data;
    if (internal && typeof internal === 'object') {
      const keys = Object.keys(internal).filter(k => !k.startsWith('_'));
      sampleData._internalKeys = keys.join(',');
      for (const k of keys.slice(0, 15)) {
        try {
          const v = internal[k];
          if (v !== null && v !== undefined && typeof v !== 'object' && typeof v !== 'function') {
            sampleData[`_i.${k}`] = String(v);
          } else if (v && typeof v === 'object') {
            sampleData[`_i.${k}`] = `[object: ${Object.keys(v).slice(0, 5).join(',')}]`;
          }
        } catch { /* ignore */ }
      }
    }

    return {
      productCount: records.length,
      sampleData,
    };
  });

  if (debug && storeInfo) {
    console.log(`  Products in store: ${storeInfo.productCount}`);
    console.log('  Sample data:');
    for (const [k, v] of Object.entries(storeInfo.sampleData)) {
      console.log(`    ${k}: ${v.slice(0, 120)}`);
    }
  }

  // Step 2: Extract all products with their retailer prices
  // Use page.evaluate with a string to avoid tsx __name transform issues
  console.log('Extracting product and retailer data from Ember store...');
  const extracted = await page.evaluate(`
    (function() {
      var w = window;
      var keys = Object.keys(w.Ember.Namespace.NAMESPACES_BY_ID);
      var appKey = null;
      for (var i = 0; i < keys.length; i++) {
        if (keys[i].indexOf('katanalotis') >= 0) { appKey = keys[i]; break; }
      }
      if (!appKey) return null;

      var container = w.Ember.Namespace.NAMESPACES_BY_ID[appKey].__container__;
      var store = container.cache && container.cache['service:store'];
      if (!store && container.lookup) store = container.lookup('service:store');
      var arrays = store.recordArrayManager._liveRecordArrays;

      // Extract retailers
      var retailers = [];
      if (arrays.retailer && arrays.retailer.content) {
        var recs = Array.from(arrays.retailer.content);
        for (var i = 0; i < recs.length; i++) {
          var r = recs[i];
          var rd = r._record || (r._internalModel && r._internalModel._data) || {};
          var name = '';
          try { name = r.get ? r.get('name') : ''; } catch(e) {}
          if (!name) name = rd.name || '';
          retailers.push({ id: String(r.id || rd.id || ''), name: String(name) });
        }
      }

      // Extract products
      var products = [];
      var precs = Array.from(arrays.product.content);
      for (var i = 0; i < precs.length; i++) {
        var r = precs[i];
        var d = r._record || (r._internalModel && r._internalModel._data) || {};

        // Safe get primitive
        var getName = '';
        try { getName = r.get ? r.get('name') : ''; } catch(e) {}
        if (!getName) getName = d.name || '';

        var getCat = '';
        try { getCat = r.get ? r.get('category') : ''; } catch(e) {}
        if (!getCat) getCat = d.category || '';

        var getSubcat = '';
        try { getSubcat = r.get ? r.get('sub_category') : ''; } catch(e) {}
        if (!getSubcat) getSubcat = d.sub_category || d.subcategory || '';

        var getBarcode = '';
        try { getBarcode = r.get ? r.get('barcode') : ''; } catch(e) {}
        if (!getBarcode) getBarcode = d.barcode || '';

        var getUnit = '';
        try { getUnit = r.get ? r.get('unit') : ''; } catch(e) {}
        if (!getUnit) getUnit = d.unit || '';

        // Get prices
        var minP = null, maxP = null, avgP = null;
        var pkeys = ['minPrice', 'min_price'];
        for (var j = 0; j < pkeys.length; j++) {
          var v;
          try { v = r.get ? r.get(pkeys[j]) : undefined; } catch(e) { v = undefined; }
          if (v === undefined) v = d[pkeys[j]];
          if (v !== undefined && v !== null) { minP = parseFloat(String(v)); break; }
        }

        var mkeys = ['maxPrice', 'max_price'];
        for (var j = 0; j < mkeys.length; j++) {
          var v;
          try { v = r.get ? r.get(mkeys[j]) : undefined; } catch(e) { v = undefined; }
          if (v === undefined) v = d[mkeys[j]];
          if (v !== undefined && v !== null) { maxP = parseFloat(String(v)); break; }
        }

        var akeys = ['avgPrice', 'avg_price'];
        for (var j = 0; j < akeys.length; j++) {
          var v;
          try { v = r.get ? r.get(akeys[j]) : undefined; } catch(e) { v = undefined; }
          if (v === undefined) v = d[akeys[j]];
          if (v !== undefined && v !== null) { avgP = parseFloat(String(v)); break; }
        }

        // Look for per-retailer prices
        var rawPrices = null;
        var rpkeys = ['prices', 'retailer_prices', 'retailerPrices', 'chainPrices'];
        for (var j = 0; j < rpkeys.length; j++) {
          var v;
          try { v = r.get ? r.get(rpkeys[j]) : undefined; } catch(e) { v = undefined; }
          if (v === undefined) v = d[rpkeys[j]];
          if (v && typeof v === 'object' && !Array.isArray(v)) {
            var result = {};
            var entries = Object.entries(v);
            var hasE = false;
            for (var k = 0; k < entries.length; k++) {
              var val = entries[k][1];
              if (typeof val === 'number') { result[entries[k][0]] = val; hasE = true; }
              else if (typeof val === 'string') { var n = parseFloat(val); if (!isNaN(n)) { result[entries[k][0]] = n; hasE = true; } }
            }
            if (hasE) { rawPrices = result; break; }
          }
        }

        products.push({
          id: String(r.id || d.id || ''),
          name: String(getName),
          category: String(getCat),
          subcategory: String(getSubcat),
          barcode: String(getBarcode),
          minPrice: (minP !== null && !isNaN(minP)) ? minP : null,
          maxPrice: (maxP !== null && !isNaN(maxP)) ? maxP : null,
          avgPrice: (avgP !== null && !isNaN(avgP)) ? avgP : null,
          unit: String(getUnit),
          rawPrices: rawPrices,
        });
      }

      return { retailers: retailers, products: products };
    })()
  `) as any;

  if (!extracted || extracted.products.length === 0) {
    console.error('Failed to extract data from Ember store');
    return { products: [], chainNames: [], scrapedAt: new Date().toISOString() };
  }

  console.log(`  Extracted ${extracted.products.length} products, ${extracted.retailers.length} retailers`);

  if (debug) {
    // Show sample products
    for (const p of extracted.products.slice(0, 3)) {
      console.log(`  [${p.id}] ${p.name} | cat: ${p.category} | min: ${p.minPrice} max: ${p.maxPrice} avg: ${p.avgPrice} | unit: ${p.unit}`);
      if (p.rawPrices) console.log(`    rawPrices: ${JSON.stringify(p.rawPrices).slice(0, 200)}`);
    }
    if (extracted.retailers.length > 0) {
      console.log('  Retailers:', extracted.retailers.map(r => `${r.id}:${r.name}`).join(', '));
    }
  }

  // Step 3: Now we need per-retailer prices. If products don't have retailer-level prices,
  // we need to click on each retailer tab on the basket page to get them.
  // First, check if we already have per-retailer prices from Ember store.
  const hasRetailerPrices = extracted.products.some(p => p.rawPrices != null);

  if (hasRetailerPrices) {
    return buildResultFromEmberData(extracted);
  }

  // Products only have min/max/avg prices, no per-retailer breakdown.
  // Try clicking retailer tabs on the basket page to get per-retailer data.
  console.log('No per-retailer prices in Ember store. Trying to scrape per-retailer from basket page...');

  const basketResult = await scrapeBasketByRetailer(page, extracted, debug);
  if (basketResult && basketResult.products.length > 0) {
    return basketResult;
  }

  // Fallback: use avgPrice as a single price point (no per-retailer breakdown)
  console.log('Using average prices as fallback (no per-retailer breakdown available)...');
  return buildResultWithAvgPrices(extracted);
}

function buildResultFromEmberData(extracted: {
  retailers: Array<{ id: string; name: string }>;
  products: Array<{
    id: string; name: string; category: string; subcategory: string;
    minPrice: number | null; maxPrice: number | null; avgPrice: number | null;
    unit: string; rawPrices: any;
  }>;
}): BasketScrapeResult {
  const retailerMap = new Map(extracted.retailers.map(r => [r.id, r.name]));
  const chainNames = new Set<string>();
  const products: RawBasketProduct[] = [];

  for (const p of extracted.products) {
    if (!p.rawPrices || !p.name) continue;

    const prices: Record<string, number | null> = {};
    for (const [key, val] of Object.entries(p.rawPrices)) {
      const price = typeof val === 'number' ? val : parseFloat(String(val));
      if (!isNaN(price) && price > 0) {
        const chainName = retailerMap.get(key) || key;
        chainNames.add(chainName);
        prices[chainName] = price;
      }
    }

    if (Object.keys(prices).length > 0) {
      products.push({
        name: p.name,
        category: p.category || p.subcategory || '',
        prices,
      });
    }
  }

  console.log(`Built ${products.length} products with per-retailer prices`);
  return { products, chainNames: [...chainNames], scrapedAt: new Date().toISOString() };
}

async function scrapeBasketByRetailer(
  page: Page,
  extracted: {
    retailers: Array<{ id: string; name: string }>;
    products: Array<any>;
  },
  debug: boolean
): Promise<BasketScrapeResult | null> {
  // Find retailer selector/dropdown/tabs on the basket page
  const retailerOptions = await page.evaluate(() => {
    // Look for dropdown or buttons to select retailers
    const selects = document.querySelectorAll('select');
    for (const select of Array.from(selects)) {
      const options = Array.from(select.options).map(o => ({
        value: o.value,
        text: o.textContent?.trim() || '',
      }));
      if (options.length > 2) {
        return { type: 'select', selector: getSelector(select), options };
      }
    }

    // Look for retailer buttons/tabs
    const buttons = document.querySelectorAll('.retailer-btn, .chain-btn, [data-retailer], .retailer-tab');
    if (buttons.length > 0) {
      return {
        type: 'buttons',
        buttons: Array.from(buttons).map(b => ({
          text: b.textContent?.trim() || '',
          selector: getSelector(b),
        })),
      };
    }

    // Look for any links/buttons with retailer names
    const allButtons = document.querySelectorAll('button, a.btn, .cursor-pointer');
    const retailerButtons: Array<{ text: string; selector: string }> = [];
    const knownChains = ['ΑΒ', 'ΣΚΛΑΒΕΝΙΤΗΣ', 'ΜΑΣΟΥΤΗΣ', 'LIDL', 'MY MARKET', 'MARKET IN', 'ΚΡΗΤΙΚΟΣ'];
    for (const btn of Array.from(allButtons)) {
      const text = btn.textContent?.trim().toUpperCase() || '';
      if (knownChains.some(c => text.includes(c))) {
        retailerButtons.push({ text: btn.textContent?.trim() || '', selector: getSelector(btn) });
      }
    }
    if (retailerButtons.length > 0) {
      return { type: 'retailer-buttons', buttons: retailerButtons };
    }

    // Look for images of retailer logos
    const images = document.querySelectorAll('img[src*="retailer"], img[alt*="retailer"], .retailer img');
    if (images.length > 0) {
      return {
        type: 'images',
        images: Array.from(images).map(img => ({
          alt: (img as HTMLImageElement).alt,
          src: (img as HTMLImageElement).src.split('/').pop(),
          parent: getSelector(img.parentElement!),
        })),
      };
    }

    return null;

    function getSelector(el: Element): string {
      if (el.id) return '#' + el.id;
      if (el.className) return el.tagName.toLowerCase() + '.' + el.className.toString().split(' ').filter(Boolean).join('.');
      return el.tagName.toLowerCase();
    }
  });

  if (debug && retailerOptions) {
    console.log('  Retailer UI:', JSON.stringify(retailerOptions).slice(0, 500));
  }

  if (!retailerOptions) {
    console.log('  No retailer selection UI found on basket page');
    return null;
  }

  // If we found a select dropdown, iterate through retailers
  if (retailerOptions.type === 'select' && retailerOptions.options) {
    const chainNames = new Set<string>();
    const productPriceMap = new Map<string, RawBasketProduct>();

    for (const option of retailerOptions.options) {
      if (!option.value || option.value === '' || option.text.includes('Επιλογή')) continue;

      console.log(`  Selecting retailer: ${option.text}...`);
      await page.selectOption(retailerOptions.selector!, option.value);
      await page.waitForTimeout(3_000);

      chainNames.add(option.text);

      // Extract prices for this retailer
      const priceData = await page.evaluate(() => {
        const rows = document.querySelectorAll('.householdBasket-container table tr, .householdBasket-container .product-row, .householdBasket-container .nova-sb');
        const items: Array<{ name: string; price: string; category: string }> = [];

        // Try product cards/rows approach
        const productElements = document.querySelectorAll('.householdBasket-container [class*="product"], .householdBasket-container .nova-sb');
        for (const el of Array.from(productElements)) {
          const name = el.querySelector('.product-name, .name, p')?.textContent?.trim();
          const price = el.querySelector('.product-price, .price, span')?.textContent?.trim();
          if (name && price) {
            items.push({ name, price, category: '' });
          }
        }

        // If no products found, try getting all text with prices
        if (items.length === 0) {
          const allText = document.querySelector('.householdBasket-container')?.textContent || '';
          return { items, allText: allText.slice(0, 2000) };
        }

        return { items };
      });

      if (debug) {
        console.log(`    Found ${priceData.items.length} items`);
        if (priceData.items.length === 0 && priceData.allText) {
          console.log(`    Page text: ${priceData.allText.slice(0, 200)}`);
        }
      }

      for (const item of priceData.items) {
        const priceNum = parseFloat(item.price.replace('€', '').replace(',', '.').trim());
        if (isNaN(priceNum)) continue;

        if (!productPriceMap.has(item.name)) {
          productPriceMap.set(item.name, { name: item.name, category: item.category, prices: {} });
        }
        productPriceMap.get(item.name)!.prices[option.text] = priceNum;
      }
    }

    if (productPriceMap.size > 0) {
      return {
        products: [...productPriceMap.values()],
        chainNames: [...chainNames],
        scrapedAt: new Date().toISOString(),
      };
    }
  }

  return null;
}

function buildResultWithAvgPrices(extracted: {
  retailers: Array<{ id: string; name: string }>;
  products: Array<{
    id: string; name: string; category: string; subcategory: string;
    minPrice: number | null; maxPrice: number | null; avgPrice: number | null;
    unit: string; rawPrices: any;
  }>;
}): BasketScrapeResult {
  const products: RawBasketProduct[] = [];

  for (const p of extracted.products) {
    const price = p.avgPrice ?? p.minPrice;
    if (!p.name || price === null || price <= 0) continue;

    products.push({
      name: p.name,
      category: p.category || p.subcategory || '',
      prices: { 'Average': price },
    });
  }

  console.log(`Built ${products.length} products with average prices`);
  return {
    products,
    chainNames: ['Average'],
    scrapedAt: new Date().toISOString(),
  };
}
