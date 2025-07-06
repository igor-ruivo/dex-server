# Pokémon GO Data Aggregation Server

A robust, scalable data aggregation system that fetches, processes, and serves Pokémon GO data from multiple sources daily. Built with TypeScript, following SOLID principles and modern engineering practices.

## 🏗️ Architecture Overview

The system follows a clean, modular architecture with clear separation of concerns:

```
src/
├── types/           # Type definitions and Zod schemas
├── config/          # Configuration management
├── utils/           # Shared utilities (logging, etc.)
├── parsers/         # Data parsing strategies
├── services/        # Core business logic
└── index.ts         # Application entry point

api/                 # Vercel serverless functions
├── proxy.ts         # Legacy proxy endpoint
├── data.ts          # Data serving endpoint
├── trigger.ts       # Manual aggregation trigger
└── status.ts        # System status endpoint
```

## 🚀 Features

- **Multi-Source Data Aggregation**: Fetches data from Pokémon GO Live, Leek Duck, PokeMiners, and PvPoke
- **Intelligent Parsing**: Custom parsers for each data source with validation
- **Scheduled Updates**: Daily cron-based data refresh
- **Fault Tolerance**: Retry logic, error handling, and fallback mechanisms
- **API Endpoints**: RESTful endpoints for data consumption
- **Comprehensive Logging**: Structured logging with Winston
- **Type Safety**: Full TypeScript implementation with Zod validation

## 📊 Data Sources

| Source | Type | URL | Parser |
|--------|------|-----|--------|
| Pokémon GO Live | Events | https://pokemongolive.com/news/ | `pokemonGoLiveParser` |
| Leek Duck | Raid Bosses | https://leekduck.com/boss/ | `leekDuckRaidParser` |
| PokeMiners | Game Master | https://raw.githubusercontent.com/PokeMiners/game_masters/master/latest/latest.json | `pokeMinersGameMasterParser` |
| PvPoke | Pokémon Data | https://raw.githubusercontent.com/pvpoke/pvpoke/master/src/data/gamemaster/pokemon.json | `pvpokePokemonParser` |

## 🛠️ Installation & Setup

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Build the Project**:
   ```bash
   npm run build
   ```

3. **Start Development Server**:
   ```bash
   npm run dev
   ```

## 📡 API Endpoints

### Data Endpoints

- `GET /api/data` - Get all aggregated data
- `GET /api/data?type=events` - Get events only
- `GET /api/data?type=raid-bosses` - Get raid bosses only
- `GET /api/data?type=game-master` - Get game master data only
- `GET /api/data?type=team-rocket` - Get team rocket data only
- `GET /api/data?type=metadata` - Get metadata only

### Management Endpoints

- `POST /api/trigger` - Manually trigger data aggregation
- `GET /api/status` - Get system status and health
- `GET /api/proxy` - Legacy proxy endpoint

## 🔧 Configuration

The system is configured via `src/config/index.ts`:

```typescript
export const config: AppConfig = {
  cronSchedule: '0 6 * * *', // Daily at 6 AM UTC
  outputDir: './public/data',
  maxRetries: 3,
  timeout: 30000,
  sources: [/* ... */]
};
```

## 📁 Output Structure

Generated data files in `public/data/`:

```
public/data/
├── aggregated-data.json    # Complete dataset
├── events.json            # Events only
├── raid-bosses.json       # Raid bosses only
├── team-rocket.json       # Team rocket data
├── game-master.json       # Game master data
└── metadata.json          # System metadata
```

## 🔄 Data Flow

1. **Scheduler** triggers daily aggregation at 6 AM UTC
2. **Data Aggregator** fetches from all enabled sources
3. **Parsers** process raw data into structured format
4. **File Manager** writes processed data to JSON files
5. **API Endpoints** serve data to frontend applications

## 🧪 Testing

```bash
# Run tests
npm test

# Run linting
npm run lint

# Format code
npm run format
```

## 🚀 Deployment

The system is designed for Vercel deployment:

1. **Environment Variables**: Set `LOG_LEVEL` if needed
2. **Build Command**: `npm run build`
3. **Output Directory**: `dist/`
4. **Functions**: All API endpoints in `api/` directory

## 📈 Monitoring

- **Logs**: Structured logging to console and files
- **Status API**: Real-time system health checks
- **File Monitoring**: Track data file sizes and timestamps
- **Error Handling**: Comprehensive error tracking and reporting

## 🔒 Security

- **CORS**: Configured for specific origins
- **Input Validation**: Zod schemas for all data
- **Error Sanitization**: No sensitive data in error responses
- **Rate Limiting**: Built into Vercel's infrastructure

## 🤝 Contributing

1. Follow TypeScript best practices
2. Add tests for new features
3. Update documentation
4. Use conventional commit messages

## 📄 License

ISC License - see package.json for details

---

**Built with ❤️ for the Pokémon GO community**
