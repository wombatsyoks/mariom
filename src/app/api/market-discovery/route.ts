import { NextRequest, NextResponse } from 'next/server';

// Advanced market discovery API to test different endpoints and parameters
export async function GET(request: NextRequest) {
  console.log('🔬 Market Discovery API called');
  
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('sessionId');
  const testType = searchParams.get('testType') || 'endpoints'; // endpoints, parameters, markets
  
  if (!sessionId) {
    console.error('❌ No session ID provided');
    return NextResponse.json(
      { error: 'Session ID required' },
      { status: 400 }
    );
  }

  try {
    console.log(`🧪 Running ${testType} discovery tests`);

    const results = {
      testType,
      sessionId,
      timestamp: new Date().toISOString(),
      discoveries: [] as any[]
    };

    // Different QuoteMedia endpoints to test
    const endpoints = [
      {
        name: 'MarketStats',
        url: 'https://app.quotemedia.com/datatool/getMarketStats.json',
        description: 'Current working endpoint'
      },
      {
        name: 'MarketMovers',
        url: 'https://app.quotemedia.com/datatool/getMarketMovers.json',
        description: 'Alternative market movers endpoint'
      },
      {
        name: 'QuoteData',
        url: 'https://app.quotemedia.com/datatool/getQuoteData.json',
        description: 'Individual quote data endpoint'
      },
      {
        name: 'MarketData',
        url: 'https://app.quotemedia.com/datatool/getMarketData.json',
        description: 'General market data endpoint'
      },
      {
        name: 'Exchanges',
        url: 'https://app.quotemedia.com/datatool/getExchanges.json',
        description: 'Available exchanges endpoint'
      }
    ];

    // Different parameter combinations to test
    const parameterSets = [
      {
        name: 'Standard AMX',
        params: {
          marketSession: 'NORMAL',
          qmodTool: 'MarketMovers',
          stat: 'pl',
          statExchange: 'AMX',
          statTop: '50',
          timezone: 'true',
          webmasterId: '101020'
        }
      },
      {
        name: 'NYSE Alternative',
        params: {
          marketSession: 'NORMAL',
          qmodTool: 'MarketMovers',
          stat: 'ga',
          statExchange: 'NYSE',
          statTop: '25',
          timezone: 'true',
          webmasterId: '101020'
        }
      },
      {
        name: 'NASDAQ Test',
        params: {
          marketSession: 'NORMAL',
          qmodTool: 'MarketMovers',
          stat: 'ac',
          statExchange: 'NASDAQ',
          statTop: '30',
          timezone: 'true',
          webmasterId: '101020'
        }
      },
      {
        name: 'No Exchange Filter',
        params: {
          marketSession: 'NORMAL',
          qmodTool: 'MarketMovers',
          stat: 'pl',
          statTop: '50',
          timezone: 'true',
          webmasterId: '101020'
          // No statExchange - see all markets
        }
      },
      {
        name: 'Different WebmasterID',
        params: {
          marketSession: 'NORMAL',
          qmodTool: 'MarketMovers',
          stat: 'pl',
          statExchange: 'NYSE',
          statTop: '25',
          timezone: 'true',
          webmasterId: '101021' // Different ID
        }
      }
    ];

    // Different market sessions to test
    const marketSessions = ['NORMAL', 'PRE', 'POST', 'EXTENDED'];

    if (testType === 'endpoints') {
      // Test different API endpoints
      console.log('🔍 Testing different API endpoints...');
      
      for (const endpoint of endpoints) {
        console.log(`📡 Testing ${endpoint.name}: ${endpoint.url}`);
        
        try {
          const testUrl = endpoint.url + '?' + new URLSearchParams({
            marketSession: 'NORMAL',
            sid: sessionId,
            stat: 'pl',
            statExchange: 'AMX',
            statTop: '10',
            timezone: 'true',
            webmasterId: '101020'
          });

          const response = await fetch(testUrl, {
            headers: {
              'accept': '*/*',
              'datatool-token': '8c1a0cdbea19b8198ca3543e1f3b073d9d6c4f11881fb01c24c259807b273238',
              'origin': 'https://api.quotemedia.com',
              'referer': 'https://api.quotemedia.com/',
              'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36'
            }
          });

          const rawData = await response.text();
          let data;
          try {
            data = JSON.parse(rawData);
          } catch (e) {
            data = { parseError: true, raw: rawData.substring(0, 200) };
          }

          results.discoveries.push({
            endpoint: endpoint.name,
            url: endpoint.url,
            status: response.status,
            success: response.ok,
            dataType: typeof data,
            isArray: Array.isArray(data),
            dataPreview: Array.isArray(data) ? 
              { length: data.length, sample: data[0] ? Object.keys(data[0]) : null } :
              { keys: typeof data === 'object' && data ? Object.keys(data) : null },
            rawPreview: rawData.substring(0, 200)
          });

        } catch (error) {
          results.discoveries.push({
            endpoint: endpoint.name,
            url: endpoint.url,
            error: error instanceof Error ? error.message : String(error),
            success: false
          });
        }
      }
    }
    
    else if (testType === 'parameters') {
      // Test different parameter combinations
      console.log('🔍 Testing different parameter combinations...');
      
      const baseUrl = 'https://app.quotemedia.com/datatool/getMarketStats.json';
      
      for (const paramSet of parameterSets) {
        console.log(`📊 Testing ${paramSet.name}...`);
        
        try {
          const testParams: Record<string, string> = {
            sid: sessionId,
            pathName: '/qsmodule/research/'
          };
          
          // Add all params from paramSet, ensuring all values are strings
          Object.entries(paramSet.params).forEach(([key, value]) => {
            if (value !== undefined) {
              testParams[key] = String(value);
            }
          });

          const testUrl = baseUrl + '?' + new URLSearchParams(testParams);

          const response = await fetch(testUrl, {
            headers: {
              'accept': '*/*',
              'datatool-token': '8c1a0cdbea19b8198ca3543e1f3b073d9d6c4f11881fb01c24c259807b273238',
              'origin': 'https://api.quotemedia.com',
              'referer': 'https://api.quotemedia.com/',
              'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36'
            }
          });

          const rawData = await response.text();
          let data;
          let symbolCount = 0;
          let exchanges = new Set();

          try {
            data = JSON.parse(rawData);
            if (Array.isArray(data)) {
              symbolCount = data.length;
              data.forEach((item: any) => {
                if (item.key?.exchange) exchanges.add(item.key.exchange);
              });
            } else if (data?.results?.symbolcount !== undefined) {
              symbolCount = data.results.symbolcount;
            }
          } catch (e) {
            data = { parseError: true };
          }

          results.discoveries.push({
            parameterSet: paramSet.name,
            parameters: paramSet.params,
            status: response.status,
            success: response.ok && symbolCount > 0,
            symbolCount,
            exchanges: Array.from(exchanges),
            dataType: typeof data,
            isArray: Array.isArray(data),
            rawPreview: rawData.substring(0, 150)
          });

        } catch (error) {
          results.discoveries.push({
            parameterSet: paramSet.name,
            parameters: paramSet.params,
            error: error instanceof Error ? error.message : String(error),
            success: false
          });
        }
      }
    }
    
    else if (testType === 'sessions') {
      // Test different market sessions
      console.log('🔍 Testing different market sessions...');
      
      const baseUrl = 'https://app.quotemedia.com/datatool/getMarketStats.json';
      
      for (const session of marketSessions) {
        console.log(`🕒 Testing ${session} session...`);
        
        try {
          const testParams = {
            marketSession: session,
            sid: sessionId,
            pathName: '/qsmodule/research/',
            qmodTool: 'MarketMovers',
            stat: 'pl',
            statExchange: 'AMX',
            statTop: '25',
            timezone: 'true',
            webmasterId: '101020'
          };

          const testUrl = baseUrl + '?' + new URLSearchParams(testParams);

          const response = await fetch(testUrl, {
            headers: {
              'accept': '*/*',
              'datatool-token': '8c1a0cdbea19b8198ca3543e1f3b073d9d6c4f11881fb01c24c259807b273238',
              'origin': 'https://api.quotemedia.com',
              'referer': 'https://api.quotemedia.com/',
              'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36'
            }
          });

          const rawData = await response.text();
          let data;
          let symbolCount = 0;

          try {
            data = JSON.parse(rawData);
            if (Array.isArray(data)) {
              symbolCount = data.length;
            } else if (data?.results?.symbolcount !== undefined) {
              symbolCount = data.results.symbolcount;
            }
          } catch (e) {
            data = { parseError: true };
          }

          results.discoveries.push({
            marketSession: session,
            status: response.status,
            success: response.ok && symbolCount > 0,
            symbolCount,
            dataType: typeof data,
            isArray: Array.isArray(data),
            rawPreview: rawData.substring(0, 150)
          });

        } catch (error) {
          results.discoveries.push({
            marketSession: session,
            error: error instanceof Error ? error.message : String(error),
            success: false
          });
        }
      }
    }

    console.log(`✅ Discovery complete: ${results.discoveries.length} tests run`);
    
    // Summary
    const summary = {
      totalTests: results.discoveries.length,
      successfulTests: results.discoveries.filter(d => d.success).length,
      failedTests: results.discoveries.filter(d => !d.success).length,
      withData: results.discoveries.filter(d => d.symbolCount > 0).length
    };

    return NextResponse.json({
      ...results,
      summary,
      recommendations: generateRecommendations(results.discoveries)
    });

  } catch (error) {
    console.error('❌ Discovery error:', error);
    return NextResponse.json(
      { error: 'Discovery failed', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

function generateRecommendations(discoveries: any[]) {
  const recommendations = [];
  
  const successfulDiscoveries = discoveries.filter(d => d.success && d.symbolCount > 0);
  const workingEndpoints = discoveries.filter(d => d.endpoint && d.success);
  const workingParameters = discoveries.filter(d => d.parameterSet && d.success);
  
  if (successfulDiscoveries.length > 0) {
    recommendations.push({
      type: 'success',
      message: `Found ${successfulDiscoveries.length} working configurations with data`
    });
  }
  
  if (workingEndpoints.length > 0) {
    recommendations.push({
      type: 'endpoints',
      message: `Working endpoints: ${workingEndpoints.map(w => w.endpoint).join(', ')}`
    });
  }
  
  if (workingParameters.length > 0) {
    recommendations.push({
      type: 'parameters',
      message: `Working parameter sets: ${workingParameters.map(w => w.parameterSet).join(', ')}`
    });
  }
  
  return recommendations;
}