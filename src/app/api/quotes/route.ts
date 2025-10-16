import { NextRequest, NextResponse } from 'next/server';

interface QuoteMediaResponse {
  copyright: string;
  symbolcount: number;
  quotedata: Array<{
    status: any;
    pricedata: {
      last: number;
      change: number;
      changepercent: number;
      tick: number;
      open: number;
      high: number;
      low: number;
      prevclose: number;
      bid: number;
      ask: number;
      bidsize: number;
      asksize: number;
      lasttradesize: number;
      tradevolume: number;
      sharevolume: number;
      lasttradedatetime: string;
      lastquotedatetime: string;
      lastmarketidentificationcode: string;
      bidmarketidentificationcode: string;
      askmarketidentificationcode: string;
      close: number;
      imbalance: {
        imbalancesize: number;
      };
    };
    symbolstring: string;
    symbol: string;
    datatype: string;
    entitlement: string;
    delaymin: number;
    datetime: string;
    iscurrentlyopen: boolean;
    longname: string;
    shortname: string;
    exchange: string;
    isopen: boolean;
    exLgName: string;
    exShName: string;
  }>;
}

interface Quote {
  // Basic identification
  symbol: string;
  companyName: string;
  shortName: string;
  datatype: string;
  
  // Price information
  price: number;
  close: number;
  change: number;
  changePercent: number;
  
  // Daily trading data
  open: number;
  high: number;
  low: number;
  previousClose: number;
  
  // Volume information
  volume: number;
  tradeVolume: number;
  lastTradeSize: number;
  
  // Bid/Ask information
  bid: number;
  ask: number;
  bidSize: number;
  askSize: number;
  
  // Market information
  exchange: string;
  exchangeLongName: string;
  exchangeShortName: string;
  
  // Timing information
  lastUpdate: string;
  lastTradeTime: string;
  exchangeTimestamp: string;
  quoteTimestamp: string;
  
  // Extended fields for complete compatibility
  lastSize: number;
  averageVolume: number;
  marketStatus: string;
  premarketPrice: number;
  afterHoursPrice: number;
  premarketChange: number;
  afterHoursChange: number;
  premarketChangePercent: number;
  afterHoursChangePercent: number;
  exchangeLong: string;
  dollarVolume: number;
  
  // Market status
  isCurrentlyOpen: boolean;
  isOpen: boolean;
  delayMinutes: number;
  
  // Extended fields (may not be available in basic response)
  marketCap: string;
  pe: number | null;
  eps: number | null;
  dividend: number | null;
  yield: number | null;
  beta: number | null;
  sharesOutstanding: string;
  week52High: number;
  week52Low: number;
  
  // Imbalance information
  imbalanceSize: number;
  
  // Market identification codes
  lastMarketId: string;
  bidMarketId: string;
  askMarketId: string;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const symbols = searchParams.get('symbols') || 'MSFT,AAPL,TSLA,NVDA,ACAD,TNFA';
    
    console.log('🔍 /api/quotes called with symbols:', symbols);
    console.log('📋 Full URL:', request.url);

    // Use our working QuoteMedia proxy instead of direct authentication
    const proxyUrl = `http://localhost:3000/api/tmx-quotemedia-proxy?symbols=${encodeURIComponent(symbols)}&stat=dv&statTop=100`;
    console.log('🌐 Calling proxy URL:', proxyUrl);
    
    const proxyResponse = await fetch(proxyUrl, {
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!proxyResponse.ok) {
      console.error('❌ Proxy response error:', proxyResponse.status, proxyResponse.statusText);
      return NextResponse.json({
        success: false,
        error: `QuoteMedia proxy returned ${proxyResponse.status}`,
        quotes: [],
        timestamp: new Date().toISOString()
      }, { status: proxyResponse.status });
    }

    const proxyData = await proxyResponse.json();
    
    console.log('📊 Raw proxy response:', JSON.stringify(proxyData, null, 2));
    console.log('📊 Proxy response structure:', Object.keys(proxyData));
    console.log('📈 Proxy success:', proxyData.success);
    console.log('📈 Proxy quotes count:', proxyData.quotes?.length || 0);
    
    if (proxyData.quotes && proxyData.quotes.length > 0) {
      console.log('📋 Sample proxy quote:', JSON.stringify(proxyData.quotes[0], null, 2));
    }
    
    if (!proxyData.success) {
      console.error('❌ Proxy data error:', proxyData.error);
      return NextResponse.json({
        success: false,
        error: proxyData.error || 'Failed to fetch from QuoteMedia proxy',
        quotes: [],
        timestamp: new Date().toISOString()
      }, { status: 500 });
    }

    console.log('✅ Successfully received', proxyData.quotes?.length || 0, 'quotes from QuoteMedia proxy');

    // Filter quotes by requested symbols if provided
    let filteredQuotes = proxyData.quotes;
    if (symbols && symbols !== 'MSFT,AAPL,TSLA,NVDA,ACAD,TNFA') {
      const requestedSymbols = symbols.split(',').map(s => s.trim().toUpperCase());
      console.log('🔍 Filtering for requested symbols:', requestedSymbols);
      filteredQuotes = proxyData.quotes.filter((quote: any) => 
        requestedSymbols.includes(quote.symbol?.toUpperCase())
      );
      console.log('📊 Filtered to', filteredQuotes.length, 'matching quotes');
    }

    // Transform the proxy data to match our Quote interface using exact field names from working response
    const transformedQuotes: Quote[] = filteredQuotes.map((quoteData: any) => ({
      // Basic identification - exactly as returned from working API
      symbol: quoteData.symbol || '',
      companyName: quoteData.companyName || quoteData.shortName || quoteData.symbol || '',
      shortName: quoteData.shortName || quoteData.companyName || quoteData.symbol || '',
      datatype: quoteData.datatype || 'equity',
      
      // Price information - using exact field names from working proxy response
      price: quoteData.price || 0,
      close: quoteData.price || 0,  // Using current price as close
      change: quoteData.change || 0,
      changePercent: quoteData.changePercent || 0,
      
      // Daily trading data - exact field names
      open: quoteData.open || 0,
      high: quoteData.high || 0,
      low: quoteData.low || 0,
      previousClose: quoteData.prevClose || 0,
      
      // Volume information - exact field names
      volume: quoteData.volume || 0,
      tradeVolume: quoteData.tradevolume || 0,  // Note: tradevolume not tradeVolume
      lastTradeSize: 0,
      
      // Bid/Ask information - exact field names
      bid: quoteData.bid || 0,
      ask: quoteData.ask || 0,
      bidSize: 0,
      askSize: 0,
      
      // Market information - exact field names
      exchange: quoteData.exchange || 'US',
      exchangeLongName: quoteData.exchangeLongName || 'US Exchange',
      exchangeShortName: quoteData.exchange || 'US',
      
      // Timing information
      lastUpdate: new Date().toISOString(),
      lastTradeTime: quoteData.lastTradeTime || new Date().toISOString(),
      exchangeTimestamp: quoteData.lastTradeTime || new Date().toISOString(),
      quoteTimestamp: new Date().toISOString(),
      
      // Extended fields
      lastSize: 0,
      averageVolume: 0,
      marketStatus: 'open',
      premarketPrice: 0,
      afterHoursPrice: 0,
      premarketChange: 0,
      afterHoursChange: 0,
      premarketChangePercent: 0,
      afterHoursChangePercent: 0,
      exchangeLong: quoteData.exchangeLongName || 'US Exchange',
      dollarVolume: (quoteData.price || 0) * (quoteData.volume || 0),
      
      // Market status
      isCurrentlyOpen: true,
      isOpen: true,
      delayMinutes: 0,
      
      // Extended fields from QuoteMedia - exact field names
      marketCap: String(quoteData.marketCap || 0),
      pe: quoteData.peRatio || null,
      eps: quoteData.eps || null,
      dividend: null,
      yield: null,
      beta: null,
      sharesOutstanding: '0',
      week52High: quoteData.week52High || 0,
      week52Low: quoteData.week52Low || 0,
      
      // Imbalance information
      imbalanceSize: 0,
      
      // Market identification codes
      lastMarketId: quoteData.exchange || 'US',
      bidMarketId: quoteData.exchange || 'US',
      askMarketId: quoteData.exchange || 'US'
    }));

    console.log('✅ Returning', transformedQuotes.length, 'transformed quotes');
    if (transformedQuotes.length > 0) {
      console.log('📋 Sample quote:', {
        symbol: transformedQuotes[0].symbol,
        price: transformedQuotes[0].price,
        change: transformedQuotes[0].change,
        companyName: transformedQuotes[0].companyName
      });
    }

    return NextResponse.json({
      success: true,
      quotes: transformedQuotes,
      count: transformedQuotes.length,
      source: 'QuoteMedia US Market Data',
      timestamp: new Date().toISOString(),
      copyright: proxyData.copyright || 'Real-time market data from QuoteMedia'
    });

  } catch (error) {
    console.error('Error fetching QuoteMedia data:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      quotes: [],
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
