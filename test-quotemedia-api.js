// Test script for the updated QuoteMedia API
const fetch = require('node-fetch');

async function testQuoteMediaAPI() {
  console.log('🧪 Testing QuoteMedia US Stocks API...');
  
  const baseUrl = 'http://localhost:3000/api/tmx-quotemedia-proxy';
  
  // Test different parameters
  const tests = [
    {
      name: 'Default US Stocks (After Hours)',
      params: ''
    },
    {
      name: 'Volume Leaders',
      params: '?stat=vol&statTop=50'
    },
    {
      name: 'Percent Gainers',
      params: '?stat=pg&statTop=25'
    },
    {
      name: 'Pre-Market Movers',
      params: '?marketSession=PRE&stat=ah&statTop=30'
    }
  ];
  
  for (const test of tests) {
    try {
      console.log(`\n📊 Testing: ${test.name}`);
      console.log(`   URL: ${baseUrl}${test.params}`);
      
      const response = await fetch(`${baseUrl}${test.params}`);
      const data = await response.json();
      
      if (response.ok && data.success) {
        console.log(`   ✅ SUCCESS: ${data.totalSymbols} quotes retrieved`);
        console.log(`   📈 Source: ${data.source}`);
        if (data.quotes && data.quotes.length > 0) {
          const sample = data.quotes[0];
          console.log(`   🔸 Sample: ${sample.symbol} - $${sample.price} (${sample.changePercent > 0 ? '+' : ''}${sample.changePercent.toFixed(2)}%)`);
        }
      } else {
        console.log(`   ❌ FAILED: ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.log(`   ❌ ERROR: ${error.message}`);
    }
    
    // Wait between tests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Test health check
  console.log('\n🏥 Testing health check (POST)...');
  try {
    const response = await fetch(baseUrl, { method: 'POST' });
    const data = await response.json();
    
    if (response.ok && data.success) {
      console.log('   ✅ Health check passed');
      console.log(`   📝 Message: ${data.message}`);
      console.log(`   🔑 Session ID: ${data.authentication.sessionId}`);
    } else {
      console.log('   ❌ Health check failed');
    }
  } catch (error) {
    console.log(`   ❌ Health check error: ${error.message}`);
  }
}

// Run the test if this script is executed directly
if (require.main === module) {
  testQuoteMediaAPI();
}

module.exports = { testQuoteMediaAPI };