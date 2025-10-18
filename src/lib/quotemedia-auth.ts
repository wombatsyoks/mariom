interface QuoteMediaAuthResponse {
  success: boolean;
  sessionId: string;
  error?: string;
}

interface QuoteMediaAuthRequest {
  wmId: number;
  username: string;
  password: string;
}

let cachedSid: string | null = null;
let sidExpiration: number | null = null;

// Cache for datatool token
let cachedDataToolToken: string | null = null;
let tokenExpiration: number | null = null;

// DISCOVERY: Static hash from Python implementation that works across all sessions
const STATIC_TOKEN_HASH = "32767a4633142b08e3315819e5eeef1af1be83bd7817e59926d246d7ba416430";

export async function getQuoteMediaSid(): Promise<string> {
  // Check if we have a valid cached SID (valid for 1 hour)
  if (cachedSid && sidExpiration && Date.now() < sidExpiration) {
    console.log('🔄 Using cached QuoteMedia SID');
    return cachedSid;
  }

  try {
    console.log('🔐 Authenticating with QuoteMedia...');
    
    const authData: QuoteMediaAuthRequest = {
      wmId: parseInt(process.env.QUOTEMEDIA_WEBMASTER_ID || '101020'), // Use webmaster ID from working example
      username: process.env.QUOTEMEDIA_USERNAME || '',
      password: process.env.QUOTEMEDIA_PASSWORD || ''
    };

    if (!authData.username || !authData.password) {
      throw new Error('QuoteMedia credentials not found in environment variables');
    }

    const response = await fetch('https://app.quotemedia.com/auth/p/authenticate/v0/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
      },
      body: JSON.stringify(authData)
    });

    if (!response.ok) {
      throw new Error(`Authentication failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log('📋 QuoteMedia Auth Response:', JSON.stringify(data, null, 2));

    // Extract SID from response - QuoteMedia uses 'sid' field
    const sessionId = data.sid;

    if (!sessionId) {
      throw new Error('No session ID found in authentication response');
    }

    // Cache the SID for 1 hour
    cachedSid = sessionId;
    sidExpiration = Date.now() + (60 * 60 * 1000); // 1 hour

    console.log('✅ QuoteMedia authentication successful, SID cached');
    return sessionId;

  } catch (error) {
    console.error('❌ QuoteMedia authentication failed:', error);
    throw error;
  }
}

// Function to clear cached SID (useful when we get 403/401 errors)
export function clearCachedSid(): void {
  cachedSid = null;
  sidExpiration = null;
  console.log('🗑️ Cleared cached QuoteMedia SID');
}

// Function to clear cached token
export function clearCachedToken(): void {
  cachedDataToolToken = null;
  tokenExpiration = null;
  console.log('🗑️ Cleared cached Datatool Token');
}

/**
 * Generate a fresh Datatool-Token using the static hash authentication method
 * Based on Python implementation discovery
 */
export async function generateDataToolToken(): Promise<string> {
  // Check if we have a valid cached token (valid for 30 minutes)
  if (cachedDataToolToken && tokenExpiration && Date.now() < tokenExpiration) {
    console.log('🔄 Using cached Datatool Token');
    return cachedDataToolToken;
  }

  try {
    // First, ensure we have a valid SID
    const sid = await getQuoteMediaSid();
    
    console.log('🔑 Generating fresh Datatool-Token...');
    
    // Use the static hash authentication endpoint from Python discovery
    const wmid = process.env.QUOTEMEDIA_WEBMASTER_ID || '101020';
    const tokenUrl = `https://app.quotemedia.com/auth/g/authenticate/dataTool/v0/${wmid}/${STATIC_TOKEN_HASH}`;
    
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'datatool-token': 'null',
        'origin': 'https://qrm.quotemedia.com',
        'referer': 'https://qrm.quotemedia.com/',
        'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
        'accept': '*/*',
        'content-type': 'application/json'
      },
      body: JSON.stringify({ sid })
    });

    if (!response.ok) {
      throw new Error(`Token generation failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const token = data.token;

    if (!token) {
      throw new Error('No token found in response');
    }

    // Cache the token for 30 minutes (shorter than SID to be safe)
    cachedDataToolToken = token;
    tokenExpiration = Date.now() + (30 * 60 * 1000); // 30 minutes

    console.log('✅ Fresh Datatool-Token generated and cached');
    return token;

  } catch (error) {
    console.error('❌ Datatool-Token generation failed:', error);
    throw error;
  }
}
