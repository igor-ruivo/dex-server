import type { IEntry } from './events';

/** Whether a change makes a move better or worse. */
export type GblChangeDirection = 'buff' | 'nerf';

/** What a move's changes add up to: all of them for the better, all for the worse, or a bit of each. */
export type GblVerdict = 'buff' | 'nerf' | 'adjusted';

/** Where a change applies: Trainer Battles (`pvp`) or Gyms and Raid Battles (`pve`). */
export type GblChangeArena = 'pvp' | 'pve';

/** One change to a move, read from a bullet point of the post (which is in English: the app words these itself, in every language). */
export type GblChange = { direction: GblChangeDirection } & (
	| { kind: 'power'; arena: GblChangeArena; from: number; to: number }
	| {
			kind: 'energyCost';
			arena: GblChangeArena;
			change: 'increased' | 'decreased';
	  }
	| {
			kind: 'energyGain';
			arena: GblChangeArena;
			change: 'increased' | 'decreased';
	  }
	| {
			/** The chance of the stat-stage effect a charged move has: "decreased chance to increase user's Attack by one stage". */
			kind: 'buffChance';
			arena: GblChangeArena;
			chance: 'guaranteed' | 'increased' | 'decreased';
			/** Whose stat the move changes. */
			target: 'user' | 'opponent';
			stat: 'attack' | 'defense';
			/** Whether the move raises that stat or lowers it. */
			effect: 'raise' | 'lower';
			stages: number;
	  }
);

export interface IGblAttackChange {
	moveId: string;
	verdict: GblVerdict;
	changes: Array<GblChange>;
}

/**
 * A reward encounter of the season: the Pokémon, whether it can be shiny (read from the sparkle on the post's picture of it), and the
 * rank it is met at (a rank-up encounter at that exact rank, a standard one from that rank on).
 */
export interface IGblEncounter extends IEntry {
	rank: number;
}

/** A Pokémon that gains a move in the GO Battle League this season. */
export interface IGblAttackAvailability {
	speciesId: string;
	moveId: string;
}

/** The "GO Battle League: <season>" post, the season's rewards and its attack changes. */
export interface IGblSeason {
	/** The post's address after `/news/` (`go-battle-league-twilight-trails`); the post exists in every language at the same address. */
	slug: string;
	/** The season's name ("Twilight Trails"), in English. */
	name: string;
	/** The post's own picture, as the news posts' (the one at the top of the article). */
	imageUrl: string;
	/** The Pokémon met once per season when reaching a rank, in the order of the ranks. */
	rankUpEncounters: Array<IGblEncounter>;
	/** The Pokémon met in reward encounters all season, from the lowest rank up. */
	standardEncounters: Array<IGblEncounter>;
	/** The "surprise encounter with a Legendary Pokémon" that closes the standard encounters, when the post has one. */
	legendarySurprise?: { rank: number } | undefined;
	attackChanges: Array<IGblAttackChange>;
	attackAvailability: Array<IGblAttackAvailability>;
}
