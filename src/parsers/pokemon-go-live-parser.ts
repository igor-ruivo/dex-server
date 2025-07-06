import { BaseParser } from './base-parser';
import { PokemonEvent, validatePokemonEvent } from '../types';

// Simple HTML parser using native DOMParser
class SimpleHTMLParser {
  private doc: Document;

  constructor(html: string) {
    const parser = new DOMParser();
    this.doc = parser.parseFromString(html, 'text/html');
  }

  find(selector: string): SimpleHTMLElement[] {
    const elements = this.doc.querySelectorAll(selector);
    return Array.from(elements).map(el => new SimpleHTMLElement(el));
  }

  findOne(selector: string): SimpleHTMLElement | null {
    const element = this.doc.querySelector(selector);
    return element ? new SimpleHTMLElement(element) : null;
  }
}

class SimpleHTMLElement {
  private element: Element;

  constructor(element: Element) {
    this.element = element;
  }

  text(): string {
    return this.element.textContent?.trim() || '';
  }

  attr(name: string): string | null {
    return this.element.getAttribute(name);
  }

  find(selector: string): SimpleHTMLElement[] {
    const elements = this.element.querySelectorAll(selector);
    return Array.from(elements).map(el => new SimpleHTMLElement(el));
  }

  findOne(selector: string): SimpleHTMLElement | null {
    const element = this.element.querySelector(selector);
    return element ? new SimpleHTMLElement(element) : null;
  }

  hasClass(className: string): boolean {
    return this.element.classList.contains(className);
  }
}

export class PokemonGoLiveParser extends BaseParser {
  protected async parseData(rawData: unknown): Promise<PokemonEvent[]> {
    if (typeof rawData !== 'string') {
      throw new Error('Expected string data for HTML parsing');
    }

    const $ = new SimpleHTMLParser(rawData);
    const events: PokemonEvent[] = [];

    // Parse news items from the Pokemon GO Live website
    const newsItems = $.find('.news-item, .event-item, article');
    
    for (const element of newsItems) {
      const title = element.findOne('h1, h2, h3, .title')?.text() || '';
      const description = element.findOne('.description, .content, p')?.text() || '';
      const url = element.findOne('a')?.attr('href') || '';
      const imageUrl = element.findOne('img')?.attr('src') || '';
      
      if (title && description) {
        const event: PokemonEvent = {
          title,
          description,
          url: url ? new URL(url, 'https://pokemongolive.com').href : undefined,
          imageUrl: imageUrl ? new URL(imageUrl, 'https://pokemongolive.com').href : undefined,
          type: this.determineEventType(title, description),
          featured: element.hasClass('featured') || element.hasClass('highlight'),
        };

        events.push(event);
      }
    }

    return events;
  }

  protected validateData(data: unknown): boolean {
    if (!Array.isArray(data)) return false;
    
    return data.every(event => {
      try {
        validatePokemonEvent(event);
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