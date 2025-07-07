import { IEventAggregator, IParsedEvent, EventCategory } from '../../../types/events';

export class EventAggregator implements IEventAggregator {
    public aggregateEvents(events: IParsedEvent[]): IParsedEvent[] {
        // Group events by similarity
        const groupedEvents = this.groupSimilarEvents(events);
        
        // Merge similar events
        const mergedEvents = groupedEvents.map(group => this.mergeEventGroup(group));
        
        // Sort by start date
        return mergedEvents.sort((a, b) => a.startDate - b.startDate);
    }

    private groupSimilarEvents(events: IParsedEvent[]): IParsedEvent[][] {
        const groups: IParsedEvent[][] = [];
        const processed = new Set<string>();

        for (const event of events) {
            if (processed.has(event.id)) {
                continue;
            }

            const similarEvents = this.findSimilarEvents(event, events);
            if (similarEvents.length > 0) {
                groups.push(similarEvents);
                similarEvents.forEach(e => processed.add(e.id));
            }
        }

        return groups;
    }

    private findSimilarEvents(targetEvent: IParsedEvent, allEvents: IParsedEvent[]): IParsedEvent[] {
        const similar: IParsedEvent[] = [targetEvent];

        for (const event of allEvents) {
            if (event.id === targetEvent.id) {
                continue;
            }

            if (this.areEventsSimilar(targetEvent, event)) {
                similar.push(event);
            }
        }

        return similar;
    }

    private areEventsSimilar(event1: IParsedEvent, event2: IParsedEvent): boolean {
        // Check if events are similar based on multiple criteria
        const titleSimilarity = this.calculateTitleSimilarity(event1.title, event2.title);
        const dateOverlap = this.hasDateOverlap(event1, event2);
        const pokemonOverlap = this.hasPokemonOverlap(event1, event2);

        return titleSimilarity > 0.7 || (dateOverlap && pokemonOverlap);
    }

    private calculateTitleSimilarity(title1: string, title2: string): number {
        const words1 = title1.toLowerCase().split(/\s+/);
        const words2 = title2.toLowerCase().split(/\s+/);
        
        const commonWords = words1.filter(word => words2.includes(word));
        const totalWords = Math.max(words1.length, words2.length);
        
        return totalWords > 0 ? commonWords.length / totalWords : 0;
    }

    private hasDateOverlap(event1: IParsedEvent, event2: IParsedEvent): boolean {
        const start1 = event1.startDate;
        const end1 = event1.endDate;
        const start2 = event2.startDate;
        const end2 = event2.endDate;

        // Check if date ranges overlap
        return start1 <= end2 && start2 <= end1;
    }

    private hasPokemonOverlap(event1: IParsedEvent, event2: IParsedEvent): boolean {
        const allPokemon1 = [
            ...(event1.wild || []),
            ...(event1.raids || []),
            ...(event1.eggs || []),
            ...(event1.research || []),
            ...(event1.incenses || [])
        ];
        const allPokemon2 = [
            ...(event2.wild || []),
            ...(event2.raids || []),
            ...(event2.eggs || []),
            ...(event2.research || []),
            ...(event2.incenses || [])
        ];
        
        const pokemon1 = new Set(allPokemon1.map(p => p.speciesId));
        const pokemon2 = new Set(allPokemon2.map(p => p.speciesId));
        
        const intersection = new Set([...pokemon1].filter(x => pokemon2.has(x)));
        const union = new Set([...pokemon1, ...pokemon2]);
        
        return union.size > 0 && intersection.size / union.size > 0.3; // 30% overlap
    }

    private mergeEventGroup(events: IParsedEvent[]): IParsedEvent {
        if (events.length === 1) {
            return events[0];
        }

        // Use the most complete event as base
        const baseEvent = this.selectBestEvent(events);
        // const otherEvents = events.filter(e => e.id !== baseEvent.id);

        return {
            ...baseEvent,
            title: this.mergeTitles(events.map(e => e.title)),
            subtitle: this.mergeSubtitles(events.map(e => e.subtitle).filter((s): s is string => Boolean(s))),
            startDate: Math.min(...events.map(e => e.startDate)),
            endDate: Math.max(...events.map(e => e.endDate)),
            bonuses: this.mergeBonuses(events.map(e => e.bonuses).filter((b): b is string[] => Boolean(b))),
            categories: this.mergeCategories(events.map(e => e.categories)),
            metadata: {
                ...baseEvent.metadata,
                mergedFrom: events.map(e => e.id),
                sources: events.map(e => e.source)
            }
        };
    }

    private selectBestEvent(events: IParsedEvent[]): IParsedEvent {
        // Select the event with the most complete information
        return events.reduce((best, current) => {
            const bestScore = this.calculateCompletenessScore(best);
            const currentScore = this.calculateCompletenessScore(current);
            return currentScore > bestScore ? current : best;
        });
    }

    private calculateCompletenessScore(event: IParsedEvent): number {
        let score = 0;
        
        if (event.title) score += 1;
        if (event.subtitle) score += 1;
        if (event.description) score += 1;
        if (event.imageUrl) score += 1;
        const allPokemon = [
            ...(event.wild || []),
            ...(event.raids || []),
            ...(event.eggs || []),
            ...(event.research || []),
            ...(event.incenses || [])
        ];
        if (allPokemon.length > 0) score += allPokemon.length;
        if (event.bonuses && event.bonuses.length > 0) score += event.bonuses.length;
        if (event.categories.length > 0) score += event.categories.length;

        return score;
    }

    private mergeTitles(titles: string[]): string {
        // Use the longest title as it's likely the most descriptive
        return titles.reduce((longest, current) => 
            current.length > longest.length ? current : longest
        );
    }

    private mergeSubtitles(subtitles: string[]): string | undefined {
        if (subtitles.length === 0) return undefined;
        if (subtitles.length === 1) return subtitles[0];

        // Combine unique subtitles
        const uniqueSubtitles = [...new Set(subtitles)];
        return uniqueSubtitles.join(' / ');
    }

    private mergeBonuses(allBonuses: string[][]): string[] | undefined {
        const allBonusTexts = allBonuses.flat();
        if (allBonusTexts.length === 0) return undefined;

        // Remove duplicates and combine
        const uniqueBonuses = [...new Set(allBonusTexts)];
        return uniqueBonuses;
    }

    private mergeCategories(allCategories: EventCategory[][]): EventCategory[] {
        const allCats = allCategories.flat();
        return [...new Set(allCats)] as EventCategory[];
    }
} 