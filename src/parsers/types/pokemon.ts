import { AvailableLocales } from "../services/gamemaster-translator";

export enum PokemonTypes {
  Water = 'Water',
  Fire = 'Fire',
  Dragon = 'Dragon',
  Fairy = 'Fairy',
  Ice = 'Ice',
  Ground = 'Ground',
  Rock = 'Rock',
  Psychic = 'Psychic',
  Fighting = 'Fighting',
  Flying = 'Flying',
  Ghost = 'Ghost',
  Steel = 'Steel',
  Dark = 'Dark',
  Normal = 'Normal',
  Grass = 'Grass',
  Electric = 'Electric',
  Poison = 'Poison',
  Bug = 'Bug'
}

export enum PokemonForms {
  None = "",
  //From pogo news:
  PauStyle = "Pa'u Style",
  BaileStyle = "Baile Style",
  PomPomStyle = "Pom-Pom Style",
  SensuStyle = "Sensu Style",
  //Common:
  Galarian = "Galarian",
  Alolan = "Alolan",
  Paldean = "Paldean",
  Hisuian = "Hisuian",
  Mega = "Mega",
  MegaX = "Mega X",
  MegaY = "Mega Y",
  Armored = "Armored",
  Sunny = "Sunny",
  Snowy = "Snowy",
  Rainy = "Rainy",
  Primal = "Primal",
  Attack = "Attack",
  Defense = "Defense",
  Speed = "Speed",
  Plant = "Plant",
  Sandy = "Sandy",
  Trash = "Trash",
  Overcast = "Overcast",
  Sunshine = "Sunshine",
  Frost = "Frost",
  Mow = "Mow",
  Heat = "Heat",
  Wash = "Wash",
  Altered = "Altered",
  Origin = "Origin",
  Land = "Land",
  Sky = "Sky",
  Standard = "Standard",
  Incarnate = "Incarnate",
  Therian = "Therian",
  Ordinary = "Ordinary",
  Aria = "Aria",
  Burn = "Burn",
  Chill = "Chill",
  Douse = "Douse",
  Shock = "Shock",
  Male = "Male",
  Female = "Female",
  Average = "Average",
  Small = "Small",
  Super = "Super",
  Large = "Large",
  Unbound = "Unbound",
  Pau = "Pau",
  Baile = "Baile",
  Pompom = "Pompom",
  Sensu = "Sensu",
  Dusk = "Dusk",
  Midday = "Midday",
  Midnight = "Midnight",
  Hero = "Hero",
  TenForme = "TenForme",
  FiftyForme = "FiftyForme",
  CompleteForme = "CompleteForme",
  DawnWings = "Dawn Wings",
  DuskMane = "Dusk Mane",
  //Synthetic:
  TenPerc = "10% Forme",
  FiftyPerc = "50% Forme",
  HundredPerc = "Complete Forme",
  Pau2 = "Pa'u",
  PomPom2 = "Pom-Pom",
  Y = "Y",
  X = "X",
  //From pogo news:
  RedFlower = "Red Flower",
  BlueFlower = "Blue Flower",
  YellowFlower = "Yellow Flower",
  WhiteFlower = "White Flower",
  OrangeFlower = "Orange Flower",
  //New
  FullBelly = "Full Belly",
  Hangry = "Hangry",
  White = "White",
  Black = "Black",
  Combat = "Combat",
  Aqua = "Aqua",
  Blaze = "Blaze",
  CrownedShield = "Crowned Shield",
  CrownedSword = "Crowned Sword",
  RapidStrike = "Rapid Strike",
  SingleStrike = "Single Strike",
  Blade = "Blade",
  Shield = "Shield"
}

export interface PokemonStats {
  atk: number;
  def: number;
  hp: number;
}

export interface PokemonFamily {
  id: string;
  parent?: string;
  evolutions?: string[];
}

export interface PokemonTags {
  legendary?: boolean;
  mythical?: boolean;
  ultrabeast?: boolean;
  shadow?: boolean;
  mega?: boolean;
}

export interface BasePokemon {
  dex: number;
  speciesId: string;
  speciesName: string;
  baseStats: PokemonStats;
  types: string[];
  fastMoves: string[];
  chargedMoves: string[];
  eliteMoves: string[];
  legacyMoves: string[];
  family?: PokemonFamily;
  aliasId?: string;
  released: boolean;
  tags?: string[];
}

export interface GameMasterPokemon {
  dex: number;
  speciesId: string;
  speciesName: string;
  types: PokemonTypes[];
  imageUrl: string;
  goImageUrl: string;
  shinyGoImageUrl: string;
  atk: number;
  def: number;
  hp: number;
  fastMoves: string[];
  chargedMoves: string[];
  eliteMoves: string[];
  legacyMoves: string[];
  isShadow: boolean;
  isMega: boolean;
  familyId?: string;
  parent?: string;
  evolutions: string[];
  aliasId?: string;
  form: string;
  isLegendary: boolean;
  isMythical: boolean;
  isBeast: boolean;
}

export interface GameMasterData {
  [speciesId: string]: GameMasterPokemon;
}

export interface IGameMasterMove {
  moveId: string;
  vId: string;
  type: string;
  isFast: boolean;
  pvpPower: number;
  pvePower: number;
  pvpEnergyDelta: number;
  pveEnergyDelta: number;
  pvpDuration: number;
  pveDuration: number;
  pvpBuffs?: {
    chance: number;
    buffs: Array<{ buff: string; quantity: number }>;
  };
  moveName: Partial<Record<AvailableLocales, string>>;
}

type BuffsType = {
  buffActivationChance: number,
  [key: string]: number
}

type MoveSettingsType = {
  pokemonType: string,
  type: string,
  power: number,
  energyDelta: number,
  durationTurns: number,
  durationMs: number,
  buffs: BuffsType
}

export type GameMasterMovesType = {
  data: {
    templateId: string,
    moveSettings: MoveSettingsType,
    combatMove: MoveSettingsType
  }
}

export type PvPMove = {
  moveId: string,
  vId: string,
  type: string,
  isFast: boolean,
  pvpPower: number,
  pvpEnergy: number,
  pvpCooldown: number,
  buffs: BuffsType
};

export type PvEMove = {
  moveId: string,
  vId: string,
  type: string,
  isFast: boolean,
  pvePower: number,
  pveEnergy: number,
  pveCooldown: number
};