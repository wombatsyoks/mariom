import { NextRequest, NextResponse } from 'next/server';

// Direct QuoteStream Web access - this is where the real data comes from!
// TMX PowerStream just embeds QuoteStream Web in an iframe
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const symbols = searchParams.get('symbols') || 'AAPL';
  
  console.log('🎯 Accessing QuoteStream Web directly for real data...');
  
  try {
    // Step 1: Get TMX PowerStream session
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
        step: 'TMX Authentication'
      });
    }

    const setCookieHeader = tmxAuthResponse.headers.get('set-cookie');
    const sessionMatch = setCookieHeader?.match(/PHPSESSID=([^;]+)/);
    
    if (!sessionMatch) {
      return NextResponse.json({
        success: false,
        error: 'No TMX session found',
        step: 'TMX Session Extraction'
      });
    }

    const tmxSessionId = sessionMatch[1];
    console.log('✅ TMX Session:', tmxSessionId.substring(0, 10) + '...');

    // Step 2: Get QuoteStream parameters from TMX
    const paramsResponse = await fetch('https://tmxpowerstream.com/includes/paramHelper.php', {
      headers: {
        'Cookie': `PHPSESSID=${tmxSessionId}`,
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
        'Referer': 'https://tmxpowerstream.com/powerStreamWeb.php'
      }
    });

    if (!paramsResponse.ok) {
      return NextResponse.json({
        success: false,
        error: `Failed to get QuoteStream parameters: ${paramsResponse.status}`,
        step: 'QuoteStream Parameters'
      });
    }

    const params = await paramsResponse.json();
    console.log('📋 QuoteStream params:', params);

    const { wmid, sid, quotestreamweb_env, lang } = params;

    // Step 3: Determine QuoteStream Web URL
    // Based on streamer.js: https://{env}web.quotestream.com
    const qsEnv = quotestreamweb_env || 'app'; // default to 'app' if empty
    const quoteStreamWebUrl = `https://${qsEnv}web.quotestream.com`;
    
    console.log('🌐 QuoteStream Web URL:', quoteStreamWebUrl);
    console.log('🔑 WMID:', wmid, 'SID exists:', !!sid);

    // Step 4: Try to access QuoteStream Web API endpoints
    // Based on the QuoteStream bundle you shared, they likely have API endpoints
    const qsApiEndpoints = [
      // Direct API calls that QuoteStream Web might make
      `${quoteStreamWebUrl}/api/quotes?symbols=${symbols}&wmid=${wmid}${sid ? `&sid=${sid}` : ''}`,
      `${quoteStreamWebUrl}/api/v1/quotes?symbols=${symbols}&wmid=${wmid}${sid ? `&sid=${sid}` : ''}`,
      `${quoteStreamWebUrl}/datatool/getQuote.json?symbols=${symbols}&wmid=${wmid}${sid ? `&sid=${sid}` : ''}`,
      `${quoteStreamWebUrl}/ajax/quotes?symbols=${symbols}&wmid=${wmid}${sid ? `&sid=${sid}` : ''}`,
      
      // Try the app.quotestream.com directly (might be the same as QuoteMedia)
      `https://app.quotestream.com/api/quotes?symbols=${symbols}&wmid=${wmid}${sid ? `&sid=${sid}` : ''}`,
      `https://app.quotestream.com/datatool/getQuote.json?symbols=${symbols}&wmid=${wmid}${sid ? `&sid=${sid}` : ''}`,
      
      // QuoteMedia endpoints with TMX credentials
      `https://app.quotemedia.com/datatool/getQuote.json?symbols=${symbols}&webmasterId=${wmid}${sid ? `&sid=${sid}` : ''}`,
      `https://app.quotemedia.com/ajax/getQuotes.json?symbols=${symbols}&webmasterId=${wmid}${sid ? `&sid=${sid}` : ''}`
    ];

    for (const endpoint of qsApiEndpoints) {
      console.log('🔍 Testing QuoteStream endpoint:', endpoint);
      
      try {
        const response = await fetch(endpoint, {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
            'Referer': quoteStreamWebUrl,
            'Origin': quoteStreamWebUrl
          }
        });

        console.log(`📊 ${endpoint} -> Status: ${response.status}, Content-Type: ${response.headers.get('content-type')}`);
        
        if (response.ok) {
          const contentType = response.headers.get('content-type') || '';
          const responseText = await response.text();
          
          console.log(`📄 Response preview:`, responseText.substring(0, 500));
          
          // Check if this looks like real market data
          if ((contentType.includes('application/json') || responseText.startsWith('{')) && 
              (responseText.includes('"price"') || 
               responseText.includes('"last"') || 
               responseText.includes('"quote"') ||
               responseText.includes('"symbol"') ||
               responseText.includes('"bid"') ||
               responseText.includes('"ask"'))) {
            
            try {
              const data = JSON.parse(responseText);
              console.log('🎯 FOUND REAL QUOTESTREAM DATA:', endpoint);
              
              return NextResponse.json({
                success: true,
                quotes: data,
                source: `QuoteStream Web Real Data - ${endpoint}`,
                endpoint: endpoint,
                tmxSessionId: tmxSessionId.substring(0, 10) + '...',
                quoteStreamParams: params,
                timestamp: new Date().toISOString(),
                isRealData: true
              });
              
            } catch (parseError) {
              console.log('❌ JSON parse failed for endpoint:', endpoint);
            }
          }
          
          // Log any interesting non-JSON responses
          if (responseText.length > 0 && !responseText.includes('<!DOCTYPE')) {
            console.log(`📝 Non-HTML response from ${endpoint}:`, responseText.substring(0, 300));
          }
        } else {
          console.log(`❌ ${endpoint} returned status ${response.status}`);
        }
        
      } catch (error) {
        console.log(`❌ Error testing ${endpoint}:`, error instanceof Error ? error.message : 'Unknown error');
      }
    }
    
    // Step 5: If direct API access fails, return the QuoteStream Web iframe URL for manual analysis
    const iframeUrl = `${quoteStreamWebUrl}/#/?wmid=${wmid}${sid ? `&sid=${sid}` : ''}&showLogout=false&lang=${lang || 'en'}`;
    
    return NextResponse.json({
      success: false,
      error: 'No direct API endpoints found',
      message: `Real data is available through QuoteStream Web, but no direct API endpoints returned data. The TMX PowerStream interface loads QuoteStream Web in an iframe.`,
      discoveredInfo: {
        quoteStreamWebUrl,
        iframeUrl,
        tmxSessionId: tmxSessionId.substring(0, 10) + '...',
        quoteStreamParams: params,
        testedEndpoints: qsApiEndpoints.length
      },
      nextSteps: [
        'Access QuoteStream Web directly through iframe',
        'Use browser automation to extract data from loaded interface',
        'Find QuoteStream Web internal API endpoints through network analysis'
      ]
    });

  } catch (error) {
    console.error('❌ QuoteStream Web access error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      step: 'QuoteStream Web Access'
    }, { status: 500 });
  }
}