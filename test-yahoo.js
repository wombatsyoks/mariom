const cheerio = require('cheerio');

async function testYahooProfile(ticker) {
  const url = `https://finance.yahoo.com/quote/${ticker}/`;
  console.log(`🔍 Testing Yahoo Quote for ${ticker} from ${url}`);
  
  const headers = {
    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br, zstd",
    "Cache-Control": "max-age=0",
    "Connection": "keep-alive",
    "DNT": "1",
    "Sec-Ch-Ua": '"Google Chrome";v="129", "Not=A?Brand";v="8", "Chromium";v="129"',
    "Sec-Ch-Ua-Mobile": "?0",
    "Sec-Ch-Ua-Platform": '"Linux"',
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
    "Upgrade-Insecure-Requests": "1"
  };

  try {
    console.log(`📡 Making request...`);
    const response = await fetch(url, { 
      headers,
      method: 'GET',
      redirect: 'follow'
    });
    
    console.log(`📊 Response status: ${response.status} ${response.statusText}`);
    console.log(`📊 Response headers:`, Object.fromEntries(response.headers.entries()));
    
    if (!response.ok) {
      const errorText = await response.text();
      console.log(`❌ HTTP Error ${response.status}:`, errorText.substring(0, 500));
      return;
    }

    const html = await response.text();
    console.log(`📄 HTML response length: ${html.length} characters`);
    console.log(`📄 HTML preview:`, html.substring(0, 500) + '...');
    
    // Check if we're getting blocked or redirected
    if (html.includes('blocked') || html.includes('captcha') || html.includes('robot')) {
      console.log('🚫 Likely blocked by Yahoo');
      return;
    }
    
    const $ = cheerio.load(html);
    
    // Test various selectors
    const testSelectors = [
      "div.table-container.yf-mj92za table.yf-mj92za tbody tr.yf-mj92za",
      "div.table-container tbody tr",
      "table tbody tr",
      "tr"
    ];
    
    for (const selector of testSelectors) {
      const elements = $(selector);
      console.log(`🔍 Selector "${selector}": ${elements.length} elements found`);
      
      if (elements.length > 0) {
        elements.slice(0, 3).each((i, el) => {
          const cells = $(el).find('td');
          if (cells.length >= 2) {
            const name = cells.eq(0).text().trim();
            const title = cells.eq(1).text().trim();
            console.log(`  Row ${i}: "${name}" | "${title}"`);
          }
        });
      }
    }
    
    // Check for specific indicators of profile page
    console.log(`🔍 Page title: "${$('title').text()}"`);
    console.log(`🔍 Body class: "${$('body').attr('class')}"`);
    console.log(`🔍 Contains "executives": ${html.toLowerCase().includes('executives')}`);
    console.log(`🔍 Contains "profile": ${html.toLowerCase().includes('profile')}`);
    
  } catch (error) {
    console.log(`🚫 Error:`, error.message);
  }
}

// Test with AAPL
testYahooProfile('AAPL').then(() => {
  console.log('Test completed');
});
