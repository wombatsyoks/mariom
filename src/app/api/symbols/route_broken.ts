import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

export async function POST(request: NextRequest) {
  try {
    const { symbol } = await request.json();
    
    if (!symbol || typeof symbol !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Symbol is required' },
        { status: 400 }
      );
    }

    const ticker = symbol.trim().toUpperCase();
    
    // Fetch all the data for this symbol
    const [
      executiveData,
      premarketLow,
      previousClose,
      isEtfEtn,
      newsData,
      secFiling
    ] = await Promise.allSettled([
      scrapeYahooProfileExecutives(ticker),
      getPremarketLow(ticker),
      getPreviousClose(ticker),
      checkEtnEtf(ticker),
      scrapeZacksNews(ticker),
      getSecFiling(ticker)
    ]);

    const symbolData = {
      symbol: ticker,
      executives: executiveData.status === 'fulfilled' ? executiveData.value : { country: 'Error', executives: [] },
      premarketLow: premarketLow.status === 'fulfilled' ? premarketLow.value : null,
      previousClose: previousClose.status === 'fulfilled' ? previousClose.value : 0,
      isEtfEtn: isEtfEtn.status === 'fulfilled' ? isEtfEtn.value : '',
      news: newsData.status === 'fulfilled' ? newsData.value : [],
      secFiling: secFiling.status === 'fulfilled' ? secFiling.value : 'No SEC filings found'
    };

    return NextResponse.json({
      success: true,
      data: symbolData
    });

  } catch (error) {
    console.error('💥 Error processing symbol:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    const isTimeout = errorMessage.includes('timeout') || errorMessage.includes('ETIMEDOUT');
    
    return NextResponse.json(
      { 
        success: false, 
        error: isTimeout ? 
          'Request timeout - external services may be slow. Please try again.' : 
          `Failed to process symbol: ${errorMessage}`,
        errorType: isTimeout ? 'TIMEOUT' : 'PROCESSING_ERROR'
      },
      { status: isTimeout ? 503 : 500 }
    );
  }
}

