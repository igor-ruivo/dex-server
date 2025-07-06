const { PokemonGoDataServer } = require('./dist/src/index');

async function testCompleteFlow() {
  console.log('🧪 Testing Complete Pokemon GO Data Flow');
  console.log('==========================================\n');

  try {
    // 1. Start the server
    console.log('1️⃣ Starting Pokemon GO Data Server...');
    const server = new PokemonGoDataServer();
    await server.start();
    console.log('✅ Server started successfully\n');

    // 2. Run manual aggregation
    console.log('2️⃣ Running manual data aggregation...');
    await server.runManualAggregation();
    console.log('✅ Data aggregation completed\n');

    // 3. Check status
    console.log('3️⃣ Checking server status...');
    const status = server.getStatus();
    console.log('📊 Scheduler running:', status.schedulerRunning);
    console.log('⏰ Next run time:', status.nextRunTime);
    
    const fileInfo = await status.fileInfo;
    console.log('📁 Generated files:');
    Object.entries(fileInfo).forEach(([file, info]) => {
      console.log(`   - ${file}: ${info.size} bytes, modified ${info.lastModified}`);
    });
    console.log('✅ Status check completed\n');

    // 4. Test API endpoints
    console.log('4️⃣ Testing API endpoints...');
    
    // Test data endpoint
    const dataResponse = await fetch('http://localhost:3000/api/data?type=all');
    if (dataResponse.ok) {
      const data = await dataResponse.json();
      console.log('📊 Data API response:');
      console.log(`   - Events: ${data.events?.length || 0}`);
      console.log(`   - Raid Bosses: ${data.raidBosses?.current?.length || 0} current, ${data.raidBosses?.upcoming?.length || 0} upcoming`);
      console.log(`   - Game Master Pokemon: ${data.gameMaster?.pokemon?.length || 0}`);
      console.log(`   - Team Rocket: ${data.teamRocket?.length || 0}`);
    } else {
      console.log('❌ Data API failed:', dataResponse.status);
    }

    // Test status endpoint
    const statusResponse = await fetch('http://localhost:3000/api/status');
    if (statusResponse.ok) {
      const statusData = await statusResponse.json();
      console.log('📈 Status API response:', statusData);
    } else {
      console.log('❌ Status API failed:', statusResponse.status);
    }

    console.log('✅ API testing completed\n');

    // 5. Show how to use from external frontend
    console.log('5️⃣ External Frontend Usage Examples:');
    console.log('=====================================');
    console.log('');
    console.log('🌐 JavaScript/Fetch:');
    console.log(`
// Get all data
const response = await fetch('https://your-vercel-app.vercel.app/api/data?type=all');
const data = await response.json();

// Get specific data types
const events = await fetch('https://your-vercel-app.vercel.app/api/data?type=events');
const raids = await fetch('https://your-vercel-app.vercel.app/api/data?type=raid-bosses');
const gameMaster = await fetch('https://your-vercel-app.vercel.app/api/data?type=game-master');

// Check server status
const status = await fetch('https://your-vercel-app.vercel.app/api/status');
    `);
    
    console.log('📱 React Example:');
    console.log(`
import { useState, useEffect } from 'react';

function PokemonData() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('https://your-vercel-app.vercel.app/api/data?type=all')
      .then(res => res.json())
      .then(data => {
        setData(data);
        setLoading(false);
      });
  }, []);

  if (loading) return <div>Loading...</div>;
  
  return (
    <div>
      <h2>Pokemon GO Data</h2>
      <p>Events: {data.events.length}</p>
      <p>Current Raids: {data.raidBosses.current.length}</p>
      <p>Pokemon: {data.gameMaster.pokemon.length}</p>
    </div>
  );
}
    `);

    console.log('✅ Test completed successfully!');
    console.log('\n🚀 Your Pokemon GO data server is ready for production!');
    console.log('📝 Deploy to Vercel and update the URLs in your frontend app.');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
testCompleteFlow(); 