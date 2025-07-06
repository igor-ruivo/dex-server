# Pokémon GO Data Aggregation Server

A robust, scalable data aggregation system that fetches, processes, and serves Pokémon GO data from multiple sources daily. Built with TypeScript, following SOLID principles and modern engineering practices with **minimal dependencies**.

## 🏗️ Architecture Overview

The system follows a clean, modular architecture with clear separation of concerns:

```
src/
├── types/           # Type definitions and native validation
├── config/          # Configuration management
├── utils/           # Shared utilities (native logging)
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
- **Intelligent Parsing**: Custom parsers for each data source with native validation
- **Scheduled Updates**: Daily GitHub Actions-based data refresh
- **Fault Tolerance**: Retry logic, error handling, and fallback mechanisms
- **API Endpoints**: RESTful endpoints for data consumption
- **Comprehensive Logging**: Structured logging with native console
- **Type Safety**: Full TypeScript implementation with native validation
- **Minimal Dependencies**: Uses native Node.js APIs wherever possible

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
  outputDir: './public/data',
  maxRetries: 3,
  timeout: 30000,
  sources: [/* ... */]
};
```

## ⏰ Scheduled Updates

Daily data updates are handled by GitHub Actions:

1. **Schedule**: Daily at 6 AM UTC
2. **Trigger**: Calls `/api/trigger` endpoint
3. **Verification**: Checks data files after update
4. **Manual Trigger**: Available via GitHub Actions UI

To set up:
1. Update the Vercel URL in `.github/workflows/daily-update.yml`
2. Push to GitHub to enable the workflow
3. Monitor via GitHub Actions tab

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

1. **GitHub Actions** triggers daily aggregation at 6 AM UTC
2. **Data Aggregator** fetches from all enabled sources using native fetch API
3. **Parsers** process raw data into structured format using native DOMParser
4. **File Manager** writes processed data to JSON files using native fs/promises
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

- **Logs**: Structured logging to console with JSON format
- **Status API**: Real-time system health checks
- **File Monitoring**: Track data file sizes and timestamps
- **Error Handling**: Comprehensive error tracking and reporting

## 🔒 Security

- **CORS**: Configured for specific origins
- **Input Validation**: Native validation functions for all data
- **Error Sanitization**: No sensitive data in error responses
- **Rate Limiting**: Built into Vercel's infrastructure

## 🎯 Native Solutions Used

Instead of heavy dependencies, the system uses:

- **fetch API** instead of axios
- **DOMParser** instead of cheerio
- **fs/promises** instead of fs-extra
- **Native console** instead of winston
- **Custom validation** instead of zod

This results in:
- ✅ **Smaller bundle size**
- ✅ **Faster startup times**
- ✅ **Fewer security vulnerabilities**
- ✅ **Better maintainability**
- ✅ **No external dependencies for core functionality**

## 🤝 Contributing

1. Follow TypeScript best practices
2. Add tests for new features
3. Update documentation
4. Use conventional commit messages

## 📄 License

ISC License - see package.json for details

---

**Built with ❤️ for the Pokémon GO community using minimal, native dependencies**
