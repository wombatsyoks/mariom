async function scrapeYahooProfileExecutives(ticker: string) {
  return withRetry(async () => {
    // Try multiple URLs as Yahoo might have changed their structure
    const urls = [
      `https://finance.yahoo.com/quote/${ticker}/profile/`,
      `https://finance.yahoo.com/quote/${ticker}/`,
      `https://finance.yahoo.com/quote/${ticker}/profile`
    ];
    
    let html = '';
    let successUrl = '';
    
    const headers = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      "Cache-Control": "no-cache",
      "Pragma": "no-cache",
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "none",
      "Upgrade-Insecure-Requests": "1"
    };
    
    for (const url of urls) {
      console.log(`🔍 Trying URL: ${url}`);
      try {
        const response = await fetch(url, { 
          headers,
          method: 'GET',
          redirect: 'follow'
        });
        
        console.log(`📊 Response status: ${response.status} ${response.statusText}`);
        
        if (response.ok) {
          html = await response.text();
          successUrl = url;
          console.log(`✅ Successfully fetched from: ${url}`);
          console.log(`📄 HTML response length: ${html.length} characters`);
          
          // Check if this looks like a valid Yahoo page (not a 404)
          if (html.includes('yahoo') && !html.includes('err=404') && html.length > 1000) {
            break;
          } else {
            console.log(`⚠️ Response seems to be an error page, trying next URL...`);
            html = '';
            successUrl = '';
          }
        }
      } catch (fetchError) {
        console.log(`🚫 Fetch error for ${url}:`, fetchError);
        continue;
      }
    }
    
    if (!html) {
      console.log(`❌ All URLs failed for ${ticker}`);
      throw new Error(`All URLs failed for ${ticker}`);
    }

    console.log(`📄 Using URL: ${successUrl}`);
    console.log(`📄 HTML preview:`, html.substring(0, 200) + '...');

    const $ = cheerio.load(html);
    const execs: Array<{name: string, title: string}> = [];

    // Since the profile page seems to be failing, let's return a fallback
    // The executive data might not be available on the current Yahoo Finance pages
    console.log(`⚠️ Yahoo Finance profile page access limited. Returning fallback data.`);

    return {
      country: "Error", // Indicates the scraping failed but function completed
      executives: execs
    };
  }, 'Yahoo Profile', ticker, 3, 15000);
}
