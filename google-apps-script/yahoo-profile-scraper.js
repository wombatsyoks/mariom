/**
 * Google Apps Script Yahoo Finance Profile Scraper
 * Deploy this as a web app and use the URL in your Next.js application
 */

function doGet(e) {
  const symbol = e.parameter.symbol;
  
  if (!symbol) {
    return ContentService
      .createTextOutput(JSON.stringify({
        success: false,
        error: 'Symbol parameter is required'
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  try {
    const profileData = scrapeYahooProfile(symbol);
    
    return ContentService
      .createTextOutput(JSON.stringify({
        success: true,
        data: profileData
      }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    console.error('Error scraping Yahoo profile:', error);
    
    return ContentService
      .createTextOutput(JSON.stringify({
        success: false,
        error: error.toString(),
        data: {
          country: "Error",
          executives: []
        }
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function scrapeYahooProfile(symbol) {
  const url = `https://finance.yahoo.com/quote/${symbol}/profile/`;
  const options = {
    muteHttpExceptions: true,
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      "Connection": "keep-alive",
      "Referer": `https://finance.yahoo.com/quote/${symbol}`,
      "Cookie": "A1=dummy; A3=dummy; yktk=dummy_token;"
    }
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    if (response.getResponseCode() !== 200) {
      console.log(`⚠️ Failed to fetch profile for ${symbol}: HTTP ${response.getResponseCode()}`);
      return {
        country: "Unavailable",
        executives: []
      };
    }

    const html = response.getContentText();
    const $ = Cheerio.load(html);
    const execs = [];

    $("div.table-container.yf-mj92za tbody tr").each((i, el) => {
      const name = $(el).find("td").eq(0).text().trim();
      const title = $(el).find("td").eq(1).text().trim();
      if (name && title) {
        execs.push({ name, title });
      }
    });

    const country = $("div.address.yf-wxp4ja > div").last().text().trim();

    return {
      country: country || "Unknown",
      executives: execs
    };
  } catch (error) {
    console.log(`⚠️ Error scraping profile for ${symbol}: ${error.message}`);
    return {
      country: "Error",
      executives: []
    };
  }
}

// Old parsing functions removed - using the working implementation directly in scrapeYahooProfile

// Test function - you can run this in the Apps Script editor to test
function testScraper() {
  const symbol = 'AAPL';
  console.log('Testing with symbol:', symbol);
  
  try {
    const result = scrapeYahooProfile(symbol);
    console.log('Result:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Test failed:', error);
  }
}
