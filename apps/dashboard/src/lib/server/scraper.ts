/**
 * URL Scraper for vehicle/product data extraction
 * Supports Cloudflare Browser Rendering and fetch-based fallback
 */

export interface ScrapedData {
  modelName?: string;
  description?: string;
  thumbnailUrl?: string;
  msrp?: number;
  currency: string;
  category?: string;
  sourceUrl: string;
  specifications: Record<string, string>;
  features: string[];
  images: string[];
}

/**
 * Scrape vehicle data from a URL
 * Uses Cloudflare Browser Rendering if available, falls back to fetch
 */
export async function scrapeUrl(url: string, browserBinding?: any): Promise<ScrapedData> {
  // Validate URL
  try {
    new URL(url);
  } catch {
    throw new Error('Invalid URL format');
  }

  if (browserBinding) {
    // Use Cloudflare Browser Rendering for JavaScript-heavy pages
    return scrapeWithBrowser(browserBinding, url);
  }
  
  // Fallback to fetch-based scraping
  return scrapeWithFetch(url);
}

// Cloudflare Browser Rendering scraping
async function scrapeWithBrowser(browser: any, url: string): Promise<ScrapedData> {
  // @ts-ignore - @cloudflare/puppeteer is available at runtime
  const puppeteer = await import('@cloudflare/puppeteer');
  
  const browserInstance = await puppeteer.default.launch(browser);
  const page = await browserInstance.newPage();
  
  try {
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    await page.goto(url, { 
      waitUntil: 'networkidle2', 
      timeout: 30000 
    });
    
    // Wait for content to render
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Extract data from the page
    const data = await page.evaluate(() => {
      const result: Record<string, any> = {
        specifications: {},
        features: [],
        images: []
      };

      // Get title
      const title = document.title;
      if (title) {
        result.modelName = title.split('|')[0].split('-')[0].trim();
      }

      // Get meta description
      const metaDesc = document.querySelector('meta[name="description"]');
      if (metaDesc) {
        result.description = metaDesc.getAttribute('content');
      }

      // Get OG image
      const ogImage = document.querySelector('meta[property="og:image"]');
      if (ogImage) {
        result.thumbnailUrl = ogImage.getAttribute('content');
      }

      // Extract prices - look for various patterns
      const pricePatterns = [
        /\$[\d,]+(?:\.\d{2})?/g,
        /MSRP[:\s]*\$?[\d,]+/gi
      ];
      
      const bodyText = document.body.innerText;
      for (const pattern of pricePatterns) {
        const matches = bodyText.match(pattern);
        if (matches) {
          for (const match of matches) {
            const num = parseFloat(match.replace(/[^\d.]/g, ''));
            if (num > 100 && num < 100000) {
              result.msrp = num;
              break;
            }
          }
          if (result.msrp) break;
        }
      }

      // Extract specifications from various patterns
      const specKeywords = [
        'engine', 'displacement', 'transmission', 'ignition', 'cooling',
        'final drive', 'suspension', 'brakes', 'tires', 'dimensions',
        'seat height', 'wheelbase', 'ground clearance', 'fuel capacity',
        'weight', 'horsepower', 'torque', 'bore', 'stroke', 'compression'
      ];

      // Look for spec tables
      const tables = document.querySelectorAll('table');
      tables.forEach(table => {
        const rows = table.querySelectorAll('tr');
        rows.forEach(row => {
          const cells = row.querySelectorAll('td, th');
          if (cells.length >= 2) {
            const key = (cells[0] as HTMLElement).innerText?.trim().toLowerCase() || '';
            const value = (cells[1] as HTMLElement).innerText?.trim() || '';
            if (specKeywords.some(kw => key.includes(kw)) && value) {
              const camelKey = key.replace(/\s+(.)/g, (_, c) => c.toUpperCase());
              result.specifications[camelKey] = value;
            }
          }
        });
      });

      // Look for definition lists
      const dls = document.querySelectorAll('dl');
      dls.forEach(dl => {
        const dts = dl.querySelectorAll('dt');
        const dds = dl.querySelectorAll('dd');
        dts.forEach((dt, i) => {
          if (dds[i]) {
            const key = (dt as HTMLElement).innerText?.trim().toLowerCase() || '';
            const value = (dds[i] as HTMLElement).innerText?.trim() || '';
            if (specKeywords.some(kw => key.includes(kw)) && value) {
              const camelKey = key.replace(/\s+(.)/g, (_, c) => c.toUpperCase());
              result.specifications[camelKey] = value;
            }
          }
        });
      });

      // Look for labeled divs/spans
      specKeywords.forEach(keyword => {
        const regex = new RegExp(`${keyword}[:\\s]*([^\\n<]+)`, 'gi');
        const matches = bodyText.match(regex);
        if (matches) {
          matches.forEach(match => {
            const parts = match.split(/[:\s]+/);
            if (parts.length >= 2) {
              const value = parts.slice(1).join(' ').trim();
              if (value && value.length < 100) {
                const camelKey = keyword.replace(/\s+(.)/g, (_, c) => c.toUpperCase());
                if (!result.specifications[camelKey]) {
                  result.specifications[camelKey] = value;
                }
              }
            }
          });
        }
      });

      // Extract features - look for lists
      const featureLists = document.querySelectorAll('ul, ol');
      featureLists.forEach(list => {
        const items = list.querySelectorAll('li');
        items.forEach(item => {
          const text = item.innerText.trim();
          if (text.length > 10 && text.length < 200 && !text.includes('{')) {
            result.features.push(text);
          }
        });
      });

      // Also look for bullet point patterns in text
      const bulletPatterns = [/[•✓]\s*([^\n]+)/g];
      bulletPatterns.forEach(pattern => {
        const matches = bodyText.match(pattern);
        if (matches) {
          matches.forEach(match => {
            const text = match.replace(/^[•✓]\s*/, '').trim();
            if (text.length > 10 && text.length < 200 && !result.features.includes(text)) {
              result.features.push(text);
            }
          });
        }
      });

      // Limit features
      result.features = result.features.slice(0, 20);

      // Extract all images
      const imgs = document.querySelectorAll('img');
      imgs.forEach(img => {
        const src = img.src;
        if (src && 
            !src.includes('data:') && 
            !src.includes('logo') && 
            !src.includes('icon') &&
            !src.includes('badge') &&
            !src.includes('payment') &&
            img.naturalWidth > 100) {
          result.images.push(src);
        }
      });
      result.images = [...new Set(result.images)].slice(0, 15);

      if (!result.thumbnailUrl && result.images.length > 0) {
        result.thumbnailUrl = result.images[0];
      }

      return result;
    });

    // Detect category from URL
    const category = detectCategory(url);
    if (category) {
      data.category = category;
    }

    data.sourceUrl = url;
    data.currency = 'USD';
    
    return data as ScrapedData;
  } finally {
    await browserInstance.close();
  }
}

