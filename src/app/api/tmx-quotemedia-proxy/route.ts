import { NextRequest, NextResponse } from 'next/server';
import { getQuoteMediaSid, clearCachedSid, generateDataToolToken } from '@/lib/quotemedia-auth';

// QuoteMedia authentication - use environment variables
const QUOTEMEDIA_CONFIG = {
  wmid: process.env.QUOTEMEDIA_WEBMASTER_ID || '101020', // Use webmaster ID from working example
  baseUrl: 'https://app.quotemedia.com',
  endpoint: '/datatool/getMarketStats.json'
};



// Parse HTML response from TMX PowerStream
function parseTMXMarketData(htmlText: string): any[] {
  try {
    // TMX PowerStream returns HTML tables with market data
    // This is a basic parser that extracts data from HTML tables
    
    // Look for data patterns in the HTML response
    const quotes: any[] = [];
    
    // Look for JavaScript data embedded in the HTML (QuoteMedia pattern)
    const jsDataPatterns = [
      /var\s+data\s*=\s*(\{[\s\S]*?\});/,
      /window\.marketData\s*=\s*(\{[\s\S]*?\});/,
      /"quotes":\s*(\[[\s\S]*?\])/,
      /marketMoversData\s*=\s*(\{[\s\S]*?\});/
    ];
    
    for (const pattern of jsDataPatterns) {
      const match = htmlText.match(pattern);
      if (match) {
        try {
          const jsonData = JSON.parse(match[1]);
          if (jsonData && typeof jsonData === 'object') {
            console.log('✅ Found embedded JavaScript data');
            // If it's already structured data, return it
            if (Array.isArray(jsonData)) return jsonData;
            if (jsonData.quotes && Array.isArray(jsonData.quotes)) return jsonData.quotes;
            if (jsonData.data && Array.isArray(jsonData.data)) return jsonData.data;
            if (jsonData.results && Array.isArray(jsonData.results)) return jsonData.results;
          }
        } catch (e) {
          console.log('Failed to parse JavaScript data:', e instanceof Error ? e.message : 'Unknown error');
        }
      }
    }
    
    // Check if this is JSON embedded in HTML (fallback)
    const jsonMatch = htmlText.match(/{[\s\S]*}/);
    if (jsonMatch) {
      try {
        const jsonData = JSON.parse(jsonMatch[0]);
        if (jsonData && typeof jsonData === 'object') {
          // If it's already structured data, return it
          if (Array.isArray(jsonData)) return jsonData;
          if (jsonData.quotes && Array.isArray(jsonData.quotes)) return jsonData.quotes;
          if (jsonData.data && Array.isArray(jsonData.data)) return jsonData.data;
        }
      } catch (e) {
        console.log('Not embedded JSON, parsing as HTML...');
      }
    }
    
    // Basic HTML table parsing for TMX data
    // Look for table rows with market data
    const rows = htmlText.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || [];
    
    for (const row of rows) {
      const cells = row.match(/<td[^>]*>([\s\S]*?)<\/td>/gi) || [];
      if (cells.length >= 3) { // Minimum expected columns
        const symbol = cells[0]?.replace(/<[^>]*>/g, '').trim();
        const price = cells[1]?.replace(/<[^>]*>/g, '').trim();
        const change = cells[2]?.replace(/<[^>]*>/g, '').trim();
        
        if (symbol && price) {
          quotes.push({
            symbol: symbol,
            last: parseFloat(price) || 0,
            change: parseFloat(change) || 0,
            source: 'TMX PowerStream',
            timestamp: new Date().toISOString()
          });
        }
      }
    }
    
    // If no table data found, return a sample structure for debugging
    if (quotes.length === 0) {
      console.log('⚠️ No market data parsed from HTML, returning debug info');
      return [{
        symbol: 'DEBUG',
        last: 0,
        change: 0,
        source: 'TMX PowerStream',
        timestamp: new Date().toISOString(),
        rawHtmlLength: htmlText.length,
        debug: 'No parseable market data found in HTML response'
      }];
    }
    
    return quotes;
    
  } catch (error) {
    console.error('❌ Error parsing TMX market data:', error);
    return [{
      symbol: 'ERROR',
      last: 0,
      change: 0,
      source: 'TMX PowerStream',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown parsing error'
    }];
  }
}