// Convert the Google Sheets functions to Next.js compatible functions
async function scrapeYahooProfileExecutives(ticker: string) {
  const url = `https://finance.yahoo.com/quote/${ticker}/profile/`;
  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9"
  };

  const maxRetries = 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`📈 Attempt ${attempt}/${maxRetries} to fetch Yahoo profile for ${ticker}`);
      
      // Create AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
      
      const response = await fetch(url, { 
        headers,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const html = await response.text();
      const $ = cheerio.load(html);
      const execs: Array<{name: string, title: string}> = [];

      // Try multiple selectors for executives table
      const tableSelectors = [
        "div.table-container.yf-mj92za tbody tr",
        "table[data-test='executives-table'] tbody tr",
        "div[data-test='qsp-profile'] table tbody tr",
        ".executives-table tbody tr",
        "table.W\\(100\\%\\) tbody tr"
      ];

      let foundExecs = false;
      for (const selector of tableSelectors) {
        $(selector).each((i, el) => {
          const name = $(el).find("td").eq(0).text().trim();
          const title = $(el).find("td").eq(1).text().trim();
          if (name && title && name !== "Name" && title !== "Title") {
            execs.push({ name, title });
            foundExecs = true;
          }
        });
        if (foundExecs) break;
      }

      // Try multiple selectors for country/address
      const addressSelectors = [
        "div.address.yf-wxp4ja > div",
        "div[data-test='qsp-profile'] div.address div",
        ".company-address div",
        "div.company-info div.address div"
      ];

      let country = "";
      for (const selector of addressSelectors) {
        const addressDiv = $(selector).last();
        if (addressDiv.length) {
          country = addressDiv.text().trim();
          if (country) break;
        }
      }

      console.log(`✅ Successfully scraped Yahoo profile for ${ticker}: ${execs.length} executives, country: ${country}`);
      
      return {
        country: country || "Unknown",
        executives: execs
      };

    } catch (error) {
      lastError = error as Error;
      const errorMsg = error instanceof Error ? error.message : String(error);
      
      if (errorMsg.includes('aborted') || errorMsg.includes('ETIMEDOUT')) {
        console.log(`⏳ Attempt ${attempt} timed out for ${ticker}, retrying...`);
      } else {
        console.log(`❌ Attempt ${attempt} failed for ${ticker}: ${errorMsg}`);
      }
      
      if (attempt < maxRetries) {
        const delay = attempt * 1000; // Progressive delay
        console.log(`⏳ Waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  console.log(`🔥 All attempts failed for Yahoo profile ${ticker}: ${lastError?.message}`);
  return { 
    country: "Error - Unable to fetch", 
    executives: [] 
  };
}

async function getPremarketLow(ticker: string) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1m&range=1d&includePrePost=true`;
  const maxRetries = 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`📈 Attempt ${attempt}/${maxRetries} to fetch premarket data for ${ticker}`);
      
      // Create AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      const response = await fetch(url, {
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
    const result = data.chart.result?.[0];
    if (!result) return null;

    const timestamps = result.timestamp;
    if (!timestamps || !Array.isArray(timestamps)) return null;

    const quote = result.indicators.quote?.[0];
    if (!quote || !Array.isArray(quote.low)) return null;

    const lows = quote.low;
    const preStart = result.meta.currentTradingPeriod.pre?.start;
    const preEnd = result.meta.currentTradingPeriod.pre?.end;

    if (!preStart || !preEnd) return null;

    let premarketLows: Array<{ts: number, price: number}> = [];

    for (let i = 0; i < timestamps.length; i++) {
      const ts = timestamps[i];
      const low = lows[i];
      if (ts >= preStart && ts < preEnd && low != null) {
        premarketLows.push({ ts, price: low });
      }
    }

    if (premarketLows.length === 0) return null;

    const preLow = premarketLows.reduce((min, d) => d.price < min.price ? d : min);
    console.log(`✅ Successfully fetched premarket low for ${ticker}: ${preLow.price}`);
    return `${(Math.round(preLow.price * 100) / 100).toFixed(2)}`;

    } catch (error) {
      lastError = error as Error;
      const errorMsg = error instanceof Error ? error.message : String(error);
      
      if (errorMsg.includes('aborted') || errorMsg.includes('ETIMEDOUT')) {
        console.log(`⏳ Premarket attempt ${attempt} timed out for ${ticker}, retrying...`);
      } else {
        console.log(`❌ Premarket attempt ${attempt} failed for ${ticker}: ${errorMsg}`);
      }
      
      if (attempt < maxRetries) {
        const delay = attempt * 1000; // Progressive delay
        console.log(`⏳ Waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  console.log(`🔥 All premarket attempts failed for ${ticker}: ${lastError?.message}`);
  return null;
}

async function getPreviousClose(ticker: string) {
  const maxRetries = 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`💰 Attempt ${attempt}/${maxRetries} to fetch previous close for ${ticker}`);
      
      // Create AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      // Try Yahoo Finance first
      const yahooResponse = await fetch(`https://finance.yahoo.com/quote/${ticker}/`, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

    if (yahooResponse.ok) {
      const html = await yahooResponse.text();
      const $ = cheerio.load(html);
      const previousClose = $('fin-streamer[data-field="regularMarketPreviousClose"]').attr('data-value');
      
      if (previousClose) {
        const price = parseFloat(previousClose);
        if (!isNaN(price)) {
          console.log(`✅ Successfully fetched previous close for ${ticker}: ${price}`);
          return price;
        }
      }
    }

    return 0;

    } catch (error) {
      lastError = error as Error;
      const errorMsg = error instanceof Error ? error.message : String(error);
      
      if (errorMsg.includes('aborted') || errorMsg.includes('ETIMEDOUT')) {
        console.log(`⏳ Previous close attempt ${attempt} timed out for ${ticker}, retrying...`);
      } else {
        console.log(`❌ Previous close attempt ${attempt} failed for ${ticker}: ${errorMsg}`);
      }
      
      if (attempt < maxRetries) {
        const delay = attempt * 1000; // Progressive delay
        console.log(`⏳ Waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  console.log(`🔥 All previous close attempts failed for ${ticker}: ${lastError?.message}`);
  return 0;
}

async function checkEtnEtf(symbol: string) {
  const baseUrl = "https://stockanalysis.com/api/screener/e/f?m=s&s=asc&c=s,n,assetClass,aum&cn=500&i=etf&p=";
  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
  };
  const maxRetries = 2; // Fewer retries for this API since it's less critical
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🏷️ Attempt ${attempt}/${maxRetries} to check ETF/ETN status for ${symbol}`);
      
      // Check first few pages
      for (let page = 1; page <= 3; page++) {
        const url = baseUrl + page;
        
        // Create AbortController for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout
        
        const response = await fetch(url, { 
          headers,
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
      
      if (!response.ok) continue;

      const json = await response.json();
      
        if (json.data && json.data.data && Array.isArray(json.data.data)) {
          const found = json.data.data.some((item: any) => 
            item.s && item.s.toUpperCase() === symbol.toUpperCase()
          );
          
          if (found) {
            console.log(`✅ Found ${symbol} as ETF/ETN`);
            return "YES";
          }
        }
      }
      
      console.log(`✅ Successfully checked ETF/ETN status for ${symbol}: Not found`);
      return "";

    } catch (error) {
      lastError = error as Error;
      const errorMsg = error instanceof Error ? error.message : String(error);
      
      if (errorMsg.includes('aborted') || errorMsg.includes('ETIMEDOUT')) {
        console.log(`⏳ ETF/ETN check attempt ${attempt} timed out for ${symbol}, retrying...`);
      } else {
        console.log(`❌ ETF/ETN check attempt ${attempt} failed for ${symbol}: ${errorMsg}`);
      }
      
      if (attempt < maxRetries) {
        const delay = attempt * 1000; // Progressive delay
        console.log(`⏳ Waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  console.log(`🔥 All ETF/ETN check attempts failed for ${symbol}: ${lastError?.message}`);
  return "";
}

async function scrapeZacksNews(ticker: string = "CSCI") {
  const url = `https://www.zacks.com/data_handler/stocks/stock_quote_news.php?provider=others&cat=${ticker}&limit=30&record=1`;
  const maxRetries = 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`📰 Attempt ${attempt}/${maxRetries} to fetch Zacks news for ${ticker}`);
      
      // Create AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      const response = await fetch(url, {
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const html = await response.text();
    const $ = cheerio.load(html);
    const articles: Array<{title: string, link: string, time: string}> = [];

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const cutoffDate = new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000);

    $("article").each((i, el) => {
      if (articles.length >= 15) return false;

      const title = $(el).find("h1 a").text().trim();
      const relativeLink = $(el).find("h1 a").attr("href");
      const timeElement = $(el).find("time");
      const datetimeStr = timeElement.attr("datetime");
      const timeStr = timeElement.text().trim();

      if (!datetimeStr || !relativeLink) return;

      const parsedDate = new Date(datetimeStr);
      parsedDate.setHours(0, 0, 0, 0);

      if (parsedDate < cutoffDate) return;

      const fullPageUrl = "https://www.zacks.com" + relativeLink;
      articles.push({ 
        title, 
        link: fullPageUrl, 
        time: timeStr.split("EST")[0] 
      });
    });

    console.log(`✅ Successfully fetched ${articles.length} Zacks news articles for ${ticker}`);
    return articles;

    } catch (error) {
      lastError = error as Error;
      const errorMsg = error instanceof Error ? error.message : String(error);
      
      if (errorMsg.includes('aborted') || errorMsg.includes('ETIMEDOUT')) {
        console.log(`⏳ Zacks news attempt ${attempt} timed out for ${ticker}, retrying...`);
      } else {
        console.log(`❌ Zacks news attempt ${attempt} failed for ${ticker}: ${errorMsg}`);
      }
      
      if (attempt < maxRetries) {
        const delay = attempt * 1000; // Progressive delay
        console.log(`⏳ Waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  console.log(`🔥 All Zacks news attempts failed for ${ticker}: ${lastError?.message}`);
  return [];
}

async function getSecFiling(symbol: string) {
  const url = `https://www.stocktitan.net/sec-filings/${symbol.toUpperCase()}`;
  const maxRetries = 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`📄 Attempt ${attempt}/${maxRetries} to fetch SEC filings for ${symbol}`);
      
      // Create AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.status === 404) {
        return `Page not found for ${symbol}`;
      } else if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const html = await response.text();
      const $ = cheerio.load(html);

      // Find the first filing
      const headers = $('.news-row-header');
      let firstFiling: any = null;
      
      headers.each(function() {
        const titleDiv = $(this).find('.title');
        if (titleDiv.length > 0 && titleDiv.text().trim() === 'Filing') {
          firstFiling = $(this);
          return false; // Stop after finding the first one
        }
      });

      if (!firstFiling) {
        return `No SEC Filings for ${symbol} in 3 days`;
      }

      // Get the container (parent of the header)
      const container = firstFiling.parent();

      // Get the title and link
      const titleElem = container.find('a').first();
      const title = titleElem.text().trim();
      let link = titleElem.attr('href');
      
      if (link && !link.startsWith('https://')) {
        link = 'https://www.stocktitan.net' + link;
      }
      
      if (!link) {
        return `No link found for ${symbol}`;
      }

      // Get the datetime
      const dateStr = firstFiling.find('time').attr('datetime');
      if (!dateStr) {
        return `No date found for ${symbol}`;
      }
      
      const filingDate = new Date(dateStr);
      const displayDate = firstFiling.find('span[data-role="date"]').text().trim();

      // Date checks
      const currentDate = new Date();
      const threeDaysAgo = new Date(currentDate);
      threeDaysAgo.setDate(currentDate.getDate() - 3);

      if (filingDate < threeDaysAgo) {
        return `No SEC Filings for ${symbol} in 3 days`;
      }

      console.log(`✅ Successfully fetched SEC filing for ${symbol}`);
      return `${title} (${displayDate}) - ${link}`;

    } catch (error) {
      lastError = error as Error;
      const errorMsg = error instanceof Error ? error.message : String(error);
      
      if (errorMsg.includes('aborted') || errorMsg.includes('ETIMEDOUT')) {
        console.log(`⏳ SEC filing attempt ${attempt} timed out for ${symbol}, retrying...`);
      } else {
        console.log(`❌ SEC filing attempt ${attempt} failed for ${symbol}: ${errorMsg}`);
      }
      
      if (attempt < maxRetries) {
        const delay = attempt * 1000; // Progressive delay
        console.log(`⏳ Waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  console.log(`🔥 All SEC filing attempts failed for ${symbol}: ${lastError?.message}`);
  return `No SEC filings found - ${lastError?.message || 'Unknown error'}`;
}
