import { NextRequest, NextResponse } from 'next/server';

interface TMXRealtimeRequest {
  symbols: string[];
  sessionId?: string;
  streamType?: 'quotes' | 'level1' | 'level2' | 'trades';
}

interface TMXStreamData {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  bid: number;
  ask: number;
  high: number;
  low: number;
  open: number;
  previousClose: number;
  lastUpdate: string;
  exchange: string;
  marketCap?: number;
  pe?: number;
}

// TMX PowerStream endpoints for real-time data
const TMX_ENDPOINTS = {
  QUOTES: 'https://tmxpowerstream.com/api/quotes.php',
  LEVEL1: 'https://tmxpowerstream.com/api/level1.php', 
  LEVEL2: 'https://tmxpowerstream.com/api/level2.php',
  TRADES: 'https://tmxpowerstream.com/api/trades.php',
  STREAMING: 'https://tmxpowerstream.com/streaming/realtime.php',
  WEB_INTERFACE: 'https://tmxpowerstream.com/powerStreamWeb.php'
};

// Helper function to authenticate and fetch from TMX PowerStream
async function fetchTMXData(endpoint: string, sessionId: string, params: Record<string, string> = {}) {
  const url = new URL(endpoint);
  
  // Add query parameters
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.append(key, value);
  });

  console.log('🔗 Making authenticated TMX request to:', url.toString());
  
  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'Cookie': `PHPSESSID=${sessionId}`,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Referer': 'https://tmxpowerstream.com/streamer.php',
      'Accept': 'application/json, text/html, */*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Cache-Control': 'no-cache',
      'X-Requested-With': 'XMLHttpRequest'
    }
  });

  console.log('📊 TMX Response Status:', response.status);
  
  if (!response.ok) {
    throw new Error(`TMX API error: ${response.status} ${response.statusText}`);
  }

  const contentType = response.headers.get('content-type') || '';
  
  if (contentType.includes('application/json')) {
    return await response.json();
  } else {
    const text = await response.text();
    console.log('📄 TMX Response (HTML/Text):', text.substring(0, 500));
    return parseHTMLData(text);
  }
}

// Parse HTML response for embedded market data
function parseHTMLData(html: string): any {
  console.log('🔍 Parsing TMX HTML response for market data...');
  
  const marketData: TMXStreamData[] = [];
  
  try {
    // Look for JSON data embedded in JavaScript variables
    const jsDataPatterns = [
      /var\s+marketData\s*=\s*(\[.*?\]);/,
      /var\s+quotes\s*=\s*(\[.*?\]);/,
      /window\.stockData\s*=\s*(\{.*?\});/,
      /"quotes":\s*(\[.*?\])/,
      /marketData\s*:\s*(\[.*?\])/
    ];

    for (const pattern of jsDataPatterns) {
      const match = html.match(pattern);
      if (match) {
        try {
          const jsonData = JSON.parse(match[1]);
          console.log('✅ Found embedded market data:', jsonData);
          
          if (Array.isArray(jsonData)) {
            return { quotes: jsonData };
          } else if (jsonData.quotes && Array.isArray(jsonData.quotes)) {
            return jsonData;
          }
        } catch (e) {
          console.log('❌ Failed to parse JSON data:', e);
        }
      }
    }

    // Look for table-based market data
    const tablePattern = /<table[^>]*market[^>]*>(.*?)<\/table>/i;
    const tableMatch = html.match(tablePattern);
    
    if (tableMatch) {
      console.log('📊 Found market data table');
      // Parse table rows for stock data
      const rowPattern = /<tr[^>]*>(.*?)<\/tr>/g;
      const rows = [...tableMatch[1].matchAll(rowPattern)];
      
      for (const row of rows) {
        const cellPattern = /<td[^>]*>(.*?)<\/td>/g;
        const cells = [...row[1].matchAll(cellPattern)];
        
        if (cells.length >= 6) {
          const symbol = cells[0]?.[1]?.replace(/<[^>]*>/g, '').trim();
          const price = parseFloat(cells[1]?.[1]?.replace(/<[^>]*>/g, '') || '0');
          const change = parseFloat(cells[2]?.[1]?.replace(/<[^>]*>/g, '') || '0');
          const volume = parseInt(cells[3]?.[1]?.replace(/<[^>]*>/g, '') || '0');
          
          if (symbol && !isNaN(price)) {
            marketData.push({
              symbol,
              price,
              change,
              changePercent: price > 0 ? (change / (price - change)) * 100 : 0,
              volume,
              bid: 0,
              ask: 0,
              high: price * 1.02,
              low: price * 0.98,
              open: price - change,
              previousClose: price - change,
              lastUpdate: new Date().toISOString(),
              exchange: symbol.includes('.TO') ? 'TSX' : 'NASDAQ'
            });
          }
        }
      }
    }

    // Look for WebSocket or streaming endpoints
    const wsPattern = /wss?:\/\/[^\s'"]+/g;
    const wsUrls = html.match(wsPattern) || [];
    
    if (wsUrls.length > 0) {
      console.log('🔌 Found WebSocket URLs:', wsUrls);
      return { 
        quotes: marketData,
        websockets: wsUrls,
        streamingAvailable: true
      };
    }

    return { quotes: marketData };

  } catch (error) {
    console.error('❌ Error parsing TMX HTML:', error);
    return { quotes: [], error: 'Failed to parse market data' };
  }
}

// Generate sample real-time market data when TMX APIs aren't accessible
function generateRealtimeData(symbols: string[]): TMXStreamData[] {
  return symbols.map(symbol => {
    const basePrice = symbol === 'AAPL' ? 175 :
                     symbol === 'TSLA' ? 240 :
                     symbol === 'GOOGL' ? 140 :
                     symbol === 'MSFT' ? 420 :
                     symbol === 'NVDA' ? 145 :
                     symbol.includes('.TO') ? 85 :
                     Math.floor(Math.random() * 200) + 50;

    const variation = (Math.random() - 0.5) * 0.05; // ±2.5% variation
    const price = Number((basePrice * (1 + variation)).toFixed(2));
    const previousClose = Number((basePrice * (1 + (Math.random() - 0.5) * 0.02)).toFixed(2));
    const change = Number((price - previousClose).toFixed(2));
    const changePercent = Number(((change / previousClose) * 100).toFixed(2));
    
    return {
      symbol,
      price,
      change,
      changePercent,
      volume: Math.floor(Math.random() * 10000000) + 100000,
      bid: Number((price - 0.01).toFixed(2)),
      ask: Number((price + 0.01).toFixed(2)),
      high: Number((price * 1.015).toFixed(2)),
      low: Number((price * 0.985).toFixed(2)),
      open: Number((previousClose * (1 + (Math.random() - 0.5) * 0.01)).toFixed(2)),
      previousClose,
      lastUpdate: new Date().toISOString(),
      exchange: symbol.includes('.TO') ? 'TSX' : 'NASDAQ',
      marketCap: Math.floor(Math.random() * 500000000000) + 10000000000,
      pe: Number((Math.random() * 35 + 5).toFixed(1))
    };
  });
}

export async function GET(request: NextRequest) {
  try {
    console.log('🚀 TMX Real-time Stream API called');
    
    const { searchParams } = new URL(request.url);
    const symbolsParam = searchParams.get('symbols') || 'AAPL,TSLA,GOOGL,MSFT,NVDA';
    const sessionId = searchParams.get('sessionId');
    const streamType = searchParams.get('streamType') as 'quotes' | 'level1' | 'level2' | 'trades' || 'quotes';
    
    const symbols = symbolsParam.split(',').map(s => s.trim());
    
    console.log('📊 Requested symbols:', symbols);
    console.log('🔗 Stream type:', streamType);
    console.log('🔑 Session ID:', sessionId ? sessionId.substring(0, 8) + '...' : 'None');

    // If we have a valid TMX session, try to fetch real data
    if (sessionId) {
      try {
        console.log('🔄 Attempting to fetch real TMX data...');
        
        // Try multiple TMX endpoints
        const endpoints = [
          { url: TMX_ENDPOINTS.QUOTES, params: { symbols: symbolsParam, format: 'json' } },
          { url: TMX_ENDPOINTS.LEVEL1, params: { symbols: symbolsParam } },
          { url: TMX_ENDPOINTS.STREAMING, params: { symbols: symbolsParam, type: streamType } },
          { url: TMX_ENDPOINTS.WEB_INTERFACE, params: { action: 'quotes', symbols: symbolsParam } }
        ] as const;

        for (const endpoint of endpoints) {
          try {
            console.log('📡 Trying endpoint:', endpoint.url);
            const data = await fetchTMXData(endpoint.url, sessionId, endpoint.params);
            
            if (data && (data.quotes || data.length > 0)) {
              console.log('✅ Successfully fetched TMX data from:', endpoint.url);
              
              return NextResponse.json({
                success: true,
                data: data.quotes || data,
                source: 'TMX PowerStream',
                endpoint: endpoint.url,
                timestamp: new Date().toISOString(),
                sessionActive: true,
                streamType,
                symbols
              });
            }
          } catch (endpointError) {
            console.log('❌ Endpoint failed:', endpoint.url, endpointError);
          }
        }
        
        console.log('⚠️ All TMX endpoints failed, using simulated real-time data');
        
      } catch (error) {
        console.error('❌ TMX data fetch error:', error);
      }
    }

    // If TMX isn't available or no session, generate realistic real-time data
    console.log('🎲 Generating simulated real-time market data');
    const realtimeData = generateRealtimeData(symbols);
    
    return NextResponse.json({
      success: true,
      data: realtimeData,
      source: 'Simulated Real-time Data',
      message: sessionId ? 'TMX endpoints not accessible, using simulated data' : 'No TMX session provided, using simulated data',
      timestamp: new Date().toISOString(),
      sessionActive: !!sessionId,
      streamType,
      symbols,
      note: 'Connect with TMX PowerStream session for real market data'
    });

  } catch (error) {
    console.error('❌ TMX Real-time Stream error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch real-time market data',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: TMXRealtimeRequest = await request.json();
    const { symbols, sessionId, streamType = 'quotes' } = body;
    
    console.log('🚀 TMX Real-time Stream POST request');
    console.log('📊 Symbols:', symbols);
    console.log('🔗 Stream Type:', streamType);
    
    if (!symbols || symbols.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Symbols are required'
      }, { status: 400 });
    }

    // Generate real-time data for the requested symbols
    const realtimeData = generateRealtimeData(symbols);
    
    return NextResponse.json({
      success: true,
      data: realtimeData,
      source: 'TMX PowerStream Simulation',
      timestamp: new Date().toISOString(),
      sessionActive: !!sessionId,
      streamType,
      symbols
    });

  } catch (error) {
    console.error('❌ TMX Real-time Stream POST error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to process real-time stream request',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}