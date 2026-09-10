import type {
	GameMasterPokemon,
	IGameMasterMove,
} from '../parsers/types/pokemon';

export enum Effectiveness {
	DoubleResistance = 0.390625,
	Resistance = 0.625,
	Normal = 1,
	Effective = 1.6,
	DoubleEffective = 2.56,
}

export type DPSEntry = {
	/** Weave DPS with the comprehensive / energy-from-damage corrections. */
	dps: number;
	/** Total damage output = dps × time-on-field (bulk-weighted). */
	tdo: number;
	/** Effective DPS: bossHP ÷ time-to-win, incl. faints + relobby downtime. */
	edps: number;
	fastMove: string;
	fastMoveDmg: number;
	chargedMove: string;
	chargedMoveDmg: number;
	speciesId: string;
};

/* ---- raid model constants ------------------------------------------------- */

/**
 * GamePress "y": the numerator of the average incoming DPS a raid attacker
 * suffers, before dividing by its own effective defense. `incomingDps = Y / Def`.
 * Same for every boss — the closed-form TDO/eDPS metrics deliberately don't look
 * at the specific boss's moveset (see the comparison notes).
 */
export const RAID_INCOMING_DPS_NUMERATOR = 900;
/** Companion to {@link RAID_INCOMING_DPS_NUMERATOR}: one absorbed boss charged hit. */
export const RAID_INCOMING_CM_POWER = 11700;
/** Seconds lost to the faint/respawn animation on an in-battle swap. */
export const RAID_RESPAWN_SECONDS = 1;
/** Seconds lost walking back in after the whole party wipes to the lobby. */
export const RAID_RELOBBY_SECONDS = 10;
/** Trainers assumed in the lobby, for the death → relobby accounting in eDPS. */
export const RAID_PARTY_SIZE = 6;

export type RaidTier = 'T1' | 'T3' | 'T5' | 'MEGA' | 'T6' | 'PRIMAL' | 'ELITE';

/**
 * Boss HP + the CPM applied to the boss's base defense, per tier. HP and CPM are
 * datamined game constants (not estimates). T6 = Mega-Legendary raids.
 */
export const RAID_BOSS_STATS: Record<RaidTier, { hp: number; cpm: number }> = {
	T1: { hp: 600, cpm: 0.5974 },
	T3: { hp: 3600, cpm: 0.73 },
	T5: { hp: 15000, cpm: 0.79 },
	MEGA: { hp: 9000, cpm: 0.79 },
	T6: { hp: 22500, cpm: 0.79 },
	PRIMAL: { hp: 22500, cpm: 0.79 },
	ELITE: { hp: 20000, cpm: 0.79 },
};

/**
 * Best-effort raid tier from Game Master flags:
 *  - Primal (`*_primal`) → Primal
 *  - a Mega/Primal of a Legendary or Mythical (Mega Rayquaza, Mega Mewtwo…) → T6
 *  - any other Mega → Mega
 *  - Legendary / Mythical / Ultra Beast → T5
 *  - an evolved form, or a standalone with no evo line → T3
 *  - the base of an evo line → T1
 *
 * The speculative `isSuperMega` flag is NOT a raid tier and is ignored. Elite
 * Raids are event-scheduled — pass `tier: 'ELITE'` explicitly when you know it.
 */
export const guessRaidTier = (p: {
	speciesId: string;
	isMega: boolean;
	isLegendary: boolean;
	isMythical: boolean;
	isBeast: boolean;
	family?: { parent?: string; evolutions?: Array<string> } | undefined;
}): RaidTier => {
	if (p.isMega && p.speciesId.includes('_primal')) return 'PRIMAL';
	if (p.isMega && (p.isLegendary || p.isMythical)) return 'T6';
	if (p.isMega) return 'MEGA';
	if (p.isLegendary || p.isMythical || p.isBeast) return 'T5';
	if (p.family?.parent) return 'T3';
	if (p.family?.evolutions && p.family.evolutions.length > 0) return 'T1';
	return 'T3';
};

/** PvE battles resolve on a 500 ms server tick, so every duration snaps to it. */
const roundToPveTurn = (seconds: number) => Math.round(seconds * 2) / 2;

/**
 * DialgaDex's Party Power model: the shared gauge fills from fast moves, so the
 * boost to your charged move scales with how many fast moves you throw per
 * charged one. Returns a 0..1 multiplier added on top of the charged move DPS.
 */
const partyPowerBoost = (fastPerCharged: number, partySize: number) => {
	if (!partySize || partySize <= 1) return 0;
	const perBoost = partySize === 2 ? 18 : partySize === 3 ? 9 : 6;
	return Math.max(0, Math.min(fastPerCharged / perBoost, 1));
};

export interface WeaveDpsInput {
	fastDmg: number;
	fastDurationSec: number;
	fastEnergy: number;
	chargedDmg: number;
	chargedDurationSec: number;
	/** Energy the charged move costs, as a positive number. */
	chargedEnergyCost: number;
	attackerHpEff: number;
	incomingDps: number;
	incomingChargedHit?: number;
	partyBoost?: number;
}

/**
 * Weave DPS with the GamePress "comprehensive" corrections layered on the
 * steady-state cycle:
 *  - 0.5 s tick quantization of both move durations
 *  - a 1-bar move wastes ~half a fast move of energy per cycle at the 100 cap
 *  - `x` folds in energy handed to you by incoming damage (fires charged moves
 *    more often than fast-move energy alone allows)
 *  - the `(0.5 − x/hp)·y` term corrects for the finite fight: slow energy ramp
 *    early, dumping leftover energy into charged moves as you're about to faint
 *  - optional Party Power boost on the charged move
 */
export const weaveDps = ({
	fastDmg,
	fastDurationSec,
	fastEnergy,
	chargedDmg,
	chargedDurationSec,
	chargedEnergyCost,
	attackerHpEff,
	incomingDps,
	incomingChargedHit = 0,
	partyBoost = 0,
}: WeaveDpsInput): number => {
	const d_f = roundToPveTurn(fastDurationSec);
	const d_c = roundToPveTurn(chargedDurationSec);

	if (d_f <= 0 || fastEnergy <= 0 || chargedEnergyCost <= 0) {
		return d_f > 0 ? fastDmg / d_f : 0;
	}

	const fm_dps = fastDmg / d_f;
	const fm_eps = fastEnergy / d_f;
	const cm_dps = chargedDmg / d_c;
	const cm_dps_adj = cm_dps * (1 + partyBoost);

	// energy-cap waste on a 1-bar move: it sits pinned near the 100 ceiling, so a
	// fast move's worth of energy overflows every cycle. This is DialgaDex's
	// turn-based form `(100 + 0.5·E_f) / d_c` — its extra `0.5·y·dws` term only
	// applies in continuous mode, which we are not.
	let cm_eps = chargedEnergyCost / d_c;
	if (chargedEnergyCost >= 100) {
		cm_eps = (chargedEnergyCost + 0.5 * fastEnergy) / d_c;
	}

	// average energy on the meter + energy from one absorbed boss charged hit.
	const x =
		0.5 * chargedEnergyCost + 0.5 * fastEnergy + 0.5 * incomingChargedHit;

	// fast move alone already beats the charged move — just spam it.
	if (fm_dps > cm_dps) return fm_dps;

	// steady-state weave DPS (what the old formula returned)
	const dps0 = (fm_dps * cm_eps + cm_dps_adj * fm_eps) / (cm_eps + fm_eps);
	// comprehensive correction for the finite fight
	const dps =
		dps0 +
		((cm_dps_adj - fm_dps) / (cm_eps + fm_eps)) *
			(0.5 - x / attackerHpEff) *
			incomingDps;

	return fm_dps > dps ? fm_dps : Math.max(dps, 0);
};

/**
 * The level ceiling every computation evaluates to. In-game a Pokémon can reach
 * 51 (Best Buddy) or beyond (Super Mega L4), but those are edge cases we
 * deliberately ignore so every ranking and DPS number is expressed against
 * level 50.
 */
export const MAX_LEVEL = 50;
/** {@link MAX_LEVEL} as a half-level {@link cpm} index: `(level - 1) * 2`. */
export const MAX_LEVEL_INDEX = (MAX_LEVEL - 1) * 2;

export const cpm = [
	0.0939999967813491, 0.135137430784308, 0.166397869586944, 0.192650914456886,
	0.215732470154762, 0.236572655026622, 0.255720049142837, 0.273530381100769,
	0.29024988412857, 0.306057381335773, 0.321087598800659, 0.335445032295077,
	0.349212676286697, 0.36245774877879, 0.375235587358474, 0.387592411085168,
	0.399567276239395, 0.41119354951725, 0.422500014305114, 0.432926413410414,
	0.443107545375824, 0.453059953871985, 0.46279838681221, 0.472336077786704,
	0.481684952974319, 0.490855810259008, 0.499858438968658, 0.508701756943992,
	0.517393946647644, 0.525942508771329, 0.534354329109191, 0.542635762230353,
	0.550792694091796, 0.558830599438087, 0.566754519939422, 0.574569148039264,
	0.582278907299041, 0.589887911977272, 0.59740000963211, 0.604823657502073,
	0.61215728521347, 0.61940411056605, 0.626567125320434, 0.633649181622743,
	0.640652954578399, 0.647580963301656, 0.654435634613037, 0.661219263506722,
	0.667934000492096, 0.674581899290818, 0.681164920330047, 0.687684905887771,
	0.694143652915954, 0.700542893277978, 0.706884205341339, 0.713169102333341,
	0.719399094581604, 0.725575616972598, 0.731700003147125, 0.734741011137376,
	0.737769484519958, 0.740785574597326, 0.743789434432983, 0.746781208702482,
	0.749761044979095, 0.752729105305821, 0.75568550825119, 0.758630366519684,
	0.761563837528228, 0.764486065255226, 0.767397165298461, 0.77029727397159,
	0.77318650484085, 0.776064945942412, 0.778932750225067, 0.781790064808426,
	0.784636974334716, 0.787473583646825, 0.790300011634826, 0.792803950958807,
	0.795300006866455, 0.79780392148697, 0.800300002098083, 0.802803892322847,
	0.805299997329711, 0.807803863460723, 0.81029999256134, 0.812803834895026,
	0.815299987792968, 0.817803806620319, 0.820299983024597, 0.822803778631297,
	0.825299978256225, 0.827803750922782, 0.830299973487854, 0.832803753381377,
	0.835300028324127, 0.837803755931569, 0.840300023555755, 0.842803729034748,
	0.845300018787384, 0.847803702398935, 0.850300014019012, 0.852803676019539,
	0.85530000925064, 0.857803649892077, 0.860300004482269, 0.862803624012168,
	0.865299999713897,
];

export const getAllFastMoves = (
	p: GameMasterPokemon,
	moves: Record<string, IGameMasterMove>
) => {
	return Array.from(
		new Set(
			p.fastMoves
				.concat(p.eliteMoves?.filter((m) => moves[m].isFast) ?? [])
				.concat(p.legacyMoves?.filter((m) => moves[m].isFast) ?? [])
		)
	);
};

export const getAllChargedMoves = (
	p: GameMasterPokemon,
	moves: Record<string, IGameMasterMove>
) => {
	return Array.from(
		new Set(
			p.chargedMoves
				.concat(p.eliteMoves?.filter((m) => !moves[m].isFast) ?? [])
				.concat(p.legacyMoves?.filter((m) => !moves[m].isFast) ?? [])
				.concat(p.extraChargedMoves?.filter((m) => !moves[m].isFast) ?? [])
		)
	);
};

export const calculateDamage = (
	baseAtk: number,
	moveDamage: number,
	stab: boolean,
	selfShadow: boolean,
	targetShadow = false,
	effectiveness: Effectiveness = Effectiveness.Effective,
	attackIV = 15,
	level = MAX_LEVEL_INDEX,
	targetDef = 200,
	/** Weather × friendship × mega-aura, applied on top. */
	bonusMultiplier = 1,
	/** CPM applied to the defender's base defense (raid tier CPM, or L40). */
	defenderCpm = cpm[78]
) => {
	return (
		Math.floor(
			0.5 *
				moveDamage *
				(((baseAtk + attackIV) * cpm[level] * (selfShadow ? 1.2 : 1)) /
					((targetDef + 15) * defenderCpm * (targetShadow ? 0.8333333 : 1))) *
				(stab ? 1.2 : 1) *
				effectiveness *
				bonusMultiplier
		) + 1
	);
};

export interface RaidOpts {
	/** Boss tier — sets boss HP (eDPS) and the CPM on the boss's defense. */
	tier?: RaidTier;
	/** Attacker move types boosted ×1.2 by the current weather. */
	weatherBoostedTypes?: ReadonlySet<string>;
	/** Friendship damage multiplier (1 = none … 1.11 = best friend). */
	friendship?: number;
	/** Trainers fast-attacking together, for Party Power (1 = off). */
	partySize?: number;
	/** A Mega of this type on your team: ×1.3 same type, ×1.1 others. */
	megaBoostType?: string;
}

export const computeDPSEntry = (
	p: GameMasterPokemon,
	moves: Record<string, IGameMasterMove>,
	attackIV = 15,
	level = MAX_LEVEL_INDEX,
	forcedType = '',
	opts: RaidOpts = {}
): DPSEntry => {
	// No specific boss for the per-type list — assume a generic T5 raid.
	const tier: RaidTier = opts.tier ?? 'T5';
	const boss = RAID_BOSS_STATS[tier];
	const dummyBossDef = 200;

	const attackerDefEff =
		(p.baseStats.def + 15) * cpm[level] * (p.isShadow ? 0.8333333 : 1);
	const attackerHpEff = Math.floor((p.baseStats.hp + 15) * cpm[level]);
	const incomingDps = RAID_INCOMING_DPS_NUMERATOR / attackerDefEff;
	const incomingChargedHit = RAID_INCOMING_CM_POWER / attackerDefEff;

	const moveBonus = (moveType: string) => {
		let m = opts.friendship && opts.friendship > 1 ? opts.friendship : 1;
		if (opts.weatherBoostedTypes?.has(moveType)) m *= 1.2;
		if (opts.megaBoostType) m *= moveType === opts.megaBoostType ? 1.3 : 1.1;
		return m;
	};

	const dmg = (moveId: string) => {
		const mv = moves[moveId];
		const mType = mv.type.toLocaleLowerCase();
		const stab = p.types
			.map((t) => t.toString().toLocaleLowerCase())
			.includes(mType);
		const eff =
			forcedType && forcedType !== 'normal' && mType === forcedType
				? Effectiveness.Effective
				: Effectiveness.Normal;
		return calculateDamage(
			p.baseStats.atk,
			mv.pvePower,
			stab,
			p.isShadow,
			false,
			eff,
			attackIV,
			level,
			dummyBossDef,
			moveBonus(mType),
			boss.cpm
		);
	};

	const fastMoves = getAllFastMoves(p, moves);
	const chargedMoves = getAllChargedMoves(p, moves);
	let best = {
		dps: -Infinity,
		fast: '',
		fastDmg: 0,
		charged: '',
		chargedDmg: 0,
	};
	for (const fId of fastMoves) {
		for (const cId of chargedMoves) {
			const cm = moves[cId];
			if (forcedType && cm.type !== forcedType) {
				continue;
			}
			const fm = moves[fId];
			const fastDmg = dmg(fId);
			const chargedDmg = dmg(cId);
			const chargedEnergyCost = -cm.pveEnergy;
			const fastEnergy = fm.pveEnergy;
			const fastPerCharged =
				fastEnergy > 0 ? chargedEnergyCost / fastEnergy : 0;
			const partyBoost = partyPowerBoost(fastPerCharged, opts.partySize ?? 1);
			const dps = weaveDps({
				fastDmg,
				fastDurationSec: fm.pveCooldown,
				fastEnergy,
				chargedDmg,
				chargedDurationSec: cm.pveCooldown,
				chargedEnergyCost,
				attackerHpEff,
				incomingDps,
				incomingChargedHit,
				partyBoost,
			});
			if (dps > best.dps) {
				best = {
					dps,
					fast: fm.moveId,
					fastDmg,
					charged: cm.moveId,
					chargedDmg,
				};
			}
		}
	}

	const dps = Number.isFinite(best.dps) ? best.dps : 0;
	const tof = incomingDps > 0 ? attackerHpEff / incomingDps : 0;
	const tdo = dps * tof;

	let edps = 0;
	if (tdo > 0 && tof > 0) {
		const lives = boss.hp / tdo;
		const deaths = Math.max(0, Math.ceil(lives) - 1);
		const relobbies = Math.floor(deaths / RAID_PARTY_SIZE);
		const ttw =
			lives * tof +
			(deaths - relobbies) * RAID_RESPAWN_SECONDS +
			relobbies * RAID_RELOBBY_SECONDS;
		edps = ttw > 0 ? boss.hp / ttw : 0;
	}

	return {
		fastMove: best.fast,
		chargedMove: best.charged,
		dps,
		tdo,
		edps,
		speciesId: p.speciesId,
		fastMoveDmg: best.fastDmg,
		chargedMoveDmg: best.chargedDmg,
	};
};
