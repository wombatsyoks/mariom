import { NextResponse } from 'next/server';

// Mock Canadian stock symbols and their data
const MOCK_SYMBOLS = [
  { symbol: 'SHOP', name: 'Shopify Inc.', basePrice: 85.50 },
  { symbol: 'TSX:TD', name: 'Toronto-Dominion Bank', basePrice: 78.25 },
  { symbol: 'TSX:BNS', name: 'Bank of Nova Scotia', basePrice: 68.90 },
  { symbol: 'TSX:RY', name: 'Royal Bank of Canada', basePrice: 142.80 },
  { symbol: 'TSX:CNQ', name: 'Canadian Natural Resources', basePrice: 45.60 },
  { symbol: 'TSX:SU', name: 'Suncor Energy Inc.', basePrice: 52.35 },
  { symbol: 'TSX:CSU', name: 'Constellation Software Inc.', basePrice: 4250.00 },
  { symbol: 'TSX:ATD', name: 'Alimentation Couche-Tard Inc.', basePrice: 78.45 }
];

// Generate realistic market data
function generateMarketData() {
  return MOCK_SYMBOLS.map(stock => {
    // Generate random price movement (-2% to +2%)
    const priceChange = (Math.random() - 0.5) * 0.04 * stock.basePrice;
    const currentPrice = stock.basePrice + priceChange;
    const changePercent = (priceChange / stock.basePrice) * 100;
    
    // Generate random volume (10k to 100k shares)
    const volume = Math.floor(Math.random() * 90000) + 10000;
    
    // Generate bid/ask spread
    const spread = currentPrice * 0.001; // 0.1% spread
    const bid = currentPrice - spread / 2;
    const ask = currentPrice + spread / 2;
    
    return {
      symbol: stock.symbol,
      name: stock.name,
      price: Number(currentPrice.toFixed(2)),
      change: Number(priceChange.toFixed(2)),
      changePercent: Number(changePercent.toFixed(2)),
      volume: volume,
      bid: Number(bid.toFixed(2)),
      ask: Number(ask.toFixed(2)),
      high: Number((currentPrice * 1.02).toFixed(2)),
      low: Number((currentPrice * 0.98).toFixed(2)),
      timestamp: new Date().toISOString(),
      lastUpdated: new Date().toLocaleTimeString()
    };
  });
}

export async function GET() {
  try {
    const marketData = generateMarketData();
    
    return NextResponse.json({
      success: true,
      data: marketData,
      timestamp: new Date().toISOString(),
      source: 'TMX PowerStream Mock API',
      market_status: 'open', // In a real implementation, this would check actual market hours
      update_frequency: 1000
    });
  } catch (error) {
    console.error('Mock streaming API error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to generate market data',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { symbols } = await request.json();
    
    // Filter data for specific symbols if requested
    const allData = generateMarketData();
    const filteredData = symbols ? 
      allData.filter(item => symbols.includes(item.symbol)) : 
      allData;
    
    return NextResponse.json({
      success: true,
      data: filteredData,
      requested_symbols: symbols,
      timestamp: new Date().toISOString(),
      source: 'TMX PowerStream Mock API'
    });
  } catch (error) {
    console.error('Mock streaming API POST error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to process streaming request',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}