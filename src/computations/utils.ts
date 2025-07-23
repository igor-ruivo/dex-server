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
	dps: number;
	fastMove: string;
	fastMoveDmg: number;
	chargedMove: string;
	chargedMoveDmg: number;
	speciesId: string;
};

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
	moves: Record<string, IGameMasterMove>,
	forRaids = true
) => {
	return Array.from(
		new Set(
			p.chargedMoves
				.concat(p.eliteMoves?.filter((m) => !moves[m].isFast) ?? [])
				.concat(p.legacyMoves?.filter((m) => !moves[m].isFast) ?? [])
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
	level = 100,
	targetDef = 200
) => {
	return (
		Math.floor(
			0.5 *
				moveDamage *
				(((baseAtk + attackIV) * cpm[level] * (selfShadow ? 1.2 : 1)) /
					((targetDef + 15) * cpm[78] * (targetShadow ? 0.8333333 : 1))) *
				(stab ? 1.2 : 1) *
				effectiveness
		) + 1
	);
};

const pveDPS = (
	chargedMoveDamage: number,
	fastMoveDamage: number,
	fastMoveCooldown: number,
	chargedMoveRequiredEnergy: number,
	fastMoveEnergy: number,
	chargedMoveAnimationDuration: number
) => {
	const fastMoveDPS = fastMoveDamage / fastMoveCooldown;

	if (fastMoveEnergy === 0 && chargedMoveRequiredEnergy !== 0) {
		return fastMoveDPS;
	}

	const secondsNeededToLoadChargedMove =
		chargedMoveRequiredEnergy === 0
			? 0
			: (chargedMoveRequiredEnergy / fastMoveEnergy) * fastMoveCooldown;

	const chargedMoveUsageDPS =
		(chargedMoveDamage + fastMoveDPS * secondsNeededToLoadChargedMove) /
		(secondsNeededToLoadChargedMove + chargedMoveAnimationDuration);

	return Math.max(chargedMoveUsageDPS, fastMoveDPS);
};

export const computeDPSEntry = (
	p: GameMasterPokemon,
	moves: Record<string, IGameMasterMove>,
	attackIV = 15,
	level = 100,
	forcedType = ''
): DPSEntry => {
	const computeDamageCalculation = (moveId: string) =>
		calculateDamage(
			p.baseStats.atk,
			moves[moveId].pvePower,
			p.types
				.map((t) => t.toString().toLocaleLowerCase())
				.includes(moves[moveId].type.toLocaleLowerCase()),
			p.isShadow,
			false,
			forcedType && forcedType !== 'normal' && moves[moveId].type === forcedType
				? Effectiveness.Effective
				: Effectiveness.Normal,
			attackIV,
			level,
			200
		);
	const computePveDPS = (
		chargedMoveDmg: number,
		fastMoveDmg: number,
		fastMoveId: string,
		chargedMoveId: string
	) =>
		pveDPS(
			chargedMoveDmg,
			fastMoveDmg,
			moves[fastMoveId].pveCooldown,
			moves[chargedMoveId].pveEnergy * -1,
			moves[fastMoveId].pveEnergy,
			moves[chargedMoveId].pveCooldown
		);

	const fastMoves = getAllFastMoves(p, moves);
	const chargedMoves = getAllChargedMoves(p, moves);
	let higherDPS = Number.MIN_VALUE;
	let higherFast = '';
	let higherFastDmg = 0;
	let higherCharged = '';
	let higherChargedDmg = 0;
	for (const currentFastMove of fastMoves) {
		for (const currentChargedMove of chargedMoves) {
			const fastMove = moves[currentFastMove];
			const chargedMove = moves[currentChargedMove];
			if (forcedType && chargedMove.type !== forcedType) {
				continue;
			}
			const fastMoveDmg = computeDamageCalculation(currentFastMove);
			const chargedMoveDmg = computeDamageCalculation(currentChargedMove);
			const dps = computePveDPS(
				chargedMoveDmg,
				fastMoveDmg,
				currentFastMove,
				currentChargedMove
			);
			if (dps > higherDPS) {
				higherDPS = dps;
				higherFast = fastMove.moveId;
				higherFastDmg = fastMoveDmg;
				higherCharged = chargedMove.moveId;
				higherChargedDmg = chargedMoveDmg;
			}
		}
	}
	return {
		fastMove: higherFast,
		chargedMove: higherCharged,
		dps: higherDPS,
		speciesId: p.speciesId,
		fastMoveDmg: higherFastDmg,
		chargedMoveDmg: higherChargedDmg,
	};
};
