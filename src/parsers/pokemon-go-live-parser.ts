import * as cheerio from 'cheerio';
import { BaseParser } from './base-parser';
import { PokemonEvent, PokemonEventSchema } from '../types';

export class PokemonGoLiveParser extends BaseParser {
  protected async parseData(rawData: string): Promise<PokemonEvent[]> {
    const $ = cheerio.load(rawData);
    const events: PokemonEvent[] = [];

    // Parse news items from the Pokemon GO Live website
    $('.news-item, .event-item, article').each((index, element) => {
      const $element = $(element);
      
      const title = $element.find('h1, h2, h3, .title').first().text().trim();
      const description = $element.find('.description, .content, p').first().text().trim();
      const url = $element.find('a').first().attr('href');
      const imageUrl = $element.find('img').first().attr('src');
      
      if (title && description) {
        const event: PokemonEvent = {
          title,
          description,
          url: url ? new URL(url, 'https://pokemongolive.com').href : undefined,
          imageUrl: imageUrl ? new URL(imageUrl, 'https://pokemongolive.com').href : undefined,
          type: this.determineEventType(title, description),
          featured: $element.hasClass('featured') || $element.hasClass('highlight'),
        };

        events.push(event);
      }
    });

    return events;
  }

  protected validateData(data: any): boolean {
    if (!Array.isArray(data)) return false;
    
    return data.every(event => {
      try {
        PokemonEventSchema.parse(event);
        return true;
      } catch {
        return false;
      }
    });
  }

  private determineEventType(title: string, description: string): PokemonEvent['type'] {
    const text = `${title} ${description}`.toLowerCase();
    
    if (text.includes('community day') || text.includes('community-day')) {
      return 'community-day';
    }
    if (text.includes('raid day') || text.includes('raid-day')) {
      return 'raid-day';
    }
    if (text.includes('go fest') || text.includes('gofest')) {
      return 'go-fest';
    }
    if (text.includes('season') || text.includes('seasonal')) {
      return 'season';
    }
    
    return 'event';
  }
} 