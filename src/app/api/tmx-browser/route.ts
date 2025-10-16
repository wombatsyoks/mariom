import { NextRequest, NextResponse } from 'next/server';

interface TMXBrowserRequest {
  sessionId: string;
  url?: string;
  action?: 'login' | 'browse' | 'extract-apis';
}

interface TMXBrowserResponse {
  success: boolean;
  html?: string;
  apis?: Array<{
    url: string;
    method: string;
    headers: Record<string, string>;
    params?: Record<string, string>;
  }>;
  error?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse<TMXBrowserResponse>> {
  try {
    console.log('🌐 TMX PowerStream browser request received');
    
    const body: TMXBrowserRequest = await request.json();
    
    if (!body.sessionId) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Session ID is required' 
        },
        { status: 400 }
      );
    }

    const action = body.action || 'browse';
    const targetUrl = body.url || 'https://tmxpowerstream.com/powerStreamWeb.php';

    console.log('📋 Action:', action);
    console.log('🔗 Target URL:', targetUrl);
    console.log('🍪 Using session ID:', body.sessionId.substring(0, 10) + '...');

    // Set up headers with the authenticated session
    const headers: Record<string, string> = {
      'Cookie': `PHPSESSID=${body.sessionId}`,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Referer': 'https://tmxpowerstream.com/',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache'
    };

    if (action === 'browse' || action === 'extract-apis') {
      // Browse the authenticated TMX PowerStream interface
      console.log('🚀 Fetching TMX PowerStream page...');
      
      const response = await fetch(targetUrl, {
        method: 'GET',
        headers,
        credentials: 'include'
      });

      if (!response.ok) {
        console.error('❌ TMX request failed:', response.status, response.statusText);
        return NextResponse.json({
          success: false,
          error: `TMX request failed: ${response.status} ${response.statusText}`
        }, { status: response.status });
      }

      const html = await response.text();
      console.log('✅ TMX page fetched, length:', html.length);

      if (action === 'extract-apis') {
        // Extract API calls from the HTML/JavaScript
        const apis = extractAPICalls(html);
        console.log('🔍 Found', apis.length, 'potential API calls');
        
        return NextResponse.json({
          success: true,
          apis,
          html: html.substring(0, 2000) + '...' // Truncated HTML for debugging
        });
      } else {
        // Return the HTML for manual inspection
        return NextResponse.json({
          success: true,
          html: html.substring(0, 5000) + '...' // Truncated for readability
        });
      }
    }

    return NextResponse.json({
      success: false,
      error: 'Invalid action specified'
    }, { status: 400 });

  } catch (error) {
    console.error('❌ TMX browser error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 });
  }
}

function extractAPICalls(html: string): Array<{
  url: string;
  method: string;
  headers: Record<string, string>;
  params?: Record<string, string>;
}> {
  const apis: Array<{
    url: string;
    method: string;
    headers: Record<string, string>;
    params?: Record<string, string>;
  }> = [];

  try {
    // Look for fetch() calls in JavaScript
    const fetchMatches = html.match(/fetch\s*\(\s*['"](.*?)['"][^)]*\)/g) || [];
    fetchMatches.forEach(match => {
      const urlMatch = match.match(/fetch\s*\(\s*['"](.*?)['"]/);
      if (urlMatch) {
        apis.push({
          url: urlMatch[1],
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        });
      }
    });

    // Look for XMLHttpRequest calls
    const xhrMatches = html.match(/\.open\s*\(\s*['"](\w+)['"]\s*,\s*['"](.*?)['"][^)]*\)/g) || [];
    xhrMatches.forEach(match => {
      const methodMatch = match.match(/\.open\s*\(\s*['"](\w+)['"]/);
      const urlMatch = match.match(/,\s*['"](.*?)['"]/);
      if (methodMatch && urlMatch) {
        apis.push({
          url: urlMatch[1],
          method: methodMatch[1].toUpperCase(),
          headers: { 'Content-Type': 'application/json' }
        });
      }
    });

    // Look for QuoteMedia specific patterns
    const quoteMediaMatches = html.match(/quotemedia\.com[^'"]*|app\.quotemedia\.com[^'"]*/g) || [];
    quoteMediaMatches.forEach(url => {
      if (!apis.find(api => api.url.includes(url))) {
        apis.push({
          url: url.startsWith('http') ? url : `https://${url}`,
          method: 'GET',
          headers: { 'Accept': 'application/json' }
        });
      }
    });

    // Look for data URLs in script tags
    const scriptDataMatches = html.match(/data\s*[:=]\s*['"](https?:\/\/[^'"]+)['"]/g) || [];
    scriptDataMatches.forEach(match => {
      const urlMatch = match.match(/['"](https?:\/\/[^'"]+)['"]/);
      if (urlMatch) {
        apis.push({
          url: urlMatch[1],
          method: 'GET',
          headers: { 'Accept': 'application/json' }
        });
      }
    });

  } catch (error) {
    console.error('Error extracting API calls:', error);
  }

  return apis;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  return NextResponse.json({
    message: 'TMX PowerStream Browser API',
    usage: {
      method: 'POST',
      body: {
        sessionId: 'Required: TMX session ID from /api/tmx-auth',
        url: 'Optional: TMX URL to browse (default: streamer.php)',
        action: 'Optional: "browse" | "extract-apis" (default: browse)'
      }
    },
    endpoints: {
      browse: 'Fetch and return HTML content from authenticated TMX session',
      extractApis: 'Extract potential API calls from TMX PowerStream JavaScript'
    }
  });
}