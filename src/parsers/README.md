# Pokemon Game Master Parser

A refactored, well-structured parser for Pokemon GO Game Master data following SOLID and DRY principles.

## Architecture Overview

The parser has been refactored to separate concerns and improve maintainability:

### Directory Structure

```
src/parsers/
├── config/
│   └── pokemon-config.ts          # Configuration constants and mappings
├── data/
│   └── synthetic-pokemon.ts       # Synthetic Pokemon data
├── services/
│   └── data-fetcher.ts           # Data fetching abstraction
├── utils/
│   ├── pokemon-validator.ts      # Pokemon validation logic
│   ├── pokemon-transformer.ts    # Pokemon transformation logic
│   └── image-url-builder.ts      # Image URL building logic
├── factories/
│   └── parser-factory.ts         # Factory for creating parsers
├── game-master-parser.ts         # Main parser (refactored)
└── index.ts                      # Public exports
```

## Key Design Principles

### 1. Single Responsibility Principle (SRP)
Each class has a single, well-defined responsibility:
- `PokemonValidator`: Handles validation logic
- `PokemonTransformer`: Handles data transformation
- `ImageUrlBuilder`: Handles image URL generation
- `DataFetcher`: Handles data fetching

### 2. Open/Closed Principle (OCP)
The system is open for extension but closed for modification:
- New validation rules can be added to `PokemonValidator`
- New transformation logic can be added to `PokemonTransformer`
- New image URL patterns can be added to `ImageUrlBuilder`

### 3. Dependency Inversion Principle (DIP)
High-level modules don't depend on low-level modules:
- `GameMasterParser` depends on `DataFetcher` interface
- Easy to mock for testing or swap implementations

### 4. DRY (Don't Repeat Yourself)
- Common types are centralized in `src/types/pokemon.ts`
- Configuration is centralized in `pokemon-config.ts`
- Utility functions are shared across components

## Usage

### Basic Usage
```typescript
import { GameMasterParser } from './parsers';

const parser = new GameMasterParser();
const gameMasterData = await parser.parse();
```

### With Custom Data Fetcher
```typescript
import { GameMasterParser } from './parsers';
import { HttpDataFetcher } from './parsers/services/data-fetcher';

const customFetcher = new HttpDataFetcher();
const parser = new GameMasterParser(customFetcher);
const gameMasterData = await parser.parse();
```

### Using Factory
```typescript
import { ParserFactory } from './parsers';

const parser = ParserFactory.createGameMasterParser();
const gameMasterData = await parser.parse();
```

## Key Components

### Configuration (`pokemon-config.ts`)
Centralizes all configuration including:
- Source URLs
- Blacklisted species
- Released overrides
- Image mappings
- Hidden power moves

### Data Fetching (`data-fetcher.ts`)
Abstracts data fetching with interface:
```typescript
interface DataFetcher {
  fetch<T>(url: string): Promise<T>;
}
```

### Validation (`pokemon-validator.ts`)
Static methods for Pokemon validation:
- `isValidPokemon()`: Checks if Pokemon should be included
- `isShadowPokemon()`: Identifies shadow Pokemon
- `isMegaPokemon()`: Identifies mega Pokemon
- `hasTag()`: Checks for specific tags

### Transformation (`pokemon-transformer.ts`)
Handles data transformation:
- `transformTypes()`: Converts string types to enum
- `cleanMoves()`: Consolidates hidden power moves
- `getForm()`: Extracts Pokemon forms
- `getGoForm()`: Maps to GO-specific forms

### Image URL Building (`image-url-builder.ts`)
Handles image URL generation:
- `buildImageUrl()`: Standard Pokemon images
- `buildGoImageUrlForPokemon()`: GO-specific images
- `buildShinyGoImageUrlForPokemon()`: Shiny GO images

## Benefits of Refactoring

1. **Testability**: Each component can be unit tested in isolation
2. **Maintainability**: Changes are localized to specific components
3. **Extensibility**: New features can be added without modifying existing code
4. **Reusability**: Components can be reused across different parsers
5. **Readability**: Clear separation of concerns makes code easier to understand

## Migration Complete

The parser has been successfully refactored and the original monolithic version has been replaced with the new well-structured implementation.

## Future Enhancements

- Add unit tests for each component
- Implement caching for data fetching
- Add support for different data sources
- Create additional parser types (moves, items, etc.)
- Add validation schemas for data integrity 