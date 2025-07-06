# Pokemon GO Data Generator

A simple data generator that creates Pokemon GO JSON files daily via GitHub Actions.

## How It Works

1. **GitHub Actions** runs daily at 6 AM UTC
2. **TypeScript script** generates dummy Pokemon GO data with current timestamps
3. **JSON files** are committed to the repository by the workflow
4. **Clients** fetch data directly from GitHub

## Files Generated

```
data/
├── aggregated-data.json    # Complete dataset
├── events.json            # Events only
├── raid-bosses.json       # Raid bosses only
├── game-master.json       # Game master data
└── metadata.json          # System metadata
```

## Local Testing

```bash
# Install dependencies
npm install

# Generate data locally
npm run generate
```

## Client Access

Fetch JSON files directly from GitHub:

```javascript
// Raw GitHub URLs
fetch('https://raw.githubusercontent.com/your-username/your-repo/main/data/aggregated-data.json')

// Or via GitHub Pages (if enabled)
fetch('https://your-username.github.io/your-repo/data/aggregated-data.json')
```

## GitHub Actions

The workflow runs:
- **Daily at 6 AM UTC** (automatically)
- **Manually** via GitHub Actions UI
- **On every push** (for testing)

## Data Structure

Each JSON file contains:
- **Current timestamp** in ISO format
- **Dummy Pokemon GO data** (events, raid bosses, game master)
- **Metadata** with version and sources

## Benefits

- ✅ **Zero hosting costs** (GitHub only)
- ✅ **Always fresh data** (daily updates)
- ✅ **Version controlled** (full history)
- ✅ **Simple and reliable** (minimal dependencies)
- ✅ **Direct file access** (no API needed)

## Setup

1. **Fork this repository**
2. **Enable GitHub Actions** in your fork
3. **Push to trigger** the first data generation
4. **Monitor** the Actions tab for updates

## Architecture

- **Local development**: Files generated in `data/` directory
- **GitHub Actions**: Runs script, commits files to repo
- **Client access**: Direct GitHub raw URLs
- **No hosting needed**: GitHub serves files directly

That's it! Your Pokemon GO data will be updated daily and available via GitHub.
