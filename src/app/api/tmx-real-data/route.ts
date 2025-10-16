import { NextRequest, NextResponse } from 'next/server';

// Direct TMX PowerStream real data extraction
// Based on QuoteStream bundle analysis, we need to find the actual endpoints
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const symbols = searchParams.get('symbols') || 'AAPL';
  
  console.log('🔍 Attempting to find real TMX PowerStream data endpoints...');
  
  try {
    // Direct TMX PowerStream authentication
    const tmxAuthResponse = await fetch('https://tmxpowerstream.com/session.php', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36'
      },
      body: new URLSearchParams({
        username: process.env.TMX_USERNAME || 'MoltoMario',
        password: process.env.TMX_PASSWORD || 'kYWGf8sJP76nz8k', 
        wmid: process.env.TMX_WMID || '101020'
      }),
      redirect: 'manual'
    });

    if (tmxAuthResponse.status !== 302) {
      return NextResponse.json({
        success: false,
        error: `TMX authentication failed: ${tmxAuthResponse.status}`,
        message: "Can't get real data without proper TMX authentication"
      });
    }

    const setCookieHeader = tmxAuthResponse.headers.get('set-cookie');
    const sessionMatch = setCookieHeader?.match(/PHPSESSID=([^;]+)/);
    
    if (!sessionMatch) {
      return NextResponse.json({
        success: false,
        error: 'No TMX session found',
        message: "Authentication succeeded but no session cookie returned"
      });
    }

    const sessionId = sessionMatch[1];
    console.log('✅ Got TMX session:', sessionId.substring(0, 10) + '...');

    // Now try to find REAL data endpoints by analyzing what TMX actually uses
    // Based on QuoteStream bundle, they likely have these patterns:
    const realDataEndpoints = [
      // QuoteStream WebSocket or real-time endpoints
      `https://tmxpowerstream.com/ws/quotes?symbols=${symbols}`,
      `https://tmxpowerstream.com/realtime/quotes?symbols=${symbols}`,
      `https://tmxpowerstream.com/stream/quotes?symbols=${symbols}`,
      
      // API endpoints that might return actual data
      `https://tmxpowerstream.com/api/v1/quotes?symbols=${symbols}`,
      `https://tmxpowerstream.com/api/quotes?symbols=${symbols}&format=json`,
      `https://tmxpowerstream.com/data/quotes?symbols=${symbols}&type=json`,
      
      // QuoteMedia endpoints they might proxy through
      `https://tmxpowerstream.com/quotemedia/quotes?symbols=${symbols}`,
      `https://tmxpowerstream.com/proxy/quotemedia?symbols=${symbols}`,
      
      // AJAX endpoints for the web interface
      `https://tmxpowerstream.com/ajax/quotes?symbols=${symbols}&format=json`,
      `https://tmxpowerstream.com/ajax/realtime?symbols=${symbols}`,
      `https://tmxpowerstream.com/ajax/marketdata?symbols=${symbols}`,
      
      // Data feed endpoints
      `https://tmxpowerstream.com/feed/quotes?symbols=${symbols}`,
      `https://tmxpowerstream.com/datafeed/quotes?symbols=${symbols}`,
      
      // Legacy endpoints  
      `https://tmxpowerstream.com/quotes.php?symbols=${symbols}&output=json`,
      `https://tmxpowerstream.com/getQuotes.php?symbols=${symbols}&format=json`
    ];

    for (const endpoint of realDataEndpoints) {
      console.log('🌐 Testing real data endpoint:', endpoint);
      
      try {
        const response = await fetch(endpoint, {
          headers: {
            'Cookie': `PHPSESSID=${sessionId}`,
            'Accept': 'application/json, */*',
            'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
            'Referer': 'https://tmxpowerstream.com/powerStreamWeb.php',
            'X-Requested-With': 'XMLHttpRequest'
          }
        });

        console.log(`📊 ${endpoint} -> Status: ${response.status}, Content-Type: ${response.headers.get('content-type')}`);
        
        if (response.ok) {
          const contentType = response.headers.get('content-type') || '';
          const responseText = await response.text();
          
          console.log(`📄 Response preview (${contentType}):`, responseText.substring(0, 300));
          
          // Check if this looks like real market data
          if (contentType.includes('application/json') && 
              (responseText.includes('"price"') || 
               responseText.includes('"last"') || 
               responseText.includes('"quote"') ||
               responseText.includes('"symbol"'))) {
            
            try {
              const data = JSON.parse(responseText);
              console.log('🎯 FOUND REAL DATA ENDPOINT:', endpoint);
              
              return NextResponse.json({
                success: true,
                quotes: data,
                source: `TMX PowerStream Real Data - ${endpoint}`,
                endpoint: endpoint,
                sessionId: sessionId.substring(0, 10) + '...',
                timestamp: new Date().toISOString(),
                isRealData: true
              });
              
            } catch (parseError) {
              console.log('❌ JSON parse failed for endpoint:', endpoint);
            }
          }
          
          // Even if not JSON, log interesting responses
          if (responseText.length > 0 && !responseText.includes('<!DOCTYPE')) {
            console.log(`📝 Non-HTML response from ${endpoint}:`, responseText.substring(0, 200));
          }
        }
        
      } catch (error) {
        console.log(`❌ Error testing ${endpoint}:`, error instanceof Error ? error.message : 'Unknown error');
      }
    }
    
    // If we get here, no real data endpoints were found
    return NextResponse.json({
      success: false,
      error: 'No real data endpoints found',
      message: `Tested ${realDataEndpoints.length} potential endpoints but none returned real market data. TMX PowerStream may use WebSockets or other mechanisms for real-time data.`,
      testedEndpoints: realDataEndpoints.length,
      sessionId: sessionId.substring(0, 10) + '...'
    });

  } catch (error) {
    console.error('❌ TMX real data extraction error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Failed to extract real data from TMX PowerStream'
    }, { status: 500 });
  }
}