// QuoteMedia API proxy using the working US stocks endpoint
export async function GET(request: NextRequest) {
  console.log('🔗 QuoteMedia US Stocks API called');
  
  const { searchParams } = new URL(request.url);
  let sessionId: string = '';
  
  try {
    // Get fresh session ID from authentication
    let sessionId: string;
    try {
      sessionId = await getQuoteMediaSid();
      console.log('✅ Got QuoteMedia session ID:', sessionId.substring(0, 10) + '...');
    } catch (error) {
      console.error('❌ Failed to get QuoteMedia session:', error);
      return NextResponse.json({
        success: false,
        error: `Authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        errorType: 'AUTH_FAILED'
      }, { status: 401 });
    }

    // Extract parameters from the request with defaults matching the working example
    const marketSession = searchParams.get('marketSession') || 'PRE'; // Use PRE as working example
    const stat = searchParams.get('stat') || 'pg'; // percent gainers as in working example
    const statTop = searchParams.get('statTop') || '100';
    const statCountry = searchParams.get('statCountry') || 'US';
    const category = searchParams.get('category') || 'Market Movers';
    
    console.log('🔍 Category received:', category);
    
    // Map category to qmodTool parameter
    const categoryToQmodTool: Record<string, string> = {
      'Market Overview': 'MarketOverview',
      'Market Indices': 'MarketIndices', 
      'Market Movers': 'MarketMovers',
      'Market Performers': 'MarketPerformers',
      'Market Heatmaps': 'MarketHeatmaps',
      'Market Forex': 'MarketForex',
      'Market Rates': 'MarketRates',
      'Market Calendars': 'MarketCalendars',
      'Market Options': 'MarketOptions',
      'Market Industries': 'MarketIndustries',
      'Market Constituents': 'MarketConstituents',
      'Market Filings': 'MarketFilings'
    };
    
    const qmodTool = categoryToQmodTool[category] || 'MarketMovers'; // Default to MarketMovers
    
    console.log('🔧 qmodTool mapped to:', qmodTool);
    
    // Generate pathName based on the tool (from working example)
    const toolToPathName: Record<string, string> = {
      'MarketMovers': '/marketmovers/',
      'MarketOverview': '/marketoverview/',
      'MarketIndices': '/marketindices/',
      'MarketPerformers': '/marketperformers/',
      'MarketHeatmaps': '/marketheatmaps/',
      'MarketForex': '/marketforex/',
      'MarketRates': '/marketrates/',
      'MarketCalendars': '/marketcalendars/',
      'MarketOptions': '/marketoptions/',
      'MarketIndustries': '/marketindustries/',
      'MarketConstituents': '/marketconstituents/',
      'MarketFilings': '/marketfilings/'
    };
    
    const pathName = toolToPathName[qmodTool] || '/marketmovers/';
    
    console.log('🛤️ pathName mapped to:', pathName);

    // Build the correct URL using getMarketStats.json endpoint with working parameters
    // Match the exact parameter order and names from working example
    const quoteMediaParams = new URLSearchParams({
      marketSession: marketSession,
      pathName: pathName,
      qmodTool: qmodTool,
      sid: sessionId,
      stat: stat,
      statCountry: statCountry,
      statTop: statTop,
      timezone: 'true',
      webmasterId: '101020' // Always use 101020 as in working example
    });

    // Add premarket=true for PRE market sessions (critical from working example)
    if (marketSession === 'PRE') {
      quoteMediaParams.set('premarket', 'true');
    }

    const quoteMediaUrl = `${QUOTEMEDIA_CONFIG.baseUrl}${QUOTEMEDIA_CONFIG.endpoint}?${quoteMediaParams.toString()}`;

    console.log('🌐 Making request to QuoteMedia:', quoteMediaUrl);

    // First, let's try the actual QuoteMedia API and see what we get
    console.log('🔑 Attempting real QuoteMedia API call...');

    // Get a fresh datatool token
    let dataToolToken: string;
    try {
      dataToolToken = await generateDataToolToken();
      console.log('✅ Got fresh Datatool-Token:', dataToolToken.substring(0, 32) + '...');
    } catch (error) {
      console.error('❌ Failed to generate datatool token:', error);
      return NextResponse.json({
        success: false,
        error: `Token generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        errorType: 'TOKEN_FAILED'
      }, { status: 401 });
    }

    // Build QuoteMedia headers matching your working curl example exactly
    const headers: Record<string, string> = {
      'Accept': '*/*',
      'Accept-Encoding': 'gzip, deflate, br, zstd',
      'Accept-Language': 'en',
      'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
      'datatool-token': dataToolToken,
      'Origin': 'https://qrm.quotemedia.com',
      'Referer': 'https://qrm.quotemedia.com/',
      'Sec-Ch-Ua': '"Google Chrome";v="141", "Not?A_Brand";v="8", "Chromium";v="141"',
      'Sec-Ch-Ua-Mobile': '?0',
      'Sec-Ch-Ua-Platform': '"Linux"',
      'Sec-Fetch-Dest': 'empty',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Site': 'same-site',
      'Sec-Fetch-Storage-Access': 'active',
      'Priority': 'u=1, i'
    };

    console.log('📋 QuoteMedia request headers configured');

    const response = await fetch(quoteMediaUrl, {
      method: 'GET',
      headers
    });

    console.log('📊 QuoteMedia Response Status:', response.status, response.statusText);
    console.log('📋 QuoteMedia Response Headers:', Object.fromEntries(response.headers.entries()));

    if (response.ok) {
      const responseText = await response.text();
      console.log('📄 QuoteMedia Raw Response Length:', responseText.length);
      console.log('📄 QuoteMedia Raw Response Preview:', responseText.substring(0, 500));
      
      let jsonData;
      try {
        jsonData = JSON.parse(responseText);
        console.log('✅ QuoteMedia JSON data parsed successfully');
        console.log('🔍 QuoteMedia JSON Structure:', Object.keys(jsonData));
        console.log('📊 QuoteMedia Full Response:', JSON.stringify(jsonData, null, 2).substring(0, 1000));
      } catch (parseError) {
        console.error('❌ Failed to parse QuoteMedia response as JSON:', parseError);
        console.log('📄 Raw response that failed to parse:', responseText.substring(0, 200));
        
        return NextResponse.json({
          error: 'Failed to parse QuoteMedia API response',
          details: parseError instanceof Error ? parseError.message : 'Unknown parsing error',
          rawResponse: responseText.substring(0, 500)
        }, { status: 502 });
      }
      
      // Extract market stats from the QuoteMedia getMarketStats.json response
      let marketStats = [];
      if (jsonData && jsonData.results && jsonData.results.quote) {
        marketStats = jsonData.results.quote;
        console.log('📊 Found', marketStats.length, 'market stats in response');
      } else if (jsonData && jsonData.results && jsonData.results.stock) {
        marketStats = jsonData.results.stock;
        console.log('📊 Found', marketStats.length, 'market stats (stock format)');
      } else if (jsonData && Array.isArray(jsonData)) {
        marketStats = jsonData;
        console.log('📊 Found', marketStats.length, 'market stats (array format)');
      } else {
        console.warn('⚠️ Unexpected JSON structure for getMarketStats:', Object.keys(jsonData));
        console.log('📊 Available keys in results:', jsonData.results ? Object.keys(jsonData.results) : 'No results object');
        marketStats = [];
      }
      
      // Transform QuoteMedia market stats data to our expected format
      const transformedData = {
        success: true,
        timestamp: new Date().toISOString(),
        source: `QuoteMedia Market Stats - ${marketSession} SESSION`,
        marketSession: marketSession,
        statCountry: statCountry,
        stat: stat,
        qmodTool: qmodTool,
        pathName: pathName,
        totalSymbols: marketStats.length,
        quotes: marketStats.map((stock: any) => ({
          symbol: stock.key?.symbol || stock.symbol || 'N/A',
          price: parseFloat(stock.pricedata?.last || stock.last || stock.price || 0),
          change: parseFloat(stock.pricedata?.change || stock.change || 0),
          changePercent: parseFloat(stock.pricedata?.changepercent || stock.changepercent || stock.changePercent || 0),
          // All pricedata fields
          tick: parseInt(stock.pricedata?.tick || 0),
          open: parseFloat(stock.pricedata?.open || stock.open || 0),
          high: parseFloat(stock.pricedata?.high || stock.high || 0),
          low: parseFloat(stock.pricedata?.low || stock.low || 0),
          previousClose: parseFloat(stock.pricedata?.prevclose || stock.prevclose || stock.previousClose || 0),
          bid: parseFloat(stock.pricedata?.bid || stock.bid || 0),
          ask: parseFloat(stock.pricedata?.ask || stock.ask || 0),
          bidSize: parseInt(stock.pricedata?.bidsize || stock.bidsize || 0),
          askSize: parseInt(stock.pricedata?.asksize || stock.asksize || 0),
          rawBidSize: parseInt(stock.pricedata?.rawbidsize || stock.rawbidsize || 0),
          rawAskSize: parseInt(stock.pricedata?.rawasksize || stock.rawasksize || 0),
          tradevolume: parseInt(stock.pricedata?.tradevolume || stock.tradevolume || 0),
          sharevolume: parseInt(stock.pricedata?.sharevolume || stock.sharevolume || stock.volume || 0),
          volume: parseInt(stock.pricedata?.sharevolume || stock.sharevolume || stock.volume || 0),
          vwap: parseFloat(stock.pricedata?.vwap || stock.vwap || 0),
          vwapvolume: parseInt(stock.pricedata?.vwapvolume || stock.vwapvolume || 0),
          // Additional fields
          marketCap: stock.marketcap || stock.fundamental?.marketcap || 0,
          eps: stock.eps || stock.fundamental?.eps || null,
          peRatio: stock.peratio || stock.fundamental?.peratio || null,
          pbRatio: stock.pbratio || stock.fundamental?.pbratio || null,
          week52High: stock.week52high || stock.fundamental?.week52high?.content || 0,
          week52Low: stock.week52low || stock.fundamental?.week52low?.content || 0,
          exchange: stock.exchange || stock.key?.exchange || 'US',
          exchangeLongName: stock.exchangeLongName || stock.key?.exLgName || 'US Exchange',
          companyName: stock.equityinfo?.longname || stock.companyname || stock.longname || stock.equityinfo?.shortname || 'N/A',
          shortName: stock.equityinfo?.shortname || stock.shortname || stock.equityinfo?.longname || 'N/A',
          datatype: stock.datatype || 'equity',
          symbolString: stock.key?.symbol || stock.symbolstring || stock.symbol,
          lastTradeTime: stock.pricedata?.lasttradedatetime || stock.lasttradedatetime || new Date().toISOString(),
          entitlement: stock.entitlement || 'RT'
        })),
        sessionId: sessionId,
        copyright: jsonData.results?.copyright || 'Real-time market data from QuoteMedia',
        symbolCount: jsonData.results?.symbolcount || marketStats.length
      };

      return NextResponse.json(transformedData);
    } else {
      console.error('❌ QuoteMedia API error:', response.status, response.statusText);
      const errorText = await response.text();
      console.error('📄 Error response body:', errorText);
      
      if (response.status === 403) {
        console.log('❌ QuoteMedia API access denied - account permissions insufficient');
        console.log('🔍 Endpoint:', quoteMediaUrl);
        console.log('🔑 Session ID:', sessionId.substring(0, 8) + '...');
        
        return NextResponse.json({
          error: 'QuoteMedia API access denied',
          message: 'Account lacks permissions for the requested data endpoint',
          status: 403,
          endpoint: quoteMediaUrl,
          suggestions: [
            'Check QuoteMedia account subscription level',
            'Verify endpoint access permissions',
            'Contact QuoteMedia support for account upgrade'
          ]
        }, { status: 403 });
      }
      
      return NextResponse.json(
        { 
          success: false, 
          error: `QuoteMedia API returned ${response.status}: ${response.statusText}`,
          errorBody: errorText,
          sessionId: sessionId
        },
        { status: response.status }
      );
    }

  } catch (error) {
    console.error('❌ QuoteMedia proxy error:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error connecting to QuoteMedia API',
        sessionId: sessionId
      },
      { status: 500 }
    );
  }
}

