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
