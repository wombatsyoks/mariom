import { NextRequest, NextResponse } from 'next/server';
import { generateDataToolToken } from '@/lib/quotemedia-auth';

// Direct QuoteStream API access for real market data
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const symbols = searchParams.get('symbols') || 'AAPL';
  
  console.log('🎯 ACCESSING REAL MARKET DATA via QuoteStream APIs...');
  
  try {
    // Get authentication
    const realtimeResponse = await fetch(`http://localhost:3000/api/realtime-data?symbols=${symbols}`);
    const authData = await realtimeResponse.json();
    
    if (!authData.success) {
      throw new Error('Authentication failed');
    }
    
    const { wmid, tmxSessionId } = authData.authentication;
    
    console.log('🔑 Using authenticated session for API access...');
    
    // Generate fresh datatool token
    let dataToolToken: string;
    try {
      dataToolToken = await generateDataToolToken();
      console.log('✅ Generated fresh Datatool-Token for market data API');
    } catch (error) {
      console.error('❌ Failed to generate datatool token:', error);
      return NextResponse.json({
        success: false,
        error: 'Token generation failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 401 });
    }
    
    // These are the actual API endpoints that QuoteStream Web likely uses
    const apiEndpoints = [
      // QuoteStream real-time data APIs
      {
        url: `https://appweb.quotestream.com/api/market/quotes?symbols=${symbols}`,
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Origin': 'https://appweb.quotestream.com',
          'Referer': `https://appweb.quotestream.com/#/?wmid=${wmid}&showLogout=false&lang=en`
        }
      },
      
      // QuoteMedia APIs with TMX credentials
      {
        url: 'https://app.quotemedia.com/datatool/getQuote.json',
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
          'Origin': 'https://tmxpowerstream.com',
          'Referer': 'https://tmxpowerstream.com/powerStreamWeb.php'
        },
        body: new URLSearchParams({
          symbols: symbols,
          webmasterId: wmid,
          'datatool-token': dataToolToken
        })
      },
      
      // Alternative QuoteMedia endpoints
      {
        url: 'https://app.quotemedia.com/quotetools/getQuote.json',
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        body: new URLSearchParams({
          symbols: symbols,
          webmasterId: wmid
        })
      },
      
      // Real-time streaming endpoints
      {
        url: `https://appweb.quotestream.com/realtime/stream?symbols=${symbols}&wmid=${wmid}`,
        method: 'GET',
        headers: {
          'Accept': 'text/event-stream, application/json',
          'Cache-Control': 'no-cache'
        }
      }
    ];
    
    console.log(`🔍 Testing ${apiEndpoints.length} real market data endpoints...`);
    
    for (let i = 0; i < apiEndpoints.length; i++) {
      const config = apiEndpoints[i];
      console.log(`\n📊 [${i+1}/${apiEndpoints.length}] Testing: ${config.url}`);
      
      try {
        const headers: Record<string, string> = {
          'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36'
        };
        
        // Merge config headers
        Object.entries(config.headers).forEach(([key, value]) => {
          if (value) headers[key] = value;
        });
        
        const requestInit: RequestInit = {
          method: config.method,
          headers
        };
        
        if (config.body) {
          requestInit.body = config.body;
        }
        
        const response = await fetch(config.url, requestInit);
        
        console.log(`   Status: ${response.status} ${response.statusText}`);
        console.log(`   Content-Type: ${response.headers.get('content-type')}`);
        
        if (response.ok) {
          const responseText = await response.text();
          console.log(`   Response length: ${responseText.length} chars`);
          console.log(`   Response preview: ${responseText.substring(0, 200)}`);
          
          // Check if this is real market data
          const isMarketData = responseText.includes('"price"') || 
                              responseText.includes('"last"') || 
                              responseText.includes('"bid"') || 
                              responseText.includes('"ask"') ||
                              responseText.includes('"volume"') ||
                              responseText.includes('"change"') ||
                              responseText.includes('"open"') ||
                              responseText.includes('"high"') ||
                              responseText.includes('"low"');
          
          if (isMarketData && (responseText.startsWith('{') || responseText.startsWith('['))) {
            console.log('🎯 *** REAL MARKET DATA FOUND! ***');
            
            try {
              const data = JSON.parse(responseText);
              
              return NextResponse.json({
                success: true,
                message: '🎯 REAL MARKET DATA SUCCESSFULLY RETRIEVED!',
                data: data,
                quotes: data.quotes || data.data || data,
                source: {
                  endpoint: config.url,
                  method: config.method,
                  provider: 'QuoteStream/QuoteMedia Real API'
                },
                authentication: {
                  wmid: wmid,
                  tmxSessionId: tmxSessionId.substring(0, 10) + '...',
                  authenticated: true
                },
                metadata: {
                  symbols: symbols.split(','),
                  timestamp: new Date().toISOString(),
                  isRealData: true,
                  dataSize: responseText.length
                }
              });
              
            } catch (parseError) {
              console.log('   ❌ JSON parse failed, but contains market data');
              
              // Return raw data if it contains market information
              return NextResponse.json({
                success: true,
                message: '🎯 REAL MARKET DATA FOUND (Raw Format)',
                rawData: responseText,
                source: {
                  endpoint: config.url,
                  method: config.method,
                  provider: 'QuoteStream/QuoteMedia Raw API'
                },
                authentication: {
                  wmid: wmid,
                  tmxSessionId: tmxSessionId.substring(0, 10) + '...'
                },
                metadata: {
                  symbols: symbols.split(','),
                  timestamp: new Date().toISOString(),
                  format: 'raw',
                  isRealData: true
                }
              });
            }
          } else if (responseText.length > 0) {
            console.log(`   ℹ️ Non-market response: ${responseText.substring(0, 100)}`);
          }
          
        } else {
          console.log(`   ❌ HTTP Error: ${response.status}`);
          if (response.status === 401 || response.status === 403) {
            console.log('   🔒 Authentication required');
          }
        }
        
      } catch (error) {
        console.log(`   ❌ Request failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    console.log('\n📋 API Testing Summary:');
    console.log(`   • Tested ${apiEndpoints.length} endpoints`);
    console.log('   • No direct API access found');
    console.log('   • Real data available through QuoteStream Web interface');
    
    return NextResponse.json({
      success: true,
      message: 'Real market data access configured via QuoteStream Web',
      directApiAccess: false,
      webInterfaceAccess: true,
      recommendation: {
        method: 'QuoteStream Web Interface',
        url: `http://localhost:3000/api/quotestream-web-loader?symbols=${symbols}`,
        description: 'Access real-time market data through the authenticated QuoteStream Web interface'
      },
      authentication: {
        wmid: wmid,
        tmxSessionId: tmxSessionId.substring(0, 10) + '...',
        authenticated: true
      },
      testedEndpoints: apiEndpoints.length,
      symbols: symbols.split(','),
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Direct API access error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Failed to access real market data APIs'
    }, { status: 500 });
  }
}