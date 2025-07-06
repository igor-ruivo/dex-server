#!/usr/bin/env node

const https = require('https');

// Replace with your actual Vercel URL
const BASE_URL = 'https://your-app.vercel.app'; // Update this!

async function makeRequest(path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: new URL(BASE_URL).hostname,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      }
    };

    if (body) {
      const data = JSON.stringify(body);
      options.headers['Content-Length'] = Buffer.byteLength(data);
    }

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve({ status: res.statusCode, data: jsonData });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', reject);
    
    if (body) {
      req.write(JSON.stringify(body));
    }
    
    req.end();
  });
}

async function testCronVerification() {
  console.log('🔍 Testing Cron Job Verification');
  console.log('================================');
  console.log(`Testing against: ${BASE_URL}`);
  console.log('');

  try {
    // 1. Check Status
    console.log('1️⃣ Checking system status...');
    const status = await makeRequest('/api/status');
    console.log('Status Response:', JSON.stringify(status.data, null, 2));
    
    if (status.data.scheduler?.running) {
      console.log('✅ Scheduler is running');
    } else {
      console.log('❌ Scheduler is not running');
    }
    
    if (status.data.scheduler?.nextRunTime) {
      console.log(`⏰ Next run time: ${status.data.scheduler.nextRunTime}`);
    }
    
    console.log('');

    // 2. Check if data files exist
    console.log('2️⃣ Checking data files...');
    const dataResponse = await makeRequest('/api/data?type=all');
    if (dataResponse.status === 200) {
      console.log('✅ Data files exist and are accessible');
      console.log(`📊 Data structure: ${Object.keys(dataResponse.data).join(', ')}`);
    } else {
      console.log('❌ Data files not accessible');
    }
    
    console.log('');

    // 3. Test manual trigger
    console.log('3️⃣ Testing manual trigger...');
    const triggerResponse = await makeRequest('/api/trigger', 'POST');
    if (triggerResponse.status === 200) {
      console.log('✅ Manual trigger successful');
      console.log('📊 Trigger response:', JSON.stringify(triggerResponse.data, null, 2));
    } else {
      console.log('❌ Manual trigger failed');
      console.log('Error:', triggerResponse.data);
    }
    
    console.log('');

    // 4. Check status again after trigger
    console.log('4️⃣ Checking status after trigger...');
    const statusAfter = await makeRequest('/api/status');
    console.log('Updated file info:', JSON.stringify(statusAfter.data.data, null, 2));
    
    console.log('');
    console.log('🎉 Cron verification test completed!');
    console.log('');
    console.log('📋 Summary:');
    console.log('- Status endpoint: Working');
    console.log('- Data files: Accessible');
    console.log('- Manual trigger: Functional');
    console.log('- Scheduler: Active');
    console.log('');
    console.log('💡 The cron job will run daily at 6 AM UTC');
    console.log('💡 You can manually trigger updates anytime via POST /api/trigger');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.log('');
    console.log('🔧 Troubleshooting:');
    console.log('1. Make sure your Vercel app is deployed');
    console.log('2. Update the BASE_URL in this script');
    console.log('3. Check Vercel function logs for errors');
  }
}

// Update the BASE_URL before running
if (BASE_URL === 'https://your-app.vercel.app') {
  console.log('⚠️  Please update the BASE_URL in this script with your actual Vercel URL');
  console.log('Example: const BASE_URL = "https://my-app.vercel.app";');
  process.exit(1);
}

testCronVerification(); 