// Additional stat types for different market movers
const STAT_TYPES = {
  'ah': 'After Hours Movers',
  'dv': 'Dollar Volume Leaders', 
  'vol': 'Volume Leaders',
  'pg': 'Percent Gainers',
  'pl': 'Percent Losers',
  'ng': 'Net Gainers',
  'nl': 'Net Losers'
};

// Market session types
const MARKET_SESSIONS = {
  'NORMAL': 'Regular Market Hours',
  'PRE': 'Pre-Market',
  'POST': 'After-Hours'
};

// Health check for the QuoteMedia proxy
export async function POST(request: Request) {
  let currentSessionId = 'Not authenticated';
  try {
    currentSessionId = await getQuoteMediaSid();
  } catch (error) {
    console.log('Cannot get session ID for health check:', error);
  }
  
  return NextResponse.json({
    success: true,
    message: 'QuoteMedia US Stocks API is operational',
    authentication: {
      wmid: QUOTEMEDIA_CONFIG.wmid,
      method: 'datatool-token',
      sessionId: currentSessionId,
      endpoint: 'getMarketStats.json'
    },
    endpoints: {
      realtime: 'GET /?marketSession=<NORMAL|PRE|POST>&stat=<ah|dv|vol>&statTop=<100|200>',
      health: 'POST /'
    },
    parameters: {
      marketSession: ['NORMAL', 'PRE', 'POST'],
      stat: ['ah', 'dv', 'vol'], // after hours, dollar volume, volume
      statCountry: 'US',
      statTop: ['50', '100', '200']
    },
    timestamp: new Date().toISOString()
  });
}