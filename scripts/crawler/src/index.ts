import * as path from 'path';
import { newPage, closeBrowser } from './browser.js';
import { scrapeHouseholdBasket } from './extractors/householdBasket.js';
import { scrapeProductDetails } from './extractors/productDetail.js';
import { mapBasketData, mapDetailData } from './mappers/toAppTypes.js';
import { writeSuperMarketsTs, writeJsonOutput } from './output/tsWriter.js';

interface CliArgs {
  mode: 'basket' | 'detail';
  headless: boolean;
  debug: boolean;
  output: 'json' | 'ts' | 'both';
  limit: number; // max products to scrape detail pages for
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  const result: CliArgs = {
    mode: 'basket',
    headless: true,
    debug: false,
    output: 'both',
    limit: 50,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--mode':
        result.mode = args[++i] as CliArgs['mode'];
        break;
      case '--headless':
        result.headless = args[++i] !== 'false';
        break;
      case '--debug':
        result.debug = true;
        break;
      case '--output':
        result.output = args[++i] as CliArgs['output'];
        break;
      case '--limit':
        result.limit = parseInt(args[++i], 10) || 50;
        break;
    }
  }

  return result;
}

async function main() {
  const args = parseArgs();
  console.log('e-Katanalotis Crawler');
  console.log(`Mode: ${args.mode} | Headless: ${args.headless} | Debug: ${args.debug} | Limit: ${args.limit}`);
  console.log('---');

  try {
    if (args.mode === 'basket') {
      await crawlBasket(args);
    } else if (args.mode === 'detail') {
      await crawlWithDetails(args);
    } else {
      console.error(`Unknown mode: ${args.mode}`);
      process.exit(1);
    }
  } catch (err) {
    console.error('Crawler failed:', err);
    process.exit(1);
  } finally {
    await closeBrowser();
  }
}

async function crawlBasket(args: CliArgs) {
  const page = await newPage(args.headless);

  // Step 1: Get product list from Ember store
  console.log('Step 1: Getting product catalog from Ember store...');
  const result = await scrapeHouseholdBasket(page, args.debug);

  if (result.products.length === 0) {
    console.error('No products were scraped.');
    process.exit(1);
  }

  console.log(`\nGot ${result.products.length} products from Ember store`);

  // Step 2: Scrape detail pages for per-retailer prices
  const productIds = result.products
    .map(p => p.name) // We'll use the Ember IDs
    .slice(0, args.limit);

  // The Ember store gives us IDs as indices - let's scrape detail pages
  console.log(`\nStep 2: Scraping ${Math.min(args.limit, result.products.length)} product detail pages for per-retailer prices...`);

  // Get the numeric IDs from the products we found
  const ids = Array.from({ length: Math.min(args.limit, result.products.length) }, (_, i) => String(i));
  const details = await scrapeProductDetails(page, ids, args.debug, 2000);

  console.log(`\nGot per-retailer prices for ${details.length} products`);

  // Map to app types
  const today = new Date().toISOString().split('T')[0];
  const mapped = mapDetailData(details, today);

  if (mapped.warnings.length > 0) {
    console.log(`\nWarnings (${mapped.warnings.length}):`);
    mapped.warnings.slice(0, 10).forEach((w) => console.log(`  - ${w}`));
    if (mapped.warnings.length > 10) console.log(`  ... and ${mapped.warnings.length - 10} more`);
  }

  console.log(`\nMapped: ${mapped.stores.length} stores, ${mapped.products.length} products, ${mapped.prices.length} price entries`);

  writeOutputFiles(mapped, today, args);
  console.log('\nDone!');
}

async function crawlWithDetails(args: CliArgs) {
  const page = await newPage(args.headless);

  console.log(`Scraping product detail pages (limit: ${args.limit})...`);
  const ids = Array.from({ length: args.limit }, (_, i) => String(i));
  const details = await scrapeProductDetails(page, ids, args.debug, 2000);

  console.log(`\nGot per-retailer prices for ${details.length} products`);

  const today = new Date().toISOString().split('T')[0];
  const mapped = mapDetailData(details, today);

  console.log(`\nMapped: ${mapped.stores.length} stores, ${mapped.products.length} products, ${mapped.prices.length} price entries`);

  writeOutputFiles(mapped, today, args);
  console.log('\nDone!');
}

function writeOutputFiles(
  mapped: { stores: any[]; products: any[]; prices: any[]; warnings: string[] },
  today: string,
  args: CliArgs
) {
  // import.meta.dirname = scripts/crawler/src
  // crawlerDir = scripts/crawler
  // projectRoot = the repo root (2 levels above scripts/)
  const crawlerDir = path.resolve(import.meta.dirname, '..');
  const projectRoot = path.resolve(crawlerDir, '..', '..');
  const crawlerData = path.resolve(crawlerDir, 'data');

  if (args.output === 'json' || args.output === 'both') {
    writeJsonOutput(mapped.stores, mapped.products, mapped.prices, today, path.join(crawlerData, 'scraped-data.json'));
  }

  if (args.output === 'ts' || args.output === 'both') {
    writeSuperMarketsTs(mapped.stores, mapped.products, mapped.prices, today, path.join(projectRoot, 'src', 'data', 'superMarkets.ts'));
  }
}

main();
