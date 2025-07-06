import { BaseParser } from './base-parser';
import { RaidBoss, validateRaidBoss } from '../types';

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

export class LeekDuckRaidParser extends BaseParser {
  protected async parseData(rawData: unknown): Promise<RaidBoss[]> {
    if (typeof rawData !== 'string') {
      throw new Error('Expected string data for HTML parsing');
    }

    const $ = new SimpleHTMLParser(rawData);
    const raidBosses: RaidBoss[] = [];

    // Parse raid bosses from Leek Duck website
    const bossItems = $.find('.raid-boss, .boss-item, [data-tier]');
    
    for (const element of bossItems) {
      const name = element.findOne('.pokemon-name, .name, h3, h4')?.text() || '';
      const tierText = element.findOne('.tier, [data-tier]')?.text() || 
                      element.attr('data-tier') || 
                      this.extractTierFromElement(element);
      const cpText = element.findOne('.cp, .cp-range')?.text() || '';
      const shiny = element.findOne('.shiny, [data-shiny]') !== null || 
                   element.text().toLowerCase().includes('shiny');
      
      if (name && tierText) {
        const tier = this.normalizeTier(tierText);
        const cp = this.parseCPRange(cpText);
        
        const raidBoss: RaidBoss = {
          name: this.normalizePokemonName(name),
          tier,
          cp,
          shiny,
          types: this.extractTypes(element),
          moves: this.extractMoves(element),
        };

        raidBosses.push(raidBoss);
      }
    }

    return raidBosses;
  }

  protected validateData(data: unknown): boolean {
    if (!Array.isArray(data)) return false;
    
    return data.every(boss => {
      try {
        validateRaidBoss(boss);
        return true;
      } catch {
        return false;
      }
    });
  }

  private extractTierFromElement(element: SimpleHTMLElement): string {
    const classes = element.attr('class') || '';
    const tierMatch = classes.match(/tier-(\d+)/);
    return tierMatch ? tierMatch[1] : '1';
  }

  private normalizeTier(tierText: string): RaidBoss['tier'] {
    const tier = tierText.toLowerCase().trim();
    
    if (tier.includes('mega')) return 'mega';
    if (tier.includes('shadow')) {
      if (tier.includes('1')) return 'shadow-1';
      if (tier.includes('3')) return 'shadow-3';
      if (tier.includes('5')) return 'shadow-5';
    }
    
    const numMatch = tier.match(/(\d+)/);
    if (numMatch) {
      const num = numMatch[1];
      return (num === '1' || num === '3' || num === '5') ? num as RaidBoss['tier'] : '1';
    }
    
    return '1';
  }

  private parseCPRange(cpText: string): { min: number; max: number } {
    const cpMatch = cpText.match(/(\d+)\s*-\s*(\d+)/);
    if (cpMatch) {
      return {
        min: parseInt(cpMatch[1]),
        max: parseInt(cpMatch[2]),
      };
    }
    
    const singleCP = cpText.match(/(\d+)/);
    if (singleCP) {
      const cp = parseInt(singleCP[1]);
      return { min: cp, max: cp };
    }
    
    return { min: 0, max: 0 };
  }

  private normalizePokemonName(name: string): string {
    return name.replace(/[^\w\s-]/g, '').trim();
  }

  private extractTypes(element: SimpleHTMLElement): string[] {
    const types: string[] = [];
    const typeElements = element.find('.type, [data-type]');
    for (const typeElement of typeElements) {
      const type = typeElement.text() || typeElement.attr('data-type');
      if (type) types.push(type.toLowerCase());
    }
    return types;
  }

  private extractMoves(element: SimpleHTMLElement): string[] {
    const moves: string[] = [];
    const moveElements = element.find('.move, [data-move]');
    for (const moveElement of moveElements) {
      const move = moveElement.text() || moveElement.attr('data-move');
      if (move) moves.push(move);
    }
    return moves;
  }
} 