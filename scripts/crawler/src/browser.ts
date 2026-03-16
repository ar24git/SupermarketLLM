import { chromium, Browser, Page } from 'playwright';
import { CONFIG } from './config.js';

let browser: Browser | null = null;

export async function launchBrowser(headless = true): Promise<Browser> {
  if (browser) return browser;

  browser = await chromium.launch({
    headless,
    args: ['--disable-blink-features=AutomationControlled'],
  });

  return browser;
}

export async function newPage(headless = true): Promise<Page> {
  const b = await launchBrowser(headless);
  const context = await b.newContext({
    userAgent: CONFIG.userAgent,
    locale: CONFIG.locale,
    viewport: CONFIG.viewport,
    extraHTTPHeaders: {
      'Accept-Language': 'el-GR,el;q=0.9,en;q=0.8',
    },
  });

  // Block images and fonts for speed
  await context.route(/\.(png|jpg|jpeg|gif|webp|svg|woff2?|ttf|eot)$/i, (route) =>
    route.abort()
  );

  const page = await context.newPage();
  page.setDefaultNavigationTimeout(CONFIG.navigationTimeout);
  page.setDefaultTimeout(30_000);

  return page;
}

export async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close();
    browser = null;
  }
}
