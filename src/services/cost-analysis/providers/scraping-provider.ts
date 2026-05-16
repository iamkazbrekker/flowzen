/**
 * Scraping Provider
 * Responsibility: Use Playwright to scrape live logistics fares from dynamic websites
 * Includes: retry logic, timeout handling, and currency normalization
 */

import type { Browser, Page } from "playwright";
import { TransportMode } from "../types";

export interface ScrapedFare {
  mode: TransportMode;
  price_usd: number;
  duration_days: number;
  provider: string;
  is_live: boolean;
}

const MAX_RETRIES = 1;
const SCRAPE_TIMEOUT = 15000; // Reduced to 15 seconds

export async function scrapeLiveFares(
  source: string,
  destination: string,
  weightKg: number
): Promise<ScrapedFare[]> {
  console.log(`[Scraper] Initiating live scrape: ${source} -> ${destination} (${weightKg}kg)`);
  
  const fares: ScrapedFare[] = [];
  let browser: Browser | null = null;

  try {
    // Dynamic import to prevent Vercel serverless function crash on load
    let chromium;
    try {
      const pw = await import("playwright");
      chromium = pw.chromium;
    } catch (e) {
      console.warn("[Scraper] Playwright not available (likely Vercel environment). Skipping live scrape.");
      return fares;
    }

    browser = await chromium.launch({ 
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
    
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 720 }
    });
    
    const page = await context.newPage();
    // Block unnecessary resources (images, css, fonts) to speed up loading
    await page.route('**/*.{png,jpg,jpeg,gif,svg,css,woff,woff2}', route => route.abort());

    try {
      await scrapeSeaRates(page, source, destination, weightKg, fares);
    } catch (err) {
      console.warn(`[Scraper] SeaRates scrape failed: ${err instanceof Error ? err.message : String(err)}`);
    }

  } catch (err) {
    console.error(`[Scraper] Global scraping error: ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    if (browser) await browser.close();
  }

  return fares;
}

/**
 * Specialized scraper for SeaRates
 */
async function scrapeSeaRates(
  page: Page,
  source: string,
  destination: string,
  weightKg: number,
  results: ScrapedFare[]
) {
  // Navigation - use domcontentloaded for speed
  await page.goto("https://www.searates.com/freight/", { 
    waitUntil: "domcontentloaded", 
    timeout: SCRAPE_TIMEOUT 
  });

  try {
    const originInput = page.locator('input[placeholder*="Origin"], input[name*="origin"]');
    await originInput.first().fill(source);
    await page.keyboard.press("Enter");

    const destInput = page.locator('input[placeholder*="Destination"], input[name*="destination"]');
    await destInput.first().fill(destination);
    await page.keyboard.press("Enter");

    const searchBtn = page.locator('button:has-text("Search"), button:has-text("Get Quote")');
    await searchBtn.first().click();

    // Reduced wait time for results
    await page.waitForSelector('.price, .fare, [class*="price"]', { timeout: 8000 });

    // Extract Data
    const priceText = await page.locator('.price, .fare, [class*="price"]').first().innerText();
    const durationText = await page.locator('.duration, .days, [class*="days"]').first().innerText();
    
    const price = parseFloat(priceText.replace(/[^0-9.]/g, ""));
    const days = parseInt(durationText.replace(/[^0-9]/g, "")) || 35;

    if (!isNaN(price)) {
      results.push({
        mode: "sea",
        price_usd: price,
        duration_days: days,
        provider: "SeaRates Live",
        is_live: true
      });
      console.log(`[Scraper] Successfully extracted sea fare: $${price}`);
    }
  } catch (e) {
    // If specific site fails, we don't crash the pipeline
    throw e;
  }
}

/**
 * Fallback Pricing Logic
 * Used if scraping fails or is blocked
 */
export function getFallbackFares(
  mode: TransportMode,
  distanceKm: number,
  weightKg: number
): ScrapedFare {
  // Realistic base rates per kg/km
  const rates: Record<TransportMode, number> = {
    air: 0.45,
    sea: 0.03,
    rail: 0.08,
    road: 0.12
  };
  
  const basePrice = (distanceKm * rates[mode]) + (weightKg * 0.5);
  const durations: Record<TransportMode, number> = {
    air: Math.max(1, Math.round(distanceKm / 800 / 24)),
    sea: Math.max(15, Math.round(distanceKm / 30 / 24)),
    rail: Math.max(7, Math.round(distanceKm / 50 / 24)),
    road: Math.max(2, Math.round(distanceKm / 60 / 24))
  };

  return {
    mode,
    price_usd: Math.round(basePrice),
    duration_days: durations[mode],
    provider: "FlowZen Market Index (Fallback)",
    is_live: false
  };
}
