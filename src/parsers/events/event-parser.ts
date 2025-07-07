import { IParsedEvent, IEventSource } from '../../types/events';
import { PokemonGoSource } from './sources/pokemongo-source';
import { LeekDuckSource } from './sources/leekduck-source';
import { EventValidator } from './validators/event-validator';
import { EventTransformer } from './transformers/event-transformer';
import { EventAggregator } from './aggregators/event-aggregator';

export class EventParser {
    private sources: IEventSource[];
    private validator: EventValidator;
    private transformer: EventTransformer;
    private aggregator: EventAggregator;

    constructor() {
        this.sources = [
            new PokemonGoSource(),
            new LeekDuckSource()
        ];
        this.validator = new EventValidator();
        this.transformer = new EventTransformer();
        this.aggregator = new EventAggregator();
    }

    public async parseEventsFromSources(
        sourceData: Array<{ source: string; html: string }>,
        gameMasterPokemon: Record<string, any>
    ): Promise<IParsedEvent[]> {
        console.log('Starting event parsing from multiple sources...');
        
        const allEvents: IParsedEvent[] = [];

        // Parse events from each source
        for (const { source, html } of sourceData) {
            try {
                const sourceParser = this.sources.find(s => s.name === source);
                if (!sourceParser) {
                    console.warn(`No parser found for source: ${source}`);
                    continue;
                }

                console.log(`Parsing events from ${source}...`);
                const events = await sourceParser.parseEvents(html, gameMasterPokemon);
                console.log(`Found ${events.length} events from ${source}`);
                
                allEvents.push(...events);
            } catch (error) {
                console.error(`Error parsing events from ${source}:`, error);
            }
        }

        console.log(`Total events found: ${allEvents.length}`);

        // Validate events
        console.log('Validating events...');
        const validEvents = this.validator.validateEvents(allEvents);
        console.log(`Valid events: ${validEvents.length}`);

        // Transform events
        console.log('Transforming events...');
        const transformedEvents = this.transformer.transformEvents(validEvents);

        // Aggregate events
        console.log('Aggregating events...');
        const aggregatedEvents = this.aggregator.aggregateEvents(transformedEvents);
        console.log(`Final aggregated events: ${aggregatedEvents.length}`);

        return aggregatedEvents;
    }

    public async parseEventsFromPokemonGo(
        html: string,
        gameMasterPokemon: Record<string, any>
    ): Promise<IParsedEvent[]> {
        const pokemonGoSource = this.sources.find(s => s.name === 'pokemongo');
        if (!pokemonGoSource) {
            throw new Error('PokemonGoSource not found');
        }

        const events = await pokemonGoSource.parseEvents(html, gameMasterPokemon);
        const validEvents = this.validator.validateEvents(events);
        const transformedEvents = this.transformer.transformEvents(validEvents);

        return transformedEvents;
    }

    public async parseEventsFromLeekDuck(
        html: string,
        gameMasterPokemon: Record<string, any>
    ): Promise<IParsedEvent[]> {
        const leekDuckSource = this.sources.find(s => s.name === 'leekduck');
        if (!leekDuckSource) {
            throw new Error('LeekDuckSource not found');
        }

        const events = await leekDuckSource.parseEvents(html, gameMasterPokemon);
        const validEvents = this.validator.validateEvents(events);
        const transformedEvents = this.transformer.transformEvents(validEvents);

        return transformedEvents;
    }

    public getAvailableSources(): string[] {
        return this.sources.map(source => source.name);
    }

    public addSource(source: IEventSource): void {
        this.sources.push(source);
    }

    public getEventStatistics(events: IParsedEvent[]): Record<string, any> {
        const stats = {
            total: events.length,
            bySource: {} as Record<string, number>,
            byCategory: {} as Record<string, number>,
            byDateRange: {
                past: 0,
                current: 0,
                future: 0
            },
            pokemonCount: 0,
            uniquePokemon: new Set<string>()
        };

        const now = new Date().getTime();

        for (const event of events) {
            // Count by source
            stats.bySource[event.source] = (stats.bySource[event.source] || 0) + 1;

            // Count by category
            for (const category of event.categories) {
                stats.byCategory[category] = (stats.byCategory[category] || 0) + 1;
            }

            // Count by date range
            if (event.endDate < now) {
                stats.byDateRange.past++;
            } else if (event.startDate <= now && event.endDate >= now) {
                stats.byDateRange.current++;
            } else {
                stats.byDateRange.future++;
            }

            // Count Pokemon
            const allPokemon = [
                ...(event.wild || []),
                ...(event.raids || []),
                ...(event.eggs || []),
                ...(event.research || []),
                ...(event.incenses || [])
            ];
            stats.pokemonCount += allPokemon.length;
            allPokemon.forEach(p => stats.uniquePokemon.add(p.speciesId));
        }

        return {
            ...stats,
            uniquePokemonCount: stats.uniquePokemon.size
        };
    }
} 