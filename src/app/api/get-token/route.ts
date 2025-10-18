import { NextRequest, NextResponse } from 'next/server';
import { generateDataToolToken } from '@/lib/quotemedia-auth';

/**
 * API endpoint to provide fresh datatool tokens to client-side components
 * This is needed because token generation requires server-side credentials
 */
export async function GET(request: NextRequest) {
  try {
    console.log('🔑 Client requesting fresh datatool token...');
    
    // Generate fresh datatool token
    const dataToolToken = await generateDataToolToken();
    
    return NextResponse.json({
      success: true,
      token: dataToolToken,
      timestamp: new Date().toISOString(),
      expiresIn: 30 * 60 * 1000 // 30 minutes in milliseconds
    });
    
  } catch (error) {
    console.error('❌ Failed to generate token for client:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Token generation failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}