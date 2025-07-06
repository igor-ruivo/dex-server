import * as cheerio from 'cheerio';
import { BaseParser } from './base-parser';
import { RaidBoss, RaidBossSchema } from '../types';

export class LeekDuckRaidParser extends BaseParser {
  protected async parseData(rawData: string): Promise<RaidBoss[]> {
    const $ = cheerio.load(rawData);
    const raidBosses: RaidBoss[] = [];

    // Parse raid bosses from Leek Duck website
    $('.raid-boss, .boss-item, [data-tier]').each((index, element) => {
      const $element = $(element);
      
      const name = $element.find('.pokemon-name, .name, h3, h4').first().text().trim();
      const tierText = $element.find('.tier, [data-tier]').first().text().trim() || 
                      $element.attr('data-tier') || 
                      this.extractTierFromElement($element);
      const cpText = $element.find('.cp, .cp-range').first().text().trim();
      const shiny = $element.find('.shiny, [data-shiny]').length > 0 || 
                   $element.text().toLowerCase().includes('shiny');
      
      if (name && tierText) {
        const tier = this.normalizeTier(tierText);
        const cp = this.parseCPRange(cpText);
        
        const raidBoss: RaidBoss = {
          name: this.normalizePokemonName(name),
          tier,
          cp,
          shiny,
          types: this.extractTypes($element),
          moves: this.extractMoves($element),
        };

        raidBosses.push(raidBoss);
      }
    });

    return raidBosses;
  }

  protected validateData(data: any): boolean {
    if (!Array.isArray(data)) return false;
    
    return data.every(boss => {
      try {
        RaidBossSchema.parse(boss);
        return true;
      } catch {
        return false;
      }
    });
  }

  private extractTierFromElement($element: cheerio.Cheerio<cheerio.Element>): string {
    const classes = $element.attr('class') || '';
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

  private extractTypes($element: cheerio.Cheerio<cheerio.Element>): string[] {
    const types: string[] = [];
    $element.find('.type, [data-type]').each((_, typeElement) => {
      const type = $element.find(typeElement).text().trim() || $element.find(typeElement).attr('data-type');
      if (type) types.push(type.toLowerCase());
    });
    return types;
  }

  private extractMoves($element: cheerio.Cheerio<cheerio.Element>): string[] {
    const moves: string[] = [];
    $element.find('.move, [data-move]').each((_, moveElement) => {
      const move = $element.find(moveElement).text().trim() || $element.find(moveElement).attr('data-move');
      if (move) moves.push(move);
    });
    return moves;
  }
} 