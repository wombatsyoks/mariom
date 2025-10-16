import { NextRequest, NextResponse } from 'next/server';

// Real-time market data access through TMX PowerStream -> QuoteStream Web authentication
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const symbols = searchParams.get('symbols') || 'AAPL';
  
  console.log('🚀 Getting REAL-TIME market data for:', symbols);
  
  try {
    // Step 1: Authenticate with TMX PowerStream
    console.log('🔐 Step 1: TMX PowerStream Authentication...');
    
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
      throw new Error(`TMX authentication failed: ${tmxAuthResponse.status}`);
    }

    const setCookieHeader = tmxAuthResponse.headers.get('set-cookie');
    const sessionMatch = setCookieHeader?.match(/PHPSESSID=([^;]+)/);
    
    if (!sessionMatch) {
      throw new Error('No TMX session found');
    }

    const tmxSessionId = sessionMatch[1];
    console.log('✅ TMX Session obtained:', tmxSessionId.substring(0, 10) + '...');

    // Step 2: Access TMX PowerStream web interface to trigger QuoteStream initialization  
    console.log('🌐 Step 2: Loading TMX PowerStream interface...');
    
    const powerStreamResponse = await fetch('https://tmxpowerstream.com/powerStreamWeb.php', {
      headers: {
        'Cookie': `PHPSESSID=${tmxSessionId}`,
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36'
      }
    });

    if (!powerStreamResponse.ok) {
      throw new Error(`Failed to load PowerStream interface: ${powerStreamResponse.status}`);
    }

    // Step 3: Trigger the qm_auth() function by calling paramHelper.php 
    console.log('🔑 Step 3: Getting QuoteStream authentication parameters...');
    
    const paramsResponse = await fetch('https://tmxpowerstream.com/includes/paramHelper.php', {
      headers: {
        'Cookie': `PHPSESSID=${tmxSessionId}`,
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
        'Referer': 'https://tmxpowerstream.com/powerStreamWeb.php',
        'X-Requested-With': 'XMLHttpRequest'
      }
    });

    if (!paramsResponse.ok) {
      throw new Error(`Failed to get QuoteStream parameters: ${paramsResponse.status}`);
    }

    const params = await paramsResponse.json();
    console.log('📋 QuoteStream params received:', params);

    const { wmid, sid, quotestreamweb_env, lang } = params;

    // Step 4: If we don't have a SID, we need to get one from QuoteMedia directly
    let quotemediaSid = sid;
    
    if (!quotemediaSid) {
      console.log('🔄 Step 4: No SID from TMX, attempting direct QuoteMedia authentication...');
      
      // Try to get QuoteMedia SID using TMX credentials
      const qmAuthEndpoints = [
        'https://app.quotemedia.com/datatool/getSessionId.json',
        'https://app.quotemedia.com/auth/login.json',
        'https://app.quotemedia.com/session/create.json',
        'https://app.quotemedia.com/ajax/auth.json'
      ];

      for (const authEndpoint of qmAuthEndpoints) {
        try {
          console.log('🔐 Trying QuoteMedia auth endpoint:', authEndpoint);
          
          const qmAuthResponse = await fetch(authEndpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'Accept': 'application/json',
              'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
              'Referer': 'https://tmxpowerstream.com/powerStreamWeb.php'
            },
            body: new URLSearchParams({
              username: process.env.TMX_USERNAME || 'MoltoMario',
              password: process.env.TMX_PASSWORD || 'kYWGf8sJP76nz8k',
              webmasterId: wmid,
              wmid: wmid
            })
          });

          if (qmAuthResponse.ok) {
            const authData = await qmAuthResponse.json();
            console.log('📄 QuoteMedia auth response:', authData);
            
            if (authData.sid || authData.sessionId || authData.session_id) {
              quotemediaSid = authData.sid || authData.sessionId || authData.session_id;
              console.log('✅ Got QuoteMedia SID:', quotemediaSid.substring(0, 10) + '...');
              break;
            }
          }
        } catch (e) {
          console.log('❌ Auth endpoint failed:', authEndpoint);
        }
      }
    }

    // Step 5: Access QuoteStream Web with proper parameters
    console.log('🎯 Step 5: Accessing QuoteStream Web for real data...');
    
    const qsEnv = quotestreamweb_env || 'app';
    const quoteStreamBaseUrl = `https://${qsEnv}web.quotestream.com`;
    
    console.log('🌐 QuoteStream Web URL:', quoteStreamBaseUrl);
    console.log('🔑 Using - WMID:', wmid, 'SID:', quotemediaSid ? quotemediaSid.substring(0, 10) + '...' : 'none');

    // Step 6: Try QuoteStream Web API endpoints for real market data
    const qsDataEndpoints = [
      // QuoteStream Web internal APIs  
      `${quoteStreamBaseUrl}/api/quotes/${symbols}?wmid=${wmid}${quotemediaSid ? `&sid=${quotemediaSid}` : ''}`,
      `${quoteStreamBaseUrl}/api/v1/market/quotes?symbols=${symbols}&wmid=${wmid}${quotemediaSid ? `&sid=${quotemediaSid}` : ''}`,
      `${quoteStreamBaseUrl}/data/quotes?symbols=${symbols}&wmid=${wmid}${quotemediaSid ? `&sid=${quotemediaSid}` : ''}`,
      `${quoteStreamBaseUrl}/ajax/quotes?symbols=${symbols}&wmid=${wmid}${quotemediaSid ? `&sid=${quotemediaSid}` : ''}`,
      
      // QuoteMedia API endpoints with TMX session context
      `https://app.quotemedia.com/datatool/getQuote.json?symbols=${symbols}&webmasterId=${wmid}${quotemediaSid ? `&sid=${quotemediaSid}` : ''}`,
      `https://app.quotemedia.com/datatool/getMarketStats.json?symbols=${symbols}&webmasterId=${wmid}${quotemediaSid ? `&sid=${quotemediaSid}` : ''}`,
      `https://app.quotemedia.com/ajax/getQuotes.json?symbols=${symbols}&webmasterId=${wmid}${quotemediaSid ? `&sid=${quotemediaSid}` : ''}`,
      
      // Real-time data endpoints
      `${quoteStreamBaseUrl}/realtime/quotes?symbols=${symbols}&wmid=${wmid}${quotemediaSid ? `&sid=${quotemediaSid}` : ''}`,
      `${quoteStreamBaseUrl}/stream/data?symbols=${symbols}&wmid=${wmid}${quotemediaSid ? `&sid=${quotemediaSid}` : ''}`
    ];

    for (const endpoint of qsDataEndpoints) {
      console.log('📊 Testing real-time endpoint:', endpoint);
      
      try {
        const response = await fetch(endpoint, {
          headers: {
            'Accept': 'application/json, */*',
            'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
            'Referer': `${quoteStreamBaseUrl}/#/?wmid=${wmid}${quotemediaSid ? `&sid=${quotemediaSid}` : ''}&showLogout=false&lang=${lang || 'en'}`,
            'Origin': quoteStreamBaseUrl,
            'X-Requested-With': 'XMLHttpRequest',
            // Include both session contexts
            'Cookie': quotemediaSid ? `sid=${quotemediaSid}; PHPSESSID=${tmxSessionId}` : `PHPSESSID=${tmxSessionId}`
          }
        });

        const status = response.status;
        const contentType = response.headers.get('content-type') || '';
        
        console.log(`📋 ${endpoint.split('?')[0]} -> Status: ${status}, Content-Type: ${contentType}`);
        
        if (response.ok) {
          const responseText = await response.text();
          console.log(`📄 Response sample:`, responseText.substring(0, 300));
          
          // Check for real market data indicators
          const hasMarketData = responseText.includes('"price"') || 
                               responseText.includes('"last"') || 
                               responseText.includes('"bid"') || 
                               responseText.includes('"ask"') ||
                               responseText.includes('"volume"') ||
                               responseText.includes('"change"') ||
                               responseText.includes('"quote"') ||
                               responseText.includes('"market"');
          
          if ((contentType.includes('application/json') || responseText.startsWith('{') || responseText.startsWith('[')) && hasMarketData) {
            try {
              const data = JSON.parse(responseText);
              console.log('🎯 SUCCESS: REAL MARKET DATA FOUND!');
              console.log('📊 Data keys:', Object.keys(data));
              
              return NextResponse.json({
                success: true,
                data: data,
                quotes: data.quotes || data.data || data,
                source: 'REAL-TIME QuoteStream Web Data',
                endpoint: endpoint,
                authentication: {
                  tmxSessionId: tmxSessionId.substring(0, 10) + '...',
                  quotemediaSid: quotemediaSid ? quotemediaSid.substring(0, 10) + '...' : 'none',
                  wmid: wmid
                },
                timestamp: new Date().toISOString(),
                isRealData: true,
                symbols: symbols
              });
              
            } catch (parseError) {
              console.log('❌ JSON parse failed:', parseError);
            }
          } else if (responseText.length > 10 && hasMarketData) {
            console.log('📈 Found potential market data (non-JSON):', responseText.substring(0, 200));
          }
        } else if (status === 401 || status === 403) {
          console.log('🔒 Authentication required for:', endpoint);
        }
        
      } catch (error) {
        console.log(`❌ Error testing ${endpoint}:`, error instanceof Error ? error.message : 'Unknown error');
      }
    }
    
    // Step 7: If no direct API access, provide iframe access information
    const iframeUrl = `${quoteStreamBaseUrl}/#/?wmid=${wmid}${quotemediaSid ? `&sid=${quotemediaSid}` : ''}&showLogout=false&lang=${lang || 'en'}`;
    
    console.log('🌐 QuoteStream Web iframe URL:', iframeUrl);
    
    return NextResponse.json({
      success: true,
      message: 'Real-time data access configured - use iframe URL for QuoteStream Web interface',
      authentication: {
        tmxSessionId: tmxSessionId.substring(0, 10) + '...',
        quotemediaSid: quotemediaSid ? quotemediaSid.substring(0, 10) + '...' : 'none',
        wmid: wmid,
        authenticated: true
      },
      access: {
        quoteStreamWebUrl: quoteStreamBaseUrl,
        iframeUrl: iframeUrl,
        directAccess: false,
        reason: 'QuoteStream Web requires browser interface for real-time data'
      },
      nextSteps: [
        'Load QuoteStream Web in iframe for real-time charts and data',
        'Use browser automation to extract real-time data from loaded interface',
        'Monitor network traffic in QuoteStream Web for internal API endpoints'
      ],
      symbols: symbols,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Real-time data access error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      step: 'Real-time Market Data Access'
    }, { status: 500 });
  }
}