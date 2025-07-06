import { z } from 'zod';

// Base schemas for validation
export const PokemonEventSchema = z.object({
  title: z.string(),
  description: z.string(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  url: z.string().optional(),
  imageUrl: z.string().optional(),
  type: z.enum(['event', 'community-day', 'raid-day', 'go-fest', 'season']),
  featured: z.boolean().default(false),
});

export const RaidBossSchema = z.object({
  name: z.string(),
  tier: z.enum(['1', '3', '5', 'mega', 'shadow-1', 'shadow-3', 'shadow-5']),
  cp: z.object({
    min: z.number(),
    max: z.number(),
  }),
  shiny: z.boolean().default(false),
  moves: z.array(z.string()).optional(),
  types: z.array(z.string()).optional(),
  imageUrl: z.string().optional(),
});

export const GameMasterPokemonSchema = z.object({
  dex: z.number(),
  speciesId: z.string(),
  speciesName: z.string(),
  types: z.array(z.string()),
  fastMoves: z.array(z.string()).optional(),
  chargedMoves: z.array(z.string()).optional(),
  stats: z.object({
    atk: z.number(),
    def: z.number(),
    hp: z.number(),
  }),
  family: z.string().optional(),
  evolutionBranch: z.array(z.object({
    evolution: z.string(),
    candyCost: z.number(),
    itemCost: z.string().optional(),
  })).optional(),
});

export const TeamRocketSchema = z.object({
  name: z.string(),
  type: z.enum(['grunt', 'leader', 'boss']),
  pokemon: z.array(z.object({
    name: z.string(),
    cp: z.object({
      min: z.number(),
      max: z.number(),
    }),
    shiny: z.boolean().default(false),
  })),
  reward: z.object({
    stardust: z.number(),
    candy: z.number(),
  }),
});

// Type definitions
export type PokemonEvent = z.infer<typeof PokemonEventSchema>;
export type RaidBoss = z.infer<typeof RaidBossSchema>;
export type GameMasterPokemon = z.infer<typeof GameMasterPokemonSchema>;
export type TeamRocket = z.infer<typeof TeamRocketSchema>;

// Aggregated data structure
export interface AggregatedData {
  events: PokemonEvent[];
  raidBosses: {
    current: RaidBoss[];
    upcoming: RaidBoss[];
  };
  teamRocket: TeamRocket[];
  gameMaster: {
    pokemon: GameMasterPokemon[];
    lastUpdated: string;
  };
  metadata: {
    lastFetch: string;
    version: string;
    sources: string[];
  };
}

// Source configuration
export interface DataSource {
  name: string;
  url: string;
  type: 'events' | 'raids' | 'team-rocket' | 'game-master';
  parser: string;
  enabled: boolean;
  priority: number;
}

// Processing result
export interface ProcessingResult {
  success: boolean;
  data?: any;
  error?: string;
  source: string;
  timestamp: string;
  processingTime: number;
}

// Configuration
export interface AppConfig {
  cronSchedule: string;
  outputDir: string;
  maxRetries: number;
  timeout: number;
  sources: DataSource[];
} 