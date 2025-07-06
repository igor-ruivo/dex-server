const { PokemonGoDataServer } = require('./dist/src/index');
const fs = require('fs').promises;
const path = require('path');

async function testSimpleFlow() {
  console.log('🧪 Testing Pokemon GO Data Flow (Simple)');
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

    // 3. Check generated files
    console.log('3️⃣ Checking generated files...');
    const dataDir = path.join(process.cwd(), 'public', 'data');
    
    try {
      const files = await fs.readdir(dataDir);
      console.log('📁 Generated files in public/data/:');
      
      for (const file of files) {
        const filePath = path.join(dataDir, file);
        const stats = await fs.stat(filePath);
        console.log(`   - ${file}: ${stats.size} bytes, modified ${stats.mtime}`);
        
        // Show sample data for aggregated-data.json
        if (file === 'aggregated-data.json') {
          const data = JSON.parse(await fs.readFile(filePath, 'utf-8'));
          console.log('📊 Sample aggregated data:');
          console.log(`   - Events: ${data.events?.length || 0}`);
          console.log(`   - Current Raid Bosses: ${data.raidBosses?.current?.length || 0}`);
          console.log(`   - Upcoming Raid Bosses: ${data.raidBosses?.upcoming?.length || 0}`);
          console.log(`   - Game Master Pokemon: ${data.gameMaster?.pokemon?.length || 0}`);
          console.log(`   - Team Rocket: ${data.teamRocket?.length || 0}`);
          console.log(`   - Last Fetch: ${data.metadata?.lastFetch}`);
        }
      }
    } catch (error) {
      console.log('❌ No data files found yet. This is normal for first run.');
    }

    console.log('✅ File check completed\n');

    // 4. Show API usage examples
    console.log('4️⃣ API Usage Examples:');
    console.log('=======================');
    console.log('');
    console.log('🌐 After deploying to Vercel, use these endpoints:');
    console.log('');
    console.log('📊 Get all data:');
    console.log('   GET https://your-app.vercel.app/api/data?type=all');
    console.log('');
    console.log('📅 Get events only:');
    console.log('   GET https://your-app.vercel.app/api/data?type=events');
    console.log('');
    console.log('⚔️ Get raid bosses:');
    console.log('   GET https://your-app.vercel.app/api/data?type=raid-bosses');
    console.log('');
    console.log('🎮 Get game master data:');
    console.log('   GET https://your-app.vercel.app/api/data?type=game-master');
    console.log('');
    console.log('📈 Check server status:');
    console.log('   GET https://your-app.vercel.app/api/status');
    console.log('');
    console.log('🔄 Trigger manual aggregation:');
    console.log('   POST https://your-app.vercel.app/api/trigger');
    console.log('');

    // 5. Frontend integration examples
    console.log('5️⃣ Frontend Integration Examples:');
    console.log('=================================');
    console.log('');
    console.log('📱 React Hook Example:');
    console.log(`
import { useState, useEffect } from 'react';

export function usePokemonData(type = 'all') {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await fetch(\`https://your-app.vercel.app/api/data?type=\${type}\`);
        if (!response.ok) throw new Error('Failed to fetch data');
        const result = await response.json();
        setData(result);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [type]);

  return { data, loading, error };
}

// Usage:
function PokemonApp() {
  const { data, loading, error } = usePokemonData('all');
  
  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  
  return (
    <div>
      <h1>Pokemon GO Data</h1>
      <p>Events: {data.events.length}</p>
      <p>Current Raids: {data.raidBosses.current.length}</p>
      <p>Pokemon: {data.gameMaster.pokemon.length}</p>
    </div>
  );
}
    `);

    console.log('🌐 Vanilla JavaScript Example:');
    console.log(`
// Simple fetch function
async function fetchPokemonData(type = 'all') {
  const response = await fetch(\`https://your-app.vercel.app/api/data?type=\${type}\`);
  if (!response.ok) throw new Error('Failed to fetch data');
  return response.json();
}

// Usage
fetchPokemonData('events')
  .then(events => console.log('Events:', events))
  .catch(error => console.error('Error:', error));

// Or with async/await
async function displayData() {
  try {
    const data = await fetchPokemonData('all');
    console.log('All data:', data);
  } catch (error) {
    console.error('Error:', error);
  }
}
    `);

    console.log('✅ Test completed successfully!');
    console.log('\n🚀 Next steps:');
    console.log('1. Deploy to Vercel: vercel --prod');
    console.log('2. Update the URLs in your frontend app');
    console.log('3. The cron job will run daily at 6 AM to update data');
    console.log('4. Use the API endpoints in your frontend applications');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
testSimpleFlow(); 