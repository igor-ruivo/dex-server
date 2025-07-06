# Event Parser System

A modular, extensible system for parsing and aggregating Pokemon GO events from multiple sources.

## Architecture Overview

The event parser system follows SOLID principles with clear separation of concerns:

```
EventParser (Orchestrator)
├── Sources (IEventSource)
│   ├── PokemonGoSource
│   └── LeekDuckSource
├── Validators (IEventValidator)
│   └── EventValidator
├── Transformers (IEventTransformer)
│   └── EventTransformer
├── Aggregators (IEventAggregator)
│   └── EventAggregator
└── Utils
    ├── PokemonMatcher
    └── Normalization
```

## Components

### Sources (`src/parsers/events/sources/`)

Sources implement the `IEventSource` interface and are responsible for parsing HTML from specific websites.

#### PokemonGoSource
- Parses events from pokemongo.com news posts
- Implements the legacy `mapPosts` algorithm
- Handles complex HTML structure with nested containers
- Extracts Pokemon, bonuses, dates, and event metadata

#### LeekDuckSource
- Parses events from leekduck.com
- Handles different HTML structure than Pokemon GO
- Placeholder implementation ready for LeekDuck-specific logic

### Validators (`src/parsers/events/validators/`)

Validators ensure parsed events meet quality standards:

- **Required Fields**: ID, title, dates, source
- **Valid Dates**: Proper date ranges, not too old
- **Valid Content**: Must have Pokemon, bonuses, or categories
- **Relevance**: Future events or recent past events with content

### Transformers (`src/parsers/events/transformers/`)

Transformers normalize and enrich event data:

- **Title Normalization**: Clean and standardize titles
- **Description Generation**: Auto-generate descriptions from content
- **Deduplication**: Remove duplicate Pokemon and categories
- **Bonus Normalization**: Clean and standardize bonus text

### Aggregators (`src/parsers/events/aggregators/`)

Aggregators combine events from multiple sources:

- **Similarity Detection**: Title similarity, date overlap, Pokemon overlap
- **Event Merging**: Combine similar events from different sources
- **Content Merging**: Merge Pokemon, bonuses, categories
- **Best Event Selection**: Choose most complete event as base

### Utils (`src/parsers/events/utils/`)

#### PokemonMatcher
Complex Pokemon name matching algorithm that handles:
- Direct species ID matching
- Form detection and matching
- Special cases (Giratina, Zacian, etc.)
- Shadow/Mega detection
- Normalization and fuzzy matching

#### Normalization
Text processing utilities:
- Date parsing and normalization
- Pokemon name normalization
- Text cleaning and standardization

### Config (`src/parsers/events/config/`)

Constants and configuration:
- Known Pokemon forms
- Month mappings
- Whitelist/blacklist keywords
- Pokemon name overrides
- Raid level mappings

## Usage

### Basic Usage

```typescript
import { EventParser } from './src/parsers/events';

const parser = new EventParser();

// Parse from multiple sources
const events = await parser.parseEventsFromSources([
    { source: 'pokemongo', html: pokemonGoHtml },
    { source: 'leekduck', html: leekDuckHtml }
], gameMasterPokemon);

// Get statistics
const stats = parser.getEventStatistics(events);
```

### Individual Source Parsing

```typescript
// Parse only Pokemon GO events
const pokemonGoEvents = await parser.parseEventsFromPokemonGo(html, gameMasterPokemon);

// Parse only LeekDuck events
const leekDuckEvents = await parser.parseEventsFromLeekDuck(html, gameMasterPokemon);
```

### Adding Custom Sources

```typescript
import { IEventSource } from './src/types/events';

class CustomSource implements IEventSource {
    public name = 'custom';
    public baseUrl = 'https://example.com';
    
    public parseEvents(html: string, gameMasterPokemon: Record<string, any>): IParsedEvent[] {
        // Custom parsing logic
        return [];
    }
}

parser.addSource(new CustomSource());
```

## Event Data Structure

```typescript
interface IParsedEvent {
    id: string;
    title: string;
    subtitle?: string;
    description?: string;
    startDate: number;
    endDate: number;
    imageUrl?: string;
    sourceUrl?: string;
    source: 'pokemongo' | 'leekduck';
    categories: EventCategory[];
    pokemon: IPokemonEvent[];
    bonuses?: string[];
    isRelevant: boolean;
    metadata: Record<string, any>;
}
```

## Pokemon Matching Algorithm

The PokemonMatcher uses a sophisticated multi-step approach:

1. **Direct Matching**: Try exact species ID match
2. **Base Name Isolation**: Find base Pokemon name in text
3. **Form Detection**: Identify and match Pokemon forms
4. **Special Cases**: Handle edge cases (Giratina, Zacian, etc.)
5. **Fuzzy Matching**: Use normalized text comparison

### Known Forms
- Regional forms: Alolan, Galarian, Hisuian, Paldean
- Weather forms: Sunny, Rainy, Snowy
- Battle forms: Attack, Defense, Speed
- Special forms: Mega, Shadow, Origin, etc.

## Extending the System

### Adding New Sources

1. Create a new class implementing `IEventSource`
2. Implement the `parseEvents` method
3. Add the source to the EventParser constructor
4. Handle source-specific HTML structure

### Adding New Validators

1. Create a new class implementing `IEventValidator`
2. Implement custom validation logic
3. Add to the validation pipeline

### Adding New Transformers

1. Create a new class implementing `IEventTransformer`
2. Implement custom transformation logic
3. Add to the transformation pipeline

## Configuration

### Constants (`src/parsers/events/config/constants.ts`)

- `KNOWN_FORMS`: Set of recognized Pokemon forms
- `POKEMON_OVERRIDES`: Special case Pokemon name mappings
- `RAID_LEVEL_MAPPINGS`: Raid tier name mappings
- `WHITELIST_KEYWORDS`: Keywords that indicate valid Pokemon names
- `BLACKLISTED_KEYWORDS`: Keywords to filter out

### Customization

Modify constants to:
- Add new Pokemon forms
- Update Pokemon name overrides
- Adjust validation criteria
- Customize text processing

## Error Handling

The system includes comprehensive error handling:

- **Source Parsing Errors**: Logged but don't stop processing
- **Validation Errors**: Invalid events are filtered out
- **Transformation Errors**: Individual event failures don't stop pipeline
- **Aggregation Errors**: Similarity detection failures are logged

## Performance Considerations

- **Pokemon Matching**: Uses efficient lookup tables and caching
- **Event Aggregation**: O(n²) similarity detection, consider optimization for large datasets
- **Memory Usage**: Events are processed in batches to manage memory
- **Validation**: Early filtering reduces downstream processing

## Testing

The system is designed for easy testing:

- **Unit Tests**: Each component can be tested independently
- **Mock Sources**: Easy to create mock sources for testing
- **Validation Tests**: Comprehensive validation logic testing
- **Integration Tests**: End-to-end parsing pipeline testing

## Future Enhancements

- **Additional Sources**: Support for more event websites
- **Machine Learning**: Improved similarity detection
- **Real-time Updates**: WebSocket-based live event updates
- **Caching**: Redis-based event caching
- **API Endpoints**: REST API for event data access 