// Basic fetch-based scraping (fallback)
async function scrapeWithFetch(url: string): Promise<ScrapedData> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch URL: ${response.status}`);
  }

  const html = await response.text();
  return parseVehicleData(html, url);
}

// Parse HTML to extract vehicle data
function parseVehicleData(html: string, sourceUrl: string): ScrapedData {
  const data: ScrapedData = {
    sourceUrl,
    specifications: {},
    features: [],
    images: [],
    currency: 'USD'
  };

  // Extract title/model name
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch) {
    const title = titleMatch[1].trim();
    data.modelName = title.split('|')[0].split('-')[0].trim();
  }

  // Extract meta description
  const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
  if (descMatch) {
    data.description = descMatch[1].trim();
  }

  // Extract OG image
  const ogImageMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i);
  if (ogImageMatch) {
    data.thumbnailUrl = ogImageMatch[1];
  }

  // Extract price/MSRP
  const priceMatches = html.match(/\$[\d,]+(?:\.\d{2})?|\bMSRP[:\s]*\$?[\d,]+/gi);
  if (priceMatches) {
    for (const match of priceMatches) {
      const num = parseFloat(match.replace(/[^\d.]/g, ''));
      if (num > 100 && num < 100000) {
        data.msrp = num;
        break;
      }
    }
  }

  // Extract specifications
  const specPatterns = [
    { key: 'engine', pattern: /ENGINE[:\s]*([^<\n]+)/i },
    { key: 'displacement', pattern: /DISPLACEMENT[:\s]*([^<\n]+)/i },
    { key: 'transmission', pattern: /TRANSMISSION[:\s]*([^<\n]+)/i },
    { key: 'ignition', pattern: /IGNITION[:\s]*([^<\n]+)/i },
    { key: 'cooling', pattern: /COOLING[:\s]*([^<\n]+)/i },
    { key: 'finalDrive', pattern: /FINAL\s*DRIVE[:\s]*([^<\n]+)/i },
    { key: 'frontSuspension', pattern: /FRONT\s*SUSPENSION[:\s]*([^<\n]+)/i },
    { key: 'rearSuspension', pattern: /REAR\s*SUSPENSION[:\s]*([^<\n]+)/i },
    { key: 'frontBrakes', pattern: /FRONT\s*BRAKES?[:\s]*([^<\n]+)/i },
    { key: 'rearBrakes', pattern: /REAR\s*BRAKES?[:\s]*([^<\n]+)/i },
    { key: 'frontTires', pattern: /FRONT\s*TIRES?[:\s]*([^<\n]+)/i },
    { key: 'rearTires', pattern: /REAR\s*TIRES?[:\s]*([^<\n]+)/i },
    { key: 'dimensions', pattern: /DIMENSIONS[:\s]*([^<\n]+)/i },
    { key: 'seatHeight', pattern: /SEAT\s*HEIGHT[:\s]*([^<\n]+)/i },
    { key: 'wheelbase', pattern: /WHEELBASE[:\s]*([^<\n]+)/i },
    { key: 'groundClearance', pattern: /GROUND\s*CLEARANCE[:\s]*([^<\n]+)/i },
    { key: 'fuelCapacity', pattern: /FUEL\s*CAPACITY[:\s]*([^<\n]+)/i },
    { key: 'weight', pattern: /(?:DRY\s*)?WEIGHT[:\s]*([^<\n]+)/i },
    { key: 'horsepower', pattern: /HORSEPOWER[:\s]*([^<\n]+)/i },
    { key: 'torque', pattern: /TORQUE[:\s]*([^<\n]+)/i },
  ];

  for (const { key, pattern } of specPatterns) {
    const match = html.match(pattern);
    if (match) {
      data.specifications[key] = match[1].trim().replace(/<[^>]+>/g, '');
    }
  }

  // Extract features
  const featurePatterns = [
    /<li[^>]*>([^<]+)<\/li>/gi,
    /✓\s*([^<\n]+)/gi,
    /•\s*([^<\n]+)/gi,
  ];

  const features = new Set<string>();
  for (const pattern of featurePatterns) {
    let match;
    while ((match = pattern.exec(html)) !== null) {
      const feature = match[1].trim().replace(/<[^>]+>/g, '');
      if (feature.length > 10 && feature.length < 200 && !feature.includes('{')) {
        features.add(feature);
      }
    }
  }
  data.features = Array.from(features).slice(0, 20);

  // Extract images
  const imgPattern = /<img[^>]*src=["']([^"']+)["'][^>]*>/gi;
  let imgMatch;
  const images: string[] = [];
  while ((imgMatch = imgPattern.exec(html)) !== null) {
    const src = imgMatch[1];
    if (src && !src.includes('data:') && !src.includes('logo') && !src.includes('icon') && !src.includes('badge')) {
      try {
        const absoluteUrl = new URL(src, sourceUrl).href;
        if (!images.includes(absoluteUrl)) {
          images.push(absoluteUrl);
        }
      } catch {
        // Skip invalid URLs
      }
    }
  }
  data.images = images.slice(0, 15);
  if (!data.thumbnailUrl && images.length > 0) {
    data.thumbnailUrl = images[0];
  }

  // Detect category
  const category = detectCategory(sourceUrl);
  if (category) {
    data.category = category;
  }

  return data;
}

// Detect vehicle category from URL
function detectCategory(url: string): string | undefined {
  const urlLower = url.toLowerCase();
  if (urlLower.includes('atv') || urlLower.includes('quad')) {
    return 'atv';
  } else if (urlLower.includes('utv') || urlLower.includes('side-by-side') || urlLower.includes('sxs')) {
    return 'utv';
  } else if (urlLower.includes('pitbike') || urlLower.includes('pit-bike')) {
    return 'pitbike';
  } else if (urlLower.includes('dirtbike') || urlLower.includes('dirt-bike') || urlLower.includes('mx')) {
    return 'dirtbike';
  } else if (urlLower.includes('electric') || urlLower.includes('ev')) {
    return 'electric';
  } else if (urlLower.includes('motorcycle') || urlLower.includes('bike')) {
    return 'motorcycle';
  }
  return undefined;
}
