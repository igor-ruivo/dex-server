import { IParsedEvent, IEventSource } from '../../types/events';
import { PokemonGoSource } from './sources/pokemongo-source';
import { EventValidator } from './validators/event-validator';
import { EventTransformer } from './transformers/event-transformer';
import { GameMasterPokemon } from '../../types/pokemon';

export class EventParser {
    private sources: IEventSource[];
    private validator: EventValidator;
    private transformer: EventTransformer;

    constructor() {
        this.sources = [
            new PokemonGoSource()
        ];
        this.validator = new EventValidator();
        this.transformer = new EventTransformer();
    }

    public async parseEventsFromPokemonGo(
        gameMasterPokemon: Record<string, GameMasterPokemon>
    ): Promise<IParsedEvent[]> {
        const pokemonGoSource = this.sources.find(s => s.name === 'pokemongo');
        if (!pokemonGoSource) {
            throw new Error('PokemonGoSource not found');
        }

        const events = await pokemonGoSource.parseEvents(gameMasterPokemon);
        const validEvents = this.validator.validateEvents(events);
        const transformedEvents = this.transformer.transformEvents(validEvents);

        return transformedEvents;
    }

    public async parseEventsFromLeekDuck(
        html: string,
        gameMasterPokemon: Record<string, GameMasterPokemon>
    ): Promise<IParsedEvent[]> {
        const leekDuckSource = this.sources.find(s => s.name === 'leekduck');
        if (!leekDuckSource) {
            throw new Error('LeekDuckSource not found');
        }

        const events = await leekDuckSource.parseEvents(gameMasterPokemon);
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

    public getEventStatistics(events: IParsedEvent[]): Record<string, unknown> {
        const stats = {
            total: events.length,
            bySource: {} as Record<string, number>,
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