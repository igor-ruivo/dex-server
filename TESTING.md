# Pokemon GO Data Server - Testing Guide

## 🧪 How to Test the Complete Flow

### Prerequisites
- Node.js 18+ installed
- All dependencies installed (`npm install`)
- TypeScript compiled (`npm run build`)

### Quick Test

1. **Build the project:**
   ```bash
   npm run build
   ```

2. **Run the simple test:**
   ```bash
   node test-simple.js
   ```

This will:
- Start the Pokemon GO Data Server
- Run manual data aggregation
- Check generated files
- Show API usage examples
- Display frontend integration code

### Manual Testing Steps

1. **Start the server:**
   ```bash
   npm run dev
   ```

2. **Trigger manual aggregation:**
   ```bash
   curl -X POST http://localhost:3000/api/trigger
   ```

3. **Check status:**
   ```bash
   curl http://localhost:3000/api/status
   ```

4. **Get data:**
   ```bash
   curl http://localhost:3000/api/data?type=all
   ```

## 🌐 API Endpoints

### Data Endpoints

| Endpoint | Method | Description | Response |
|----------|--------|-------------|----------|
| `/api/data?type=all` | GET | Get all aggregated data | Full dataset |
| `/api/data?type=events` | GET | Get events only | Events array |
| `/api/data?type=raid-bosses` | GET | Get raid bosses | Raid bosses object |
| `/api/data?type=game-master` | GET | Get game master data | Game master object |
| `/api/data?type=metadata` | GET | Get metadata only | Metadata object |

### Control Endpoints

| Endpoint | Method | Description | Response |
|----------|--------|-------------|----------|
| `/api/status` | GET | Get server status | Status object |
| `/api/trigger` | POST | Trigger manual aggregation | Success/error |

## 📱 Frontend Integration Examples

### React Hook

```typescript
import { useState, useEffect } from 'react';

export function usePokemonData(type = 'all') {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await fetch(`https://your-app.vercel.app/api/data?type=${type}`);
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

// Usage
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
```

### Vanilla JavaScript

```javascript
// Simple fetch function
async function fetchPokemonData(type = 'all') {
  const response = await fetch(`https://your-app.vercel.app/api/data?type=${type}`);
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
```

### Vue.js

```javascript
import { ref, onMounted } from 'vue';

export function usePokemonData(type = 'all') {
  const data = ref(null);
  const loading = ref(true);
  const error = ref(null);

  const fetchData = async () => {
    try {
      loading.value = true;
      const response = await fetch(`https://your-app.vercel.app/api/data?type=${type}`);
      if (!response.ok) throw new Error('Failed to fetch data');
      data.value = await response.json();
    } catch (err) {
      error.value = err.message;
    } finally {
      loading.value = false;
    }
  };

  onMounted(fetchData);

  return { data, loading, error };
}
```

## 🚀 Deployment to Vercel

1. **Install Vercel CLI:**
   ```bash
   npm i -g vercel
   ```

2. **Deploy:**
   ```bash
   vercel --prod
   ```

3. **Update your frontend URLs:**
   Replace `https://your-app.vercel.app` with your actual Vercel URL.

## 📊 Data Structure

### All Data Response
```json
{
  "events": [
    {
      "title": "Community Day",
      "description": "Pokemon GO Community Day event",
      "type": "community-day",
      "featured": true
    }
  ],
  "raidBosses": {
    "current": [
      {
        "name": "Charizard",
        "tier": "5",
        "cp": { "min": 2200, "max": 2400 },
        "shiny": true
      }
    ],
    "upcoming": []
  },
  "gameMaster": {
    "pokemon": [
      {
        "dex": 1,
        "speciesId": "bulbasaur",
        "speciesName": "Bulbasaur",
        "types": ["grass", "poison"],
        "stats": { "atk": 118, "def": 111, "hp": 128 }
      }
    ],
    "lastUpdated": "2024-01-01T00:00:00.000Z"
  },
  "teamRocket": [],
  "metadata": {
    "lastFetch": "2024-01-01T00:00:00.000Z",
    "version": "1.0.0",
    "sources": ["Pokemon GO Live News", "Leek Duck Raid Bosses"]
  }
}
```

## ⏰ Cron Job Schedule

The server runs data aggregation daily at 6 AM UTC. You can modify this in `src/config/index.ts`:

```typescript
export const config: AppConfig = {
  cronSchedule: '0 6 * * *', // Daily at 6 AM
  // ...
};
```

## 🔧 Troubleshooting

### Common Issues

1. **No data files generated:**
   - Check if data sources are accessible
   - Verify parsers are working correctly
   - Check logs for errors

2. **API returns 404:**
   - Ensure Vercel deployment is complete
   - Check API route configuration
   - Verify file paths are correct

3. **CORS errors:**
   - The API includes CORS headers for common domains
   - Add your domain to `allowedOrigins` in `api/data.ts`

### Debug Mode

Enable debug logging by setting the environment variable:
```bash
LOG_LEVEL=debug npm run dev
```

## 📈 Monitoring

- **Status endpoint:** Check server health and file info
- **Trigger endpoint:** Manually run data aggregation
- **Logs:** Monitor aggregation process and errors
- **File timestamps:** Track when data was last updated

## 🎯 Next Steps

1. Deploy to Vercel
2. Test API endpoints with your frontend
3. Monitor data quality and update frequency
4. Add more data sources as needed
5. Implement caching strategies for better performance 