import { NextRequest, NextResponse } from 'next/server';

interface TMXLoginRequest {
  userName: string;
  password: string;
  wmid: string;
  forwardURL: string;
  targetURL: string;
}

interface TMXSessionData {
  sessionId: string;
  userId: string;
  wmid: string;
  forwardURL: string;
  loginTime: string;
  expiresAt: string;
}

interface TMXLoginResponse {
  success: boolean;
  sessionData?: TMXSessionData;
  redirectUrl?: string;
  error?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse<TMXLoginResponse>> {
  try {
    console.log('🔐 TMX PowerStream authentication request received');
    
    const body: TMXLoginRequest = await request.json();
    
    // Validate required fields
    if (!body.userName || !body.password) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Username and password are required' 
        },
        { status: 400 }
      );
    }

    console.log('📝 TMX Login attempt for user:', body.userName);
    console.log('🔗 Forward URL:', body.forwardURL);

        // Use environment variables as defaults if credentials not provided
    const username = body.userName || process.env.TMX_USERNAME;
    const password = body.password || process.env.TMX_PASSWORD;
    const wmid = body.wmid || process.env.TMX_WMID || '101020';
    
    if (!username || !password) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'TMX credentials not provided. Please set TMX_USERNAME and TMX_PASSWORD in environment or provide credentials.' 
        },
        { status: 400 }
      );
    }

    // Create form data for TMX PowerStream login
    const formData = new URLSearchParams();
    formData.append('wmid', wmid);
    formData.append('userName', username);
    formData.append('password', password);
    formData.append('forwardURL', body.forwardURL || 'https://tmxpowerstream.com/powerStreamWeb.php');
    formData.append('targetURL', body.targetURL || 'https://tmxpowerstream.com/?loginError=true');

    console.log('🚀 Posting to TMX PowerStream session.php...');

    // Make the authentication request to TMX PowerStream
    const tmxResponse = await fetch('https://tmxpowerstream.com/session.php', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Referer': 'https://tmxpowerstream.com/',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      body: formData.toString(),
      redirect: 'manual', // Don't follow redirects automatically
    });

    console.log('📊 TMX Response status:', tmxResponse.status);
    console.log('📋 TMX Response headers:', Object.fromEntries(tmxResponse.headers.entries()));

    // Check if we got a redirect (successful login)
    if (tmxResponse.status === 302 || tmxResponse.status === 301) {
      const location = tmxResponse.headers.get('Location');
      const setCookieHeaders = tmxResponse.headers.getSetCookie();
      
      console.log('✅ TMX Login successful - redirect to:', location);
      console.log('🍪 Set-Cookie headers:', setCookieHeaders);

      // Extract session information from cookies
      let sessionId = '';
      let userId = body.userName;
      
      // Parse cookies to extract session data
      setCookieHeaders.forEach(cookie => {
        if (cookie.includes('PHPSESSID=')) {
          const match = cookie.match(/PHPSESSID=([^;]+)/);
          if (match) {
            sessionId = match[1];
          }
        }
      });

      // If no session ID found, generate one for tracking
      if (!sessionId) {
        sessionId = `tmx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      }

      const now = new Date();
      const expiresAt = new Date(now.getTime() + (8 * 60 * 60 * 1000)); // 8 hours from now

      const sessionData: TMXSessionData = {
        sessionId,
        userId: username,
        wmid: wmid,
        forwardURL: location || 'https://tmxpowerstream.com/powerStreamWeb.php',
        loginTime: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
      };

      // Store session cookies for future requests
      const response = NextResponse.json({
        success: true,
        sessionData,
        redirectUrl: location || body.forwardURL,
      });

      // Set cookies for session management
      setCookieHeaders.forEach(cookie => {
        const [cookiePart] = cookie.split(';');
        const [name, value] = cookiePart.split('=');
        if (name && value) {
          response.cookies.set(name, value, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 8 * 60 * 60, // 8 hours
          });
        }
      });

      console.log('✅ TMX session established successfully');
      return response;

    } else {
      // Login failed
      const responseText = await tmxResponse.text();
      console.log('❌ TMX Login failed - Response:', responseText.substring(0, 500));
      
      // Check if response contains login error indicators
      const isLoginError = responseText.includes('loginError=true') || 
                          responseText.includes('Invalid') || 
                          responseText.includes('incorrect') ||
                          tmxResponse.status >= 400;

      return NextResponse.json(
        { 
          success: false, 
          error: isLoginError 
            ? 'Invalid username or password. Please check your TMX PowerStream credentials.'
            : 'Authentication failed. Please try again later.' 
        },
        { status: 401 }
      );
    }

  } catch (error) {
    console.error('❌ TMX authentication error:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Authentication service unavailable' 
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  // Check if user has an active TMX session
  const sessionCookie = request.cookies.get('PHPSESSID');
  
  if (sessionCookie) {
    return NextResponse.json({
      success: true,
      hasSession: true,
      sessionId: sessionCookie.value,
    });
  }

  return NextResponse.json({
    success: true,
    hasSession: false,
  });
}