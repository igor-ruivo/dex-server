import type {
	GblChange,
	GblChangeArena,
	GblChangeDirection,
	GblVerdict,
} from '../../types/gbl';

const ARENA_PREFIX = /^(trainer battles|gyms and raids)\s*:\s*/i;
const POWER = /^(\d+)\s*→\s*(\d+)(?:\s+power)?(?:\s+and\s+(.*))?$/i;
const ENERGY =
	/^energy (cost|generation|gain) (increased|decreased)( in gyms and raid battles)?$/i;
const STAT_EFFECT =
	/^(guaranteed|increased|decreased|reduced) chance to (increase|raise|boost|decrease|lower|reduce) (?:the )?(user|opponent)'s (attack|defense)(?: by)?(?: (one|two|\d+) stages?)?$/i;

const WORD_NUMBERS: Record<string, number> = { one: 1, two: 2 };

const better = (isBetter: boolean): GblChangeDirection =>
	isBetter ? 'buff' : 'nerf';

/** How a change to the chance of a stat-stage effect plays out: a likelier raise of the user's stat is good, a likelier drop of it is not. */
const statEffect = (
	clause: string,
	arena: GblChangeArena
): GblChange | undefined => {
	const match = STAT_EFFECT.exec(clause);
	if (!match) {
		return undefined;
	}
	const [, chanceWord, verb, target, stat, stages] = match;
	const likelier = /^(guaranteed|increased)$/i.test(chanceWord);
	const raises = /^(increase|raise|boost)$/i.test(verb);
	const goodForTheUser = (target.toLowerCase() === 'user') === raises;
	return {
		kind: 'buffChance',
		arena,
		direction: better(likelier === goodForTheUser),
		chance: /^guaranteed$/i.test(chanceWord)
			? 'guaranteed'
			: likelier
				? 'increased'
				: 'decreased',
		target: target.toLowerCase() === 'user' ? 'user' : 'opponent',
		stat: stat.toLowerCase() === 'attack' ? 'attack' : 'defense',
		effect: raises ? 'raise' : 'lower',
		stages: stages ? (WORD_NUMBERS[stages.toLowerCase()] ?? Number(stages)) : 1,
	};
};

/**
 * What a bullet point of a move's changes (in English) says: more power or a lower energy cost is a buff, the opposite a nerf, and a
 * bullet can hold several changes ("60 power and decreased chance to raise the user's Attack"). Throws on wording it does not know,
 * so that a change the page words in a new way is never filed under the wrong label or dropped.
 */
export const parseAttackChange = (line: string): Array<GblChange> => {
	// the line as the post words it, tidied; `text` is the same with plain apostrophes, to be matched
	const original = line.replace(/\s+/g, ' ').replace(/\.$/, '').trim();
	const text = original.replace(/[’‘]/g, "'");
	const unknown = () => new Error(`Unrecognised attack change: "${line}"`);

	const energy = ENERGY.exec(text);
	if (energy) {
		const [, what, change, raids] = energy;
		const increased = change.toLowerCase() === 'increased';
		const arena = raids ? 'pve' : 'pvp';
		// a move that costs more is worse, one that gives more energy is better
		return what.toLowerCase() === 'cost'
			? [
					{
						kind: 'energyCost',
						arena,
						direction: better(!increased),
						change: increased ? 'increased' : 'decreased',
					},
				]
			: [
					{
						kind: 'energyGain',
						arena,
						direction: better(increased),
						change: increased ? 'increased' : 'decreased',
					},
				];
	}

	const prefix = ARENA_PREFIX.exec(text);
	const power = prefix ? POWER.exec(text.slice(prefix[0].length)) : null;
	if (!prefix || !power) {
		throw unknown();
	}
	const arena: GblChangeArena =
		prefix[1].toLowerCase() === 'trainer battles' ? 'pvp' : 'pve';
	const [, from, to, rest] = power;
	const changes: Array<GblChange> = [];
	if (Number(from) !== Number(to)) {
		changes.push({
			kind: 'power',
			arena,
			direction: better(Number(to) > Number(from)),
			from: Number(from),
			to: Number(to),
		});
	}
	if (rest) {
		const effect = statEffect(rest, arena);
		if (!effect) {
			throw unknown();
		}
		changes.push(effect);
	}
	if (changes.length === 0) {
		throw unknown();
	}
	return changes;
};

/** What all the changes of a move add up to. */
export const attackChangeVerdict = (
	changes: ReadonlyArray<GblChange>
): GblVerdict => {
	if (changes.every((change) => change.direction === 'buff')) {
		return 'buff';
	}
	return changes.every((change) => change.direction === 'nerf')
		? 'nerf'
		: 'adjusted';
};

/** What one bullet point does: for the better, for the worse, or both ("more power and a higher energy cost"). */
export const bulletDirection = (
	changes: ReadonlyArray<GblChange>
): GblChangeDirection | 'mixed' =>
	changes.every((change) => change.direction === changes[0].direction)
		? changes[0].direction
		: 'mixed';
