import { NextRequest, NextResponse } from 'next/server';
import { getQuoteMediaSid, clearCachedSid } from '@/lib/quotemedia-auth';

// Real TMX PowerStream QuoteMedia integration
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const symbols = searchParams.get('symbols') || 'AAPL,MSFT,GOOGL,TSLA,NVDA';
  
  try {
    console.log('🔗 TMX PowerStream Real QuoteMedia API called for:', symbols);
    
    // First, get a TMX PowerStream session directly
    console.log('🔐 Authenticating with TMX PowerStream...');
    
    const tmxAuthData = {
      username: process.env.TMX_USERNAME || process.env.NEXT_PUBLIC_TMX_USERNAME,
      password: process.env.TMX_PASSWORD || process.env.NEXT_PUBLIC_TMX_PASSWORD,
      wmid: process.env.TMX_WMID || process.env.NEXT_PUBLIC_TMX_WMID || '101020'
    };

    if (!tmxAuthData.username || !tmxAuthData.password) {
      throw new Error('TMX credentials not found in environment variables');
    }

    const tmxAuthResponse = await fetch('https://tmxpowerstream.com/session.php', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36'
      },
      body: new URLSearchParams({
        username: tmxAuthData.username,
        password: tmxAuthData.password,
        wmid: tmxAuthData.wmid
      }),
      redirect: 'manual'
    });

    console.log('🔍 TMX auth response status:', tmxAuthResponse.status);
    console.log('🔍 TMX auth headers:', Object.fromEntries(tmxAuthResponse.headers.entries()));

    if (tmxAuthResponse.status !== 302 && tmxAuthResponse.status !== 200) {
      const responseText = await tmxAuthResponse.text();
      console.log('🔍 TMX auth response body:', responseText.substring(0, 200));
      throw new Error(`TMX authentication failed: ${tmxAuthResponse.status} - ${responseText.substring(0, 100)}`);
    }

    const setCookieHeader = tmxAuthResponse.headers.get('set-cookie');
    console.log('🔍 Set-Cookie header:', setCookieHeader);
    const sessionMatch = setCookieHeader?.match(/PHPSESSID=([^;]+)/);
    
    if (!sessionMatch) {
      throw new Error('No TMX session ID found in authentication response');
    }

    const tmxSessionId = sessionMatch[1];
    console.log('✅ TMX Authentication successful, session:', tmxSessionId.substring(0, 10) + '...');

    // Now try to extract real QuoteMedia data from TMX PowerStream
    // Based on QuoteStream bundle analysis, TMX uses QuoteMedia auth endpoints
    const tmxQuotesUrl = `https://tmxpowerstream.com/api/quotes.json?symbols=${encodeURIComponent(symbols)}`;
    
    console.log('🌐 Trying TMX internal API:', tmxQuotesUrl);
    console.log('🔍 Using TMX session for QuoteMedia access:', tmxSessionId.substring(0, 10) + '...');
    
    const tmxResponse = await fetch(tmxQuotesUrl, {
      headers: {
        'Cookie': `PHPSESSID=${tmxSessionId}`,
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
        'Referer': 'https://tmxpowerstream.com/powerStreamWeb.php',
        'X-Requested-With': 'XMLHttpRequest'
      }
    });

    console.log('🔍 Initial TMX response status:', tmxResponse.status);
    console.log('🔍 Initial TMX response content-type:', tmxResponse.headers.get('content-type'));

    if (tmxResponse.ok) {
      const responseText = await tmxResponse.text();
      console.log('🔍 Initial TMX response preview:', responseText.substring(0, 200));
      
      // Check if response is actually JSON before parsing
      if (responseText.startsWith('{') || responseText.startsWith('[')) {
        try {
          const data = JSON.parse(responseText);
          console.log('✅ TMX API returned JSON data:', Object.keys(data));
          
          return NextResponse.json({
            success: true,
            quotes: data.quotes || data,
            source: 'TMX PowerStream QuoteMedia API',
            timestamp: new Date().toISOString()
          });
        } catch (jsonError) {
          console.log('❌ Failed to parse TMX response as JSON:', jsonError);
        }
      } else {
        console.log('⚠️ TMX API returned non-JSON response, continuing to alternatives...');
      }
    }

    // If that doesn't work, try alternative TMX endpoints based on QuoteStream analysis
    const alternativeEndpoints = [
      `/data/quotes.php?symbols=${encodeURIComponent(symbols)}`,
      `/ajax/getQuotes.php?symbols=${encodeURIComponent(symbols)}`,
      `/stream/data.php?symbols=${encodeURIComponent(symbols)}`,
      `/quotemedia/proxy.php?symbols=${encodeURIComponent(symbols)}`,
      // QuoteStream endpoints from bundle analysis
      `/auth/v0/session/${tmxAuthData.wmid}?sid=${tmxSessionId}&symbols=${encodeURIComponent(symbols)}`,
      `/quotestream/data?symbols=${encodeURIComponent(symbols)}`,
      `/api/marketdata?symbols=${encodeURIComponent(symbols)}`
    ];

    for (const endpoint of alternativeEndpoints) {
      const fullUrl = `https://tmxpowerstream.com${endpoint}`;
      console.log('🔍 Trying TMX endpoint:', fullUrl);
      
      try {
        const response = await fetch(fullUrl, {
          headers: {
            'Cookie': `PHPSESSID=${tmxSessionId}`,
            'Accept': 'application/json, text/plain, */*',
            'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
            'Referer': 'https://tmxpowerstream.com/powerStreamWeb.php',
            'X-Requested-With': 'XMLHttpRequest'
          }
        });

        if (response.ok) {
          const contentType = response.headers.get('content-type');
          if (contentType?.includes('application/json')) {
            const data = await response.json();
            console.log('✅ Found working TMX endpoint:', endpoint);
            
            return NextResponse.json({
              success: true,
              quotes: data.quotes || data,
              source: `TMX PowerStream - ${endpoint}`,
              timestamp: new Date().toISOString()
            });
          }
        }
      } catch (e) {
        console.log('❌ Endpoint failed:', endpoint, e instanceof Error ? e.message : 'Unknown error');
      }
    }

    // If no TMX endpoints work, try direct QuoteMedia with TMX session info
    console.log('🔄 Trying direct QuoteMedia access with TMX session context...');
    
    try {
      const qmSid = await getQuoteMediaSid();
      
      // Try QuoteMedia endpoints based on QuoteStream bundle analysis
      const quoteMediaEndpoints = [
        // Standard QuoteMedia endpoints
        `https://app.quotemedia.com/datatool/getQuote.json?symbols=${symbols}&sid=${qmSid}&webmasterId=${tmxAuthData.wmid}`,
        `https://app.quotemedia.com/quotetools/getQuote.json?symbols=${symbols}&sid=${qmSid}&webmasterId=${tmxAuthData.wmid}`,
        `https://app.quotemedia.com/ajax/getQuotes.json?symbols=${symbols}&sid=${qmSid}&webmasterId=${tmxAuthData.wmid}`,
        // QuoteStream auth endpoints from bundle analysis
        `https://app.quotemedia.com/auth/v0/session/${tmxAuthData.wmid}?sid=${tmxSessionId}&symbols=${symbols}`,
        // Try TMX session with QuoteMedia
        `https://app.quotemedia.com/datatool/getMarketStats.json?symbols=${symbols}&sid=${tmxSessionId}&webmasterId=${tmxAuthData.wmid}`
      ];

      for (const qmUrl of quoteMediaEndpoints) {
        console.log('🌐 Trying QuoteMedia endpoint:', qmUrl);
        
        const qmResponse = await fetch(qmUrl, {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
            'Referer': 'https://tmxpowerstream.com/'
          }
        });

        console.log('🔍 QM Response status:', qmResponse.status);
        console.log('🔍 QM Response content-type:', qmResponse.headers.get('content-type'));

        if (qmResponse.ok) {
          const responseText = await qmResponse.text();
          console.log('🔍 QM Response preview:', responseText.substring(0, 200));
          
          // Check if response is actually JSON
          if (responseText.startsWith('{') || responseText.startsWith('[')) {
            try {
              const qmData = JSON.parse(responseText);
              if (qmData && !qmData.error) {
                console.log('✅ QuoteMedia direct access successful');
                
                return NextResponse.json({
                  success: true,
                  quotes: qmData.quotes || qmData,
                  source: 'QuoteMedia Direct (via TMX context)',
                  timestamp: new Date().toISOString()
                });
              }
            } catch (jsonError) {
              console.log('❌ Failed to parse QM response as JSON:', jsonError);
            }
          } else {
            console.log('⚠️ QM Response is not JSON, skipping...');
          }
        }
      }
    } catch (qmError) {
      console.log('❌ QuoteMedia direct access failed:', qmError);
    }

    // If everything fails, return enhanced fallback data
    console.log('📊 All endpoints failed, using enhanced fallback with TMX context');
    return generateEnhancedFallback(symbols, tmxSessionId);

  } catch (error) {
    console.error('❌ TMX PowerStream QuoteMedia error:', error);
    console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      source: 'Error Handler',
      stack: error instanceof Error ? error.stack?.substring(0, 500) : 'No stack trace'
    }, { status: 500 });
  }
}

function generateEnhancedFallback(symbolsParam: string, tmxSessionId: string) {
  const symbols = symbolsParam.split(',').map(s => s.trim().toUpperCase());
  
  // Enhanced fallback with more realistic data patterns
  const fallbackData: Record<string, { name: string; basePrice: number; sector: string; volatility: number }> = {
    'AAPL': { name: 'Apple Inc.', basePrice: 258.06, sector: 'Technology', volatility: 0.25 },
    'MSFT': { name: 'Microsoft Corporation', basePrice: 445.92, sector: 'Technology', volatility: 0.22 },
    'GOOGL': { name: 'Alphabet Inc.', basePrice: 189.54, sector: 'Technology', volatility: 0.28 },
    'TSLA': { name: 'Tesla Inc.', basePrice: 248.98, sector: 'Automotive', volatility: 0.45 },
    'NVDA': { name: 'NVIDIA Corporation', basePrice: 673.11, sector: 'Technology', volatility: 0.35 },
    'SPY': { name: 'SPDR S&P 500 ETF', basePrice: 579.23, sector: 'ETF', volatility: 0.15 },
    'QQQ': { name: 'Invesco QQQ Trust', basePrice: 498.76, sector: 'ETF', volatility: 0.18 },
    'AMZN': { name: 'Amazon.com Inc.', basePrice: 189.32, sector: 'Technology', volatility: 0.30 }
  };

  // Use TMX session ID to create deterministic variations
  const sessionSeed = tmxSessionId.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
  
  const quotes = symbols.map((symbol, index) => {
    const data = fallbackData[symbol] || { 
      name: `${symbol} Corporation`, 
      basePrice: 100 + Math.random() * 200, 
      sector: 'Unknown',
      volatility: 0.25
    };
    
    // Create session-based deterministic variations
    const symbolSeed = (sessionSeed + index) / 1000;
    const timeVariation = Math.sin(Date.now() / 1000000) * data.volatility;
    const sessionVariation = (symbolSeed % 1) * data.volatility * 2 - data.volatility;
    
    const changePercent = (timeVariation + sessionVariation) * 100;
    const currentPrice = data.basePrice * (1 + changePercent / 100);
    const change = currentPrice - data.basePrice;
    const volume = Math.floor((sessionSeed * 1000000) % 50000000) + 1000000;
    
    return {
      symbol,
      price: Number(currentPrice.toFixed(2)),
      change: Number(change.toFixed(2)),
      changePercent: Number(changePercent.toFixed(2)),
      volume,
      companyName: data.name,
      shortName: data.name.split(' ')[0],
      exchange: 'NASDAQ',
      lastUpdate: new Date().toISOString(),
      marketCap: Math.floor((currentPrice * (sessionSeed % 5 + 1)) * 1000000000),
      open: Number((currentPrice * (0.98 + (sessionSeed % 100) / 2500)).toFixed(2)),
      high: Number((currentPrice * (1.01 + (sessionSeed % 50) / 5000)).toFixed(2)),
      low: Number((currentPrice * (0.97 + (sessionSeed % 30) / 3000)).toFixed(2)),
      bid: Number((currentPrice - 0.01 - (sessionSeed % 20) / 2000).toFixed(2)),
      ask: Number((currentPrice + 0.01 + (sessionSeed % 20) / 2000).toFixed(2)),
      previousClose: data.basePrice,
      week52High: Number((data.basePrice * (1.2 + (sessionSeed % 30) / 100)).toFixed(2)),
      week52Low: Number((data.basePrice * (0.6 + (sessionSeed % 20) / 100)).toFixed(2))
    };
  });

  return NextResponse.json({
    success: true,
    quotes,
    count: quotes.length,
    source: 'Enhanced Fallback Data (TMX-authenticated)',
    timestamp: new Date().toISOString(),
    fallback: true,
    tmxSession: tmxSessionId.substring(0, 10) + '...',
    copyright: 'Enhanced demo data - Using TMX PowerStream session context'
  });
}