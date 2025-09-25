import { NextRequest, NextResponse } from 'next/server';
import { getQuoteMediaSid, clearCachedSid } from '@/lib/quotemedia-auth';

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
    
    console.log('🔍 Fetching real-time quotes for:', symbols);

    // Get authenticated session ID
    let sid: string;
    try {
      sid = await getQuoteMediaSid();
    } catch (authError) {
      console.error('Authentication failed:', authError);
      return NextResponse.json({
        success: false,
        error: 'Failed to authenticate with QuoteMedia',
        quotes: [],
        timestamp: new Date().toISOString()
      }, { status: 401 });
    }

    // Fetch quotes from QuoteMedia API
    const quoteMediaUrl = `https://app.quotemedia.com/data/getSnapQuotes.json?webmasterId=${process.env.QUOTEMEDIA_WEBMASTER_ID || '501'}&symbols=${encodeURIComponent(symbols)}&sid=${sid}`;
    
    const response = await fetch(quoteMediaUrl, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
      },
      next: { revalidate: 0 } // Don't cache, always fetch fresh data
    });

    if (!response.ok) {
      // If we get 401/403, clear cached SID and try once more
      if (response.status === 401 || response.status === 403) {
        console.log('🔄 Authentication expired, retrying with new SID...');
        clearCachedSid();
        
        try {
          const newSid = await getQuoteMediaSid();
          const retryUrl = `https://app.quotemedia.com/data/getSnapQuotes.json?webmasterId=${process.env.QUOTEMEDIA_WEBMASTER_ID || '501'}&symbols=${encodeURIComponent(symbols)}&sid=${newSid}`;
          
          const retryResponse = await fetch(retryUrl, {
            headers: {
              'Accept': 'application/json',
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
            },
            next: { revalidate: 0 }
          });

          if (!retryResponse.ok) {
            throw new Error(`QuoteMedia API error after retry: ${retryResponse.status} ${retryResponse.statusText}`);
          }

          const retryData: QuoteMediaResponse = await retryResponse.json();
          return processQuoteMediaResponse(retryData);
        } catch (retryError) {
          throw new Error(`Failed to retry after authentication: ${retryError}`);
        }
      }
      
      throw new Error(`QuoteMedia API error: ${response.status} ${response.statusText}`);
    }

    const data: QuoteMediaResponse = await response.json();
    return processQuoteMediaResponse(data);

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

function processQuoteMediaResponse(data: QuoteMediaResponse) {
  console.log('📊 QuoteMedia API Response structure:', JSON.stringify(data, null, 2));
  
  if (!data.quotedata || !Array.isArray(data.quotedata)) {
    throw new Error('Invalid response format from QuoteMedia API');
  }

  // Process and normalize the quote data - capture all available QuoteMedia fields
  const quotes: Quote[] = data.quotedata.map(quoteItem => ({
    // Basic identification
    symbol: quoteItem.symbol || quoteItem.symbolstring || '',
    companyName: quoteItem.longname || quoteItem.shortname || quoteItem.symbol || '',
    shortName: quoteItem.shortname || quoteItem.longname || quoteItem.symbol || '',
    datatype: quoteItem.datatype || 'unknown',
    
    // Price information
    price: quoteItem.pricedata.last || 0,
    close: quoteItem.pricedata.close || quoteItem.pricedata.last || 0,
    change: quoteItem.pricedata.change || 0,
    changePercent: quoteItem.pricedata.changepercent || 0,
    
    // Daily trading data
    open: quoteItem.pricedata.open || 0,
    high: quoteItem.pricedata.high || 0,
    low: quoteItem.pricedata.low || 0,
    previousClose: quoteItem.pricedata.prevclose || 0,
    
    // Volume information
    volume: quoteItem.pricedata.sharevolume || 0,
    tradeVolume: quoteItem.pricedata.tradevolume || 0,
    lastTradeSize: quoteItem.pricedata.lasttradesize || 0,
    
    // Bid/Ask information
    bid: quoteItem.pricedata.bid || 0,
    ask: quoteItem.pricedata.ask || 0,
    bidSize: quoteItem.pricedata.bidsize || 0,
    askSize: quoteItem.pricedata.asksize || 0,
    lastSize: quoteItem.pricedata.lasttradesize || 0,
    
    // Market information
    exchange: quoteItem.exchange || 'N/A',
    exchangeLongName: quoteItem.exLgName || 'N/A',
    exchangeShortName: quoteItem.exShName || quoteItem.exchange || 'N/A',
    exchangeLong: quoteItem.exLgName || quoteItem.exchange || 'N/A',
    
    // Timing information
    lastUpdate: quoteItem.datetime || new Date().toISOString(),
    lastTradeTime: quoteItem.pricedata.lasttradedatetime || quoteItem.datetime || '',
    exchangeTimestamp: quoteItem.datetime || '',
    quoteTimestamp: quoteItem.pricedata.lastquotedatetime || quoteItem.datetime || '',
    
    // Market status information
    isCurrentlyOpen: quoteItem.iscurrentlyopen || false,
    isOpen: quoteItem.isopen || false,
    delayMinutes: quoteItem.delaymin || 0,
    marketStatus: quoteItem.iscurrentlyopen ? 'open' : 'closed',
    
    // Extended fields for complete compatibility (not available in basic QuoteMedia response)
    averageVolume: 0, // Not available in basic response
    premarketPrice: 0, // Not available in basic response
    afterHoursPrice: 0, // Not available in basic response
    premarketChange: 0, // Not available in basic response
    afterHoursChange: 0, // Not available in basic response
    premarketChangePercent: 0, // Not available in basic response
    afterHoursChangePercent: 0, // Not available in basic response
    dollarVolume: (quoteItem.pricedata.sharevolume || 0) * (quoteItem.pricedata.last || 0), // Calculate from available data
    
    // Extended fields (may not be available in basic response)
    marketCap: 'N/A', // Not available in basic QuoteMedia response
    pe: null, // Not available in basic QuoteMedia response
    eps: null, // Not available in basic QuoteMedia response
    dividend: null, // Not available in basic QuoteMedia response
    yield: null, // Not available in basic QuoteMedia response
    beta: null, // Not available in basic QuoteMedia response
    sharesOutstanding: 'N/A', // Not available in basic QuoteMedia response
    week52High: 0, // Not available in basic QuoteMedia response
    week52Low: 0, // Not available in basic QuoteMedia response
    
    // Imbalance information
    imbalanceSize: quoteItem.pricedata.imbalance?.imbalancesize || 0,
    
    // Market identification codes
    lastMarketId: quoteItem.pricedata.lastmarketidentificationcode || 'N/A',
    bidMarketId: quoteItem.pricedata.bidmarketidentificationcode || 'N/A',
    askMarketId: quoteItem.pricedata.askmarketidentificationcode || 'N/A'
  }));

  return NextResponse.json({
    success: true,
    quotes: quotes,
    timestamp: new Date().toISOString(),
    symbolCount: data.symbolcount
  });
}
