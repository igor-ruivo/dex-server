import { createHash } from 'crypto';

import type { IDataFetcher } from '../services/data-fetcher';
import type { BasePokemon } from '../types/pokemon';
import type { PvPokeMove, SimulatorStatus } from '../types/teams';
import { PVPOKE_SRC_URL } from './config';

/**
 * go-pokedex re-implements PvPoke's battle simulator (Battle, ActionLogic,
 * Pokemon, DamageCalculator) and the Team Builder's threat scoring (TeamRanker,
 * TeamInterface) in TypeScript. That port is only trustworthy while those
 * upstream files are unchanged — so each run fingerprints them.
 *
 * When this list or a hash needs updating: diff the changed file against the
 * previous version, port whatever affects results into go-pokedex's
 * `src/lib/pvp-sim/`, re-run its parity script (`scripts/pvp-sim-parity`), and
 * only then paste the new SHA-256 (of the file with `\r` stripped) here.
 */
export const VERIFIED_SIMULATOR_SOURCES: Record<string, string> = {
	'js/battle/Battle.js':
		'5b5a981aa8f552f425bf415b0b56726c8fbe66e17437d8f209d993f3d4a2bdb9',
	'js/battle/actions/ActionLogic.js':
		'3847c2329c86b6bfe843f06d4b1c3b680155eb2ef8bdce65706727712cdf94e4',
	'js/pokemon/Pokemon.js':
		'3270783ce337ba748a2596a5ae9ae71d9fe07c2a6b6facfe32ffbd6c14139927',
	'js/battle/DamageCalculator.js':
		'557b9345367a272e7822b47d346b67ae05d4124050e9d3876fb2446246915f31',
	'js/battle/rankers/TeamRanker.js':
		'e5e7b41014a1db8e46bebd0ab52f406670904f6d0c5495a11229dfed99eac42e',
	'js/interface/TeamInterface.js':
		'948da83d483601877465b702e92f78b9d09746399694beee32274739696e0869',
};

/** Mechanics the simulator port knows how to run. Anything else in PvPoke's data is flagged. */
const KNOWN_FORM_TRIGGERS = new Set([
	'activate_shield',
	'activate_charged',
	'charged_move',
	'charged_move_damage',
	'none',
]);
const KNOWN_FORM_EFFECTS = new Set(['protect']);
const KNOWN_MOVE_TAGS = new Set([
	'instant',
	'ignoresFaint',
	'uneditable',
	'unlisted',
]);
const KNOWN_BUFF_TARGETS = new Set(['self', 'opponent', 'both']);
const KNOWN_DAMAGE_METHODS = new Set(['default', 'percentMaxHP']);

const sha256 = (text: string) =>
	createHash('sha256').update(text.replace(/\r/g, '')).digest('hex');

/** Which of PvPoke's simulator source files no longer match the version go-pokedex's port was verified against. */
export const findChangedSimulatorSources = async (
	dataFetcher: IDataFetcher
): Promise<Array<string>> => {
	const changed: Array<string> = [];
	await Promise.all(
		Object.entries(VERIFIED_SIMULATOR_SOURCES).map(async ([file, hash]) => {
			const text = await dataFetcher.fetchText(`${PVPOKE_SRC_URL}/${file}`);
			if (!text || sha256(text) !== hash) changed.push(file);
		})
	);
	return changed.sort();
};

/** Battle mechanics present in PvPoke's data that the port has no implementation for. */
export const findUnknownMechanics = (
	moves: ReadonlyArray<PvPokeMove>,
	pokemon: ReadonlyArray<BasePokemon>
): Array<string> => {
	const issues = new Set<string>();

	for (const move of moves) {
		for (const tag of move.tags ?? []) {
			if (!KNOWN_MOVE_TAGS.has(tag))
				issues.add(`move tag "${tag}" (${move.moveId})`);
		}
		if (move.buffTarget && !KNOWN_BUFF_TARGETS.has(move.buffTarget)) {
			issues.add(`buff target "${move.buffTarget}" (${move.moveId})`);
		}
		if (move.damageMethod && !KNOWN_DAMAGE_METHODS.has(move.damageMethod)) {
			issues.add(`damage method "${move.damageMethod}" (${move.moveId})`);
		}
	}

	for (const p of pokemon) {
		const change = p.formChange;
		if (!change) continue;
		if (!KNOWN_FORM_TRIGGERS.has(change.trigger)) {
			issues.add(`form-change trigger "${change.trigger}" (${p.speciesId})`);
		}
		if (change.effect && !KNOWN_FORM_EFFECTS.has(change.effect)) {
			issues.add(`form-change effect "${change.effect}" (${p.speciesId})`);
		}
	}

	return [...issues].sort();
};

export const buildSimulatorStatus = (
	changedSources: ReadonlyArray<string>,
	unknownMechanics: ReadonlyArray<string>
): SimulatorStatus => ({
	verified: changedSources.length === 0 && unknownMechanics.length === 0,
	changedSources: [...changedSources],
	unknownMechanics: [...unknownMechanics],
});

/** Throws (failing the data-generation run, and so raising the daily alert) unless the simulator is verified. */
export const assertSimulatorVerified = (status: SimulatorStatus): void => {
	if (status.verified) return;
	throw new Error(
		[
			"PvPoke's battle simulator changed or uses a mechanic go-pokedex's Teams port doesn't implement.",
			status.changedSources.length
				? `Changed sources: ${status.changedSources.join(', ')}`
				: '',
			status.unknownMechanics.length
				? `Unknown mechanics: ${status.unknownMechanics.join('; ')}`
				: '',
			"Port the change, re-run go-pokedex's pvp-sim:parity, regenerate its golden fixture, then update the hashes in simulator-guard.ts.",
		]
			.filter(Boolean)
			.join('\n')
	);
};
