import { IEventTransformer, IParsedEvent } from '../../../types/events';

export class EventTransformer implements IEventTransformer {
    public transformEvent(event: IParsedEvent): IParsedEvent {
        return {
            ...event,
            title: this.normalizeTitle(event.title),
            subtitle: event.subtitle ? this.normalizeTitle(event.subtitle) : undefined,
            description: this.generateDescription(event),
            bonuses: this.normalizeBonuses(event.bonuses)
        };
    }

    public transformEvents(events: IParsedEvent[]): IParsedEvent[] {
        return events.map(event => this.transformEvent(event));
    }

    private normalizeTitle(title: string): string {
        return title
            .trim()
            .replace(/\s+/g, ' ') // Replace multiple spaces with single space
            .replace(/[^\w\s\-()]/g, '') // Remove special characters except hyphens and parentheses
            .substring(0, 200); // Limit length
    }

    private generateDescription(event: IParsedEvent): string {
        const parts: string[] = [];

        if (event.subtitle) {
            parts.push(event.subtitle);
        }

        if (event.bonuses && event.bonuses.length > 0) {
            parts.push(`Includes ${event.bonuses.length} bonus(es)`);
        }

        return parts.join('. ');
    }

    private normalizeBonuses(bonuses?: string[]): string[] | undefined {
        if (!bonuses || bonuses.length === 0) {
            return undefined;
        }

        return bonuses
            .map(bonus => bonus.trim())
            .filter(bonus => bonus.length > 0)
            .map(bonus => this.normalizeBonusText(bonus));
    }

    private normalizeBonusText(bonus: string): string {
        return bonus
            .replace(/\s+/g, ' ') // Replace multiple spaces with single space
            .replace(/\n+/g, ' ') // Replace newlines with spaces
            .trim()
            .substring(0, 500); // Limit length
    }
} 