import { IEventValidator, IParsedEvent } from '../../../types/events';

export class EventValidator implements IEventValidator {
    public validateEvent(event: IParsedEvent): boolean {
        // Basic validation checks
        if (!this.hasRequiredFields(event)) {
            return false;
        }

        if (!this.hasValidDates(event)) {
            return false;
        }

        if (!this.hasValidContent(event)) {
            return false;
        }

        if (!this.isRelevant(event)) {
            return false;
        }

        return true;
    }

    private hasRequiredFields(event: IParsedEvent): boolean {
        return !!(
            event.id &&
            event.title &&
            event.startDate &&
            event.endDate &&
            event.source
        );
    }

    private hasValidDates(event: IParsedEvent): boolean {
        const now = new Date().getTime();
        const startDate = new Date(event.startDate);
        const endDate = new Date(event.endDate);

        // Event should have valid dates
        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            return false;
        }

        // End date should be after start date
        if (endDate <= startDate) {
            return false;
        }

        // Event should not be too far in the past (more than 30 days)
        const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);
        if (event.endDate < thirtyDaysAgo) {
            return false;
        }

        return true;
    }

    private hasValidContent(event: IParsedEvent): boolean {
        // Event should have some meaningful content
        const hasPokemon = (event.wild && event.wild.length > 0) || (event.raids && event.raids.length > 0) || (event.eggs && event.eggs.length > 0) || (event.research && event.research.length > 0) || (event.incenses && event.incenses.length > 0);
        const hasBonuses = event.bonuses && event.bonuses.length > 0;
        const hasCategories = event.categories && event.categories.length > 0;
        const hasContent = hasPokemon || hasBonuses || hasCategories;

        return hasContent;
    }

    private isRelevant(event: IParsedEvent): boolean {
        // Check if event is relevant based on various criteria
        const now = new Date().getTime();
        const isFuture = event.startDate > now;
        const isRecent = event.endDate > now - (7 * 24 * 60 * 60 * 1000); // Within last 7 days
        const hasContent = this.hasValidContent(event);

        return Boolean((isFuture || isRecent) && hasContent);
    }

    public validateEvents(events: IParsedEvent[]): IParsedEvent[] {
        return events.filter(event => this.validateEvent(event));
    }
} 