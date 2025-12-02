import type { AvailableLocales } from '../services/gamemaster-translator';

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
	Bug = 'Bug',
}

export enum PokemonForms {
	None = '',
	//From pogo news:
	PauStyle = "Pa'u Style",
	BaileStyle = 'Baile Style',
	PomPomStyle = 'Pom-Pom Style',
	SensuStyle = 'Sensu Style',
	//Common:
	Galarian = 'Galarian',
	Alolan = 'Alolan',
	Paldean = 'Paldean',
	Hisuian = 'Hisuian',
	Mega = 'Mega',
	MegaX = 'Mega X',
	MegaY = 'Mega Y',
	Armored = 'Armored',
	Sunny = 'Sunny',
	Snowy = 'Snowy',
	Rainy = 'Rainy',
	Primal = 'Primal',
	Attack = 'Attack',
	Defense = 'Defense',
	Speed = 'Speed',
	Plant = 'Plant',
	Sandy = 'Sandy',
	Trash = 'Trash',
	Overcast = 'Overcast',
	Sunshine = 'Sunshine',
	Frost = 'Frost',
	Mow = 'Mow',
	Heat = 'Heat',
	Wash = 'Wash',
	Fan = 'Fan',
	Altered = 'Altered',
	Origin = 'Origin',
	Land = 'Land',
	Sky = 'Sky',
	Standard = 'Standard',
	Incarnate = 'Incarnate',
	Therian = 'Therian',
	Ordinary = 'Ordinary',
	Aria = 'Aria',
	Burn = 'Burn',
	Chill = 'Chill',
	Douse = 'Douse',
	Shock = 'Shock',
	Male = 'Male',
	Female = 'Female',
	Average = 'Average',
	Small = 'Small',
	Super = 'Super',
	Large = 'Large',
	Unbound = 'Unbound',
	Pau = 'Pau',
	Baile = 'Baile',
	Pompom = 'Pompom',
	Sensu = 'Sensu',
	Dusk = 'Dusk',
	Midday = 'Midday',
	Midnight = 'Midnight',
	Hero = 'Hero',
	TenForme = 'TenForme',
	FiftyForme = 'FiftyForme',
	CompleteForme = 'CompleteForme',
	DawnWings = 'Dawn Wings',
	DuskMane = 'Dusk Mane',
	//Synthetic:
	TenPerc = '10% Forme',
	FiftyPerc = '50% Forme',
	HundredPerc = 'Complete Forme',
	Pau2 = "Pa'u",
	PomPom2 = 'Pom-Pom',
	Y = 'Y',
	X = 'X',
	//From pogo news:
	RedFlower = 'Red Flower',
	BlueFlower = 'Blue Flower',
	YellowFlower = 'Yellow Flower',
	WhiteFlower = 'White Flower',
	OrangeFlower = 'Orange Flower',
	//New
	FullBelly = 'Full Belly',
	Hangry = 'Hangry',
	White = 'White',
	Black = 'Black',
	Combat = 'Combat',
	Aqua = 'Aqua',
	Blaze = 'Blaze',
	CrownedShield = 'Crowned Shield',
	CrownedSword = 'Crowned Sword',
	RapidStrike = 'Rapid Strike',
	SingleStrike = 'Single Strike',
	Blade = 'Blade',
	Shield = 'Shield',
	Curly = 'Curly',
	Droopy = 'Droopy',
	Stretchy = 'Stretchy',
	Resolute = 'Resolute',
}

export interface PokemonStats {
	atk: number;
	def: number;
	hp: number;
}

export interface PokemonFamily {
	id: string;
	parent?: string;
	evolutions?: Array<string>;
}

export interface PokemonTags {
	legendary?: boolean;
	mythical?: boolean;
	ultrabeast?: boolean;
	shadow?: boolean;
	mega?: boolean;
}

export interface BasePvPEntry {
	speciesId: string;
	moveset: Array<string>;
	score: number;
	scores: Array<number>;
	matchups: Array<MatchUp>;
	counters: Array<MatchUp>;
}

export type PvPEntry = Omit<BasePvPEntry, 'scores'> & {
	rank: number;
	rankChange: number;
	lead: number;
	switch: number;
	charger: number;
	closer: number;
	consistency: number;
	attacker: number;
};

export type MatchUp = {
	opponent: string;
	rating: number;
	opRating?: number;
};

export interface BasePokemon {
	dex: number;
	speciesId: string;
	speciesName: string;
	types: Array<string>;
	fastMoves: Array<string>;
	chargedMoves: Array<string>;
	eliteMoves?: Array<string>;
	legacyMoves?: Array<string>;
	baseStats: PokemonStats;
	family?: PokemonFamily | undefined;
	aliasId?: string | undefined;
	released: boolean;
	tags?: Array<string>;
}

export type GameMasterPokemon = Omit<
	BasePokemon,
	'types' | 'released' | 'tags'
> & {
	types: Array<PokemonTypes>;
	imageUrl: string;
	goImageUrl: string;
	shinyGoImageUrl: string;
	isShadow: boolean;
	isMega: boolean;
	form: string;
	isLegendary: boolean;
	isMythical: boolean;
	isBeast: boolean;
};

export type GameMasterData = Record<string, GameMasterPokemon>;

export type IGameMasterMove = PvPMove &
	PvEMove & {
		moveName: Partial<Record<AvailableLocales, string>>;
	};

type BuffsType = {
	buffActivationChance: number;
	[key: string]: number;
};

type MoveSettingsType = {
	pokemonType: string;
	type: string;
	power: number;
	energyDelta: number;
	durationTurns: number;
	durationMs: number;
	buffs?: BuffsType | undefined;
};

export type GameMasterMovesType = {
	data: {
		templateId: string;
		moveSettings: MoveSettingsType;
		combatMove: MoveSettingsType;
	};
};

interface BaseMove {
	moveId: string;
	vId: string;
	type: string;
	isFast: boolean;
}

export type PvPMove = BaseMove & {
	pvpPower: number;
	pvpEnergy: number;
	pvpCooldown: number;
	buffs?: BuffsType | undefined;
};

export type PvEMove = BaseMove & {
	pvePower: number;
	pveEnergy: number;
	pveCooldown: number;
};
