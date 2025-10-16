import { NextRequest, NextResponse } from 'next/server';

interface TMXDataRequest {
  symbols?: string[];
  dataType?: 'quotes' | 'level2' | 'charts' | 'news' | 'portfolio';
  sessionId?: string;
}

interface TMXDataResponse {
  success: boolean;
  data?: any;
  error?: string;
  sessionActive?: boolean;
}

// Helper function to make authenticated requests to TMX PowerStream
async function makeTMXRequest(url: string, cookies: string, options: RequestInit = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Cookie': cookies,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Referer': 'https://tmxpowerstream.com/streamer.php',
      'Accept': 'application/json, text/html, */*',
      'Accept-Language': 'en-US,en;q=0.5',
      'X-Requested-With': 'XMLHttpRequest',
      ...options.headers,
    },
  });

  return response;
}

// Extract session cookies from request
function getSessionCookies(request: NextRequest): string {
  const cookies: string[] = [];
  
  // Get PHPSESSID and other relevant cookies
  const sessionCookie = request.cookies.get('PHPSESSID');
  if (sessionCookie) {
    cookies.push(`PHPSESSID=${sessionCookie.value}`);
  }

  // Add other TMX-related cookies if present
  request.cookies.getAll().forEach(cookie => {
    if (cookie.name.toLowerCase().includes('tmx') || 
        cookie.name.toLowerCase().includes('powerstream') ||
        cookie.name.toLowerCase().includes('quotemedia')) {
      cookies.push(`${cookie.name}=${cookie.value}`);
    }
  });

  return cookies.join('; ');
}

export async function POST(request: NextRequest): Promise<NextResponse<TMXDataResponse>> {
  try {
    console.log('📊 TMX data extraction request received');
    
    const body: TMXDataRequest = await request.json();
    const sessionCookies = getSessionCookies(request);
    
    if (!sessionCookies) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'No active TMX session found. Please login first.',
          sessionActive: false 
        },
        { status: 401 }
      );
    }

    console.log('🔐 Using session cookies for TMX request');
    
    // Determine the appropriate TMX PowerStream endpoint based on data type
    let tmxUrl = 'https://tmxpowerstream.com/streamer.php';
    let requestOptions: RequestInit = { method: 'GET' };
    
    switch (body.dataType) {
      case 'quotes':
        // Extract real-time quote data
        if (body.symbols && body.symbols.length > 0) {
          const symbolsParam = body.symbols.join(',');
          tmxUrl = `https://tmxpowerstream.com/ajax/quotes.php?symbols=${encodeURIComponent(symbolsParam)}`;
        }
        break;
        
      case 'level2':
        // Extract Level 2 market depth data
        if (body.symbols && body.symbols.length > 0) {
          const symbol = body.symbols[0]; // Level 2 typically for single symbol
          tmxUrl = `https://tmxpowerstream.com/ajax/level2.php?symbol=${encodeURIComponent(symbol)}`;
        }
        break;
        
      case 'charts':
        // Extract chart data
        if (body.symbols && body.symbols.length > 0) {
          const symbol = body.symbols[0];
          tmxUrl = `https://tmxpowerstream.com/ajax/chart.php?symbol=${encodeURIComponent(symbol)}&period=1d`;
        }
        break;
        
      case 'news':
        // Extract news data
        tmxUrl = 'https://tmxpowerstream.com/ajax/news.php';
        if (body.symbols && body.symbols.length > 0) {
          tmxUrl += `?symbols=${encodeURIComponent(body.symbols.join(','))}`;
        }
        break;
        
      case 'portfolio':
        // Extract portfolio data
        tmxUrl = 'https://tmxpowerstream.com/ajax/portfolio.php';
        break;
        
      default:
        // Default to main streamer interface
        tmxUrl = 'https://tmxpowerstream.com/streamer.php';
    }

    console.log('🌐 Making TMX request to:', tmxUrl);

    // Make the request to TMX PowerStream
    const tmxResponse = await makeTMXRequest(tmxUrl, sessionCookies, requestOptions);
    
    console.log('📈 TMX Response status:', tmxResponse.status);
    
    if (tmxResponse.status === 200) {
      const contentType = tmxResponse.headers.get('content-type') || '';
      let responseData;
      
      if (contentType.includes('application/json')) {
        responseData = await tmxResponse.json();
      } else {
        const htmlContent = await tmxResponse.text();
        
        // Parse HTML content for specific data patterns
        responseData = parseHTMLContent(htmlContent, body.dataType || 'quotes');
      }
      
      console.log('✅ TMX data extracted successfully');
      
      return NextResponse.json({
        success: true,
        data: responseData,
        sessionActive: true,
      });
      
    } else if (tmxResponse.status === 302 || tmxResponse.status === 401) {
      // Session expired, redirect to login
      console.log('🔒 TMX session expired');
      
      return NextResponse.json(
        { 
          success: false, 
          error: 'TMX session expired. Please login again.',
          sessionActive: false 
        },
        { status: 401 }
      );
      
    } else {
      console.log('❌ TMX request failed with status:', tmxResponse.status);
      
      return NextResponse.json(
        { 
          success: false, 
          error: `TMX request failed with status ${tmxResponse.status}` 
        },
        { status: tmxResponse.status }
      );
    }

  } catch (error) {
    console.error('❌ TMX data extraction error:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Data extraction failed' 
      },
      { status: 500 }
    );
  }
}

// Parse HTML content from TMX PowerStream for specific data
function parseHTMLContent(html: string, dataType: string) {
  console.log('🔍 Parsing TMX HTML content for data type:', dataType);
  
  const result: any = {
    type: dataType,
    timestamp: new Date().toISOString(),
    raw: html.length > 1000 ? html.substring(0, 1000) + '...' : html,
  };
  
  try {
    switch (dataType) {
      case 'quotes':
        // Look for quote data patterns in HTML
        const quotePattern = /"symbol"\s*:\s*"([^"]+)"/g;
        const pricePattern = /"last"\s*:\s*([0-9.]+)/g;
        
        const symbols: string[] = [];
        const prices: number[] = [];
        
        let quoteMatch;
        while ((quoteMatch = quotePattern.exec(html)) !== null) {
          symbols.push(quoteMatch[1]);
        }
        
        let priceMatch;
        while ((priceMatch = pricePattern.exec(html)) !== null) {
          prices.push(parseFloat(priceMatch[1]));
        }
        
        result.quotes = symbols.map((symbol, index) => ({
          symbol,
          price: prices[index] || 0,
          timestamp: new Date().toISOString(),
        }));
        
        break;
        
      case 'news':
        // Look for news items in HTML
        const newsPattern = /<div class="news-item"[^>]*>(.*?)<\/div>/gi;
        const headlines: string[] = [];
        
        let newsMatch;
        while ((newsMatch = newsPattern.exec(html)) !== null) {
          headlines.push(newsMatch[1].replace(/<[^>]*>/g, '').trim());
        }
        
        result.news = headlines.map((headline, index) => ({
          id: index,
          headline,
          timestamp: new Date().toISOString(),
        }));
        
        break;
        
      default:
        // For unknown types, return basic info
        result.contentLength = html.length;
        result.containsData = html.includes('symbol') || html.includes('quote') || html.includes('price');
    }
    
  } catch (parseError) {
    console.warn('⚠️ Error parsing TMX HTML content:', parseError);
    result.parseError = parseError instanceof Error ? parseError.message : 'Parse error';
  }
  
  return result;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  // Check TMX session status
  const sessionCookies = getSessionCookies(request);
  
  if (!sessionCookies) {
    return NextResponse.json({
      success: true,
      sessionActive: false,
      message: 'No TMX session found',
    });
  }

  try {
    // Test session by making a simple request
    const testResponse = await makeTMXRequest(
      'https://tmxpowerstream.com/streamer.php', 
      sessionCookies
    );
    
    const isActive = testResponse.status === 200 && 
                    !testResponse.url.includes('login') &&
                    !testResponse.url.includes('session.php');
    
    return NextResponse.json({
      success: true,
      sessionActive: isActive,
      message: isActive ? 'TMX session is active' : 'TMX session expired',
    });
    
  } catch (error) {
    return NextResponse.json({
      success: false,
      sessionActive: false,
      error: error instanceof Error ? error.message : 'Session check failed',
    });
  }
}