# Pokémon GO Data Generator

## Motivation

This project provides a robust, extensible, and maintainable pipeline for scraping, normalizing, and aggregating Pokémon GO data (Pokémon, events, forms, etc.) for use in frontend applications and analytics. The goal is to deliver high-quality, up-to-date, and multi-language data.

## Key Features
- **Multi-provider event scraping** (e.g., official Pokémon GO, LeekDuck, etc.)
- **Multi-language support** (currently EN and PT/BR, easily extensible)
- **Unified normalization and matching utilities** for Pokémon names, forms, and event parsing
- **Extensible architecture**: add new event providers, languages, or normalization logic with minimal effort

## Architecture Overview

```
/parsers
  /events
    /providers
      /pokemongo
        PokemongoSource.ts
        PokemongoFetcher.ts
        /html-parsers
    /utils
      normalization.ts
      pokemon-matcher.ts
    /config
  /pokemon
    /utils
      pokemon-transformer.ts
      image-url-builder.ts
      pokemon-validator.ts
    /config
  /utils
    normalization.ts   # Shared normalization logic
  /services
    data-fetcher.ts
/types
  events.ts
  pokemon.ts
/data (root)
  aggregated-data.json
  events.json
  game-master.json
  metadata.json
  raid-bosses.json
```

## Extending the Pipeline

### Adding a New Event Provider
1. Implement the `IEventSource` interface in `/parsers/events/providers/yourprovider/YourProviderSource.ts`.
2. Add your provider to the providers array in `generate-events.ts`.
3. Use the shared normalization utilities for all name and form matching.

### Adding a New Language
1. Add the language code to the languages array in `generate-events.ts`.
2. Ensure your provider supports that language in its parsing logic.

### Improving Normalization or Matching
- Update or add to `/parsers/utils/normalization.ts` for any new normalization rules.
- All event and Pokémon pipelines will automatically use the improved logic.

## License
MIT
