// Native validation functions
export const validateString = (value: unknown): string => {
  if (typeof value !== 'string') {
    throw new Error(`Expected string, got ${typeof value}`);
  }
  return value;
};

export const validateNumber = (value: unknown): number => {
  if (typeof value !== 'number') {
    throw new Error(`Expected number, got ${typeof value}`);
  }
  return value;
};

export const validateBoolean = (value: unknown): boolean => {
  if (typeof value !== 'boolean') {
    throw new Error(`Expected boolean, got ${typeof value}`);
  }
  return value;
};

export const validateArray = <T>(value: unknown, validator: (item: unknown) => T): T[] => {
  if (!Array.isArray(value)) {
    throw new Error(`Expected array, got ${typeof value}`);
  }
  return value.map(validator);
};

export const validateObject = <T>(value: unknown, validator: (obj: Record<string, unknown>) => T): T => {
  if (typeof value !== 'object' || value === null) {
    throw new Error(`Expected object, got ${typeof value}`);
  }
  return validator(value as Record<string, unknown>);
};

// Pokemon Event validation
export const validatePokemonEvent = (data: unknown): PokemonEvent => {
  return validateObject(data, (obj) => ({
    title: validateString(obj.title),
    description: validateString(obj.description),
    startDate: obj.startDate ? validateString(obj.startDate) : undefined,
    endDate: obj.endDate ? validateString(obj.endDate) : undefined,
    url: obj.url ? validateString(obj.url) : undefined,
    imageUrl: obj.imageUrl ? validateString(obj.imageUrl) : undefined,
    type: validateEventType(obj.type),
    featured: obj.featured !== undefined ? validateBoolean(obj.featured) : false,
  }));
};

const validateEventType = (value: unknown): PokemonEvent['type'] => {
  const validTypes = ['event', 'community-day', 'raid-day', 'go-fest', 'season'];
  if (!validTypes.includes(value as string)) {
    throw new Error(`Invalid event type: ${value}`);
  }
  return value as PokemonEvent['type'];
};

// Raid Boss validation
export const validateRaidBoss = (data: unknown): RaidBoss => {
  return validateObject(data, (obj) => ({
    name: validateString(obj.name),
    tier: validateRaidTier(obj.tier),
    cp: validateObject(obj.cp, (cp) => ({
      min: validateNumber(cp.min),
      max: validateNumber(cp.max),
    })),
    shiny: obj.shiny !== undefined ? validateBoolean(obj.shiny) : false,
    moves: obj.moves ? validateArray(obj.moves, validateString) : undefined,
    types: obj.types ? validateArray(obj.types, validateString) : undefined,
    imageUrl: obj.imageUrl ? validateString(obj.imageUrl) : undefined,
  }));
};

const validateRaidTier = (value: unknown): RaidBoss['tier'] => {
  const validTiers = ['1', '3', '5', 'mega', 'shadow-1', 'shadow-3', 'shadow-5'];
  if (!validTiers.includes(value as string)) {
    throw new Error(`Invalid raid tier: ${value}`);
  }
  return value as RaidBoss['tier'];
};

// Game Master Pokemon validation
export const validateGameMasterPokemon = (data: unknown): GameMasterPokemon => {
  return validateObject(data, (obj) => ({
    dex: validateNumber(obj.dex),
    speciesId: validateString(obj.speciesId),
    speciesName: validateString(obj.speciesName),
    types: validateArray(obj.types, validateString),
    fastMoves: obj.fastMoves ? validateArray(obj.fastMoves, validateString) : undefined,
    chargedMoves: obj.chargedMoves ? validateArray(obj.chargedMoves, validateString) : undefined,
    stats: validateObject(obj.stats, (stats) => ({
      atk: validateNumber(stats.atk),
      def: validateNumber(stats.def),
      hp: validateNumber(stats.hp),
    })),
    family: obj.family ? validateString(obj.family) : undefined,
    evolutionBranch: obj.evolutionBranch ? validateArray(obj.evolutionBranch, validateEvolutionBranch) : undefined,
  }));
};

const validateEvolutionBranch = (data: unknown): NonNullable<GameMasterPokemon['evolutionBranch']>[0] => {
  return validateObject(data, (obj) => ({
    evolution: validateString(obj.evolution),
    candyCost: validateNumber(obj.candyCost),
    itemCost: obj.itemCost ? validateString(obj.itemCost) : undefined,
  }));
};

// Team Rocket validation
export const validateTeamRocket = (data: unknown): TeamRocket => {
  return validateObject(data, (obj) => ({
    name: validateString(obj.name),
    type: validateRocketType(obj.type),
    pokemon: validateArray(obj.pokemon, validateRocketPokemon),
    reward: validateObject(obj.reward, (reward) => ({
      stardust: validateNumber(reward.stardust),
      candy: validateNumber(reward.candy),
    })),
  }));
};

const validateRocketType = (value: unknown): TeamRocket['type'] => {
  const validTypes = ['grunt', 'leader', 'boss'];
  if (!validTypes.includes(value as string)) {
    throw new Error(`Invalid rocket type: ${value}`);
  }
  return value as TeamRocket['type'];
};

const validateRocketPokemon = (data: unknown): TeamRocket['pokemon'][0] => {
  return validateObject(data, (obj) => ({
    name: validateString(obj.name),
    cp: validateObject(obj.cp, (cp) => ({
      min: validateNumber(cp.min),
      max: validateNumber(cp.max),
    })),
    shiny: obj.shiny !== undefined ? validateBoolean(obj.shiny) : false,
  }));
};

// Type definitions
export interface PokemonEvent {
  title: string;
  description: string;
  startDate?: string;
  endDate?: string;
  url?: string;
  imageUrl?: string;
  type: 'event' | 'community-day' | 'raid-day' | 'go-fest' | 'season';
  featured: boolean;
}

export interface RaidBoss {
  name: string;
  tier: '1' | '3' | '5' | 'mega' | 'shadow-1' | 'shadow-3' | 'shadow-5';
  cp: {
    min: number;
    max: number;
  };
  shiny: boolean;
  moves?: string[];
  types?: string[];
  imageUrl?: string;
}

export interface GameMasterPokemon {
  dex: number;
  speciesId: string;
  speciesName: string;
  types: string[];
  fastMoves?: string[];
  chargedMoves?: string[];
  stats: {
    atk: number;
    def: number;
    hp: number;
  };
  family?: string;
  evolutionBranch?: Array<{
    evolution: string;
    candyCost: number;
    itemCost?: string;
  }>;
}

export interface TeamRocket {
  name: string;
  type: 'grunt' | 'leader' | 'boss';
  pokemon: Array<{
    name: string;
    cp: {
      min: number;
      max: number;
    };
    shiny: boolean;
  }>;
  reward: {
    stardust: number;
    candy: number;
  };
}

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
  data?: unknown;
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