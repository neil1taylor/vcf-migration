/**
 * Local test script for the pricing proxy function
 *
 * Usage:
 *   node test.js
 *   IBM_CLOUD_API_KEY=your-key node test.js
 */

const { main } = require('./index');

async function test() {
  console.log('Testing pricing proxy function...\n');

  // Test 1: Basic invocation (no API key - returns defaults)
  console.log('Test 1: Basic invocation without API key');
  console.log('=========================================');

  const result1 = await main({});
  console.log('Status:', result1.statusCode);
  console.log('Cached:', result1.body.cached);
  console.log('Source:', result1.body.source);
  console.log('VSI Profiles:', Object.keys(result1.body.vsiProfiles || {}).length);
  console.log('Regions:', Object.keys(result1.body.regions || {}).length);
  console.log('');

  // Test 2: With API key (if provided)
  if (process.env.IBM_CLOUD_API_KEY) {
    console.log('Test 2: Invocation with API key');
    console.log('================================');

    const result2 = await main({
      IBM_CLOUD_API_KEY: process.env.IBM_CLOUD_API_KEY,
    });
    console.log('Status:', result2.statusCode);
    console.log('Cached:', result2.body.cached);
    console.log('Last Updated:', result2.body.lastUpdated);
    console.log('');
  } else {
    console.log('Test 2: Skipped (no IBM_CLOUD_API_KEY in environment)');
    console.log('');
  }

  // Test 3: Cache behavior
  console.log('Test 3: Cache behavior');
  console.log('======================');

  const result3 = await main({});
  console.log('Second call - Cached:', result3.body.cached);
  console.log('Cache Age:', result3.body.cacheAge, 'seconds');
  console.log('');

  // Test 4: Force refresh
  console.log('Test 4: Force refresh');
  console.log('=====================');

  const result4 = await main({ refresh: 'true' });
  console.log('With refresh=true - Cached:', result4.body.cached);
  console.log('');

  // Test 5: CORS preflight
  console.log('Test 5: CORS preflight');
  console.log('======================');

  const result5 = await main({ __ow_method: 'options' });
  console.log('Status:', result5.statusCode);
  console.log('CORS Headers:', result5.headers['Access-Control-Allow-Origin']);
  console.log('');

  // Output sample pricing data
  console.log('Sample Pricing Data');
  console.log('===================');
  console.log('cx2-2x4 hourly rate:', result1.body.vsiProfiles?.['cx2-2x4']?.hourlyRate);
  console.log('Storage cost/GB:', result1.body.blockStorage?.generalPurpose?.costPerGBMonth);
  console.log('Load Balancer/mo:', result1.body.networking?.loadBalancer?.perLBMonthly);
  console.log('');

  console.log('All tests completed!');
}

test().catch(console.error);
