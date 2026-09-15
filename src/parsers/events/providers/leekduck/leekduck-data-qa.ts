import type { IEntry, IRocketGrunt } from '../../../types/events';
import { PokemonTypes } from '../../../types/pokemon';
import type { ILeekduckSpecialRaidBoss, ILeekduckSpotlightHour } from './EventsParser';

export interface LeekduckQaInput {
	eggs: Array<IEntry>;
	rocketLineups: Array<IRocketGrunt>;
	raidBosses: Array<IEntry>;
	specialRaidBosses: Array<ILeekduckSpecialRaidBoss>;
	spotlightHours: Array<ILeekduckSpotlightHour>;
}

// Standard egg distances LeekDuck has always listed. If any of these ever
// comes up genuinely empty on the live page (not just a scraper bug), drop
// it from this list rather than disabling the check outright.
const EXPECTED_EGG_KINDS = ['1', '2', '5', '7', '10', '12'];

const ROCKET_LEADER_NAMES = ['giovanni', 'cliff', 'arlo', 'sierra'];

const isShadowSpeciesId = (speciesId: string) => speciesId.endsWith('_shadow');

function validateEggs(eggs: Array<IEntry>, errors: Array<string>) {
	if (eggs.length === 0) {
		errors.push('Eggs: leekduck-eggs.json would be completely empty.');
		return;
	}

	const countByKind = new Map<string, number>();
	for (const egg of eggs) {
		const kind = egg.kind ?? '';
		countByKind.set(kind, (countByKind.get(kind) ?? 0) + 1);
	}

	for (const kind of EXPECTED_EGG_KINDS) {
		if (!countByKind.get(kind)) {
			errors.push(`Eggs: expected "${kind}km" eggs to have at least one Pokemon, found none.`);
		}
	}
}

function validateRocketLineups(lineups: Array<IRocketGrunt>, errors: Array<string>) {
	if (lineups.length === 0) {
		errors.push('Rocket lineups: rocket-lineups.json would be completely empty.');
		return;
	}

	for (const grunt of lineups) {
		const total = grunt.tier1.length + grunt.tier2.length + grunt.tier3.length;
		if (total === 0) {
			errors.push(`Rocket lineups: "${grunt.trainerId}" has no Pokemon in any tier.`);
		}
	}

	for (const leader of ROCKET_LEADER_NAMES) {
		const found = lineups.some((g) => g.trainerId.toLocaleLowerCase().includes(leader));
		if (!found) {
			errors.push(`Rocket lineups: missing the "${leader}" leader lineup.`);
		}
	}

	const genericLower = lineups.filter(
		(g) =>
			!g.type &&
			g.trainerId.toLocaleLowerCase().includes('grunt') &&
			!ROCKET_LEADER_NAMES.some((leader) => g.trainerId.toLocaleLowerCase().includes(leader))
	);
	if (!genericLower.some((g) => /male grunt/i.test(g.trainerId) && !/female/i.test(g.trainerId))) {
		errors.push('Rocket lineups: missing the generic (typeless) Male Grunt.');
	}
	if (!genericLower.some((g) => /female grunt/i.test(g.trainerId))) {
		errors.push('Rocket lineups: missing the generic (typeless) Female Grunt.');
	}

	const waterGruntCount = lineups.filter((g) => g.type === 'water').length;
	if (waterGruntCount < 2) {
		errors.push(
			`Rocket lineups: expected 2 Water-type grunts (male + female), found ${waterGruntCount}.`
		);
	}

	const typesCovered = new Set(lineups.map((g) => g.type).filter((t): t is string => !!t));
	for (const type of Object.values(PokemonTypes)) {
		if (!typesCovered.has(type.toLocaleLowerCase())) {
			errors.push(`Rocket lineups: no grunt found for type "${type}".`);
		}
	}
}

function validateRaidBosses(raidBosses: Array<IEntry>, errors: Array<string>) {
	if (raidBosses.length === 0) {
		errors.push('Raid bosses: leekduck-raid-bosses.json would be completely empty.');
		return;
	}

	for (const tier of ['1', '3']) {
		for (const shadow of [false, true]) {
			const found = raidBosses.some(
				(e) => e.kind === tier && isShadowSpeciesId(e.speciesId) === shadow
			);
			if (!found) {
				errors.push(
					`Raid bosses: missing ${shadow ? 'Shadow' : 'non-Shadow'} tier ${tier} bosses.`
				);
			}
		}
	}
}

function validateSpecialRaidBosses(
	specialRaidBosses: Array<ILeekduckSpecialRaidBoss>,
	errors: Array<string>
) {
	if (specialRaidBosses.length === 0) {
		errors.push('Special raid bosses: leekduck-special-raid-bosses.json would be completely empty.');
		return;
	}

	for (const boss of specialRaidBosses) {
		if (boss.raids.length === 0) {
			const title = boss.title.en ?? boss.rawUrl;
			errors.push(`Special raid bosses: "${title}" has no Pokemon matched.`);
		}
	}

	const allRaids = specialRaidBosses.flatMap((b) => b.raids);
	for (const kind of ['mega', '5']) {
		if (!allRaids.some((r) => r.kind === kind)) {
			errors.push(`Special raid bosses: no "${kind}" raid bosses found.`);
		}
	}
}

function validateSpotlightHours(spotlightHours: Array<ILeekduckSpotlightHour>, errors: Array<string>) {
	if (spotlightHours.length === 0) {
		errors.push('Spotlight hours: spotlight-hours.json would be completely empty.');
		return;
	}

	for (const spotlight of spotlightHours) {
		if (spotlight.pokemons.length === 0) {
			const title = spotlight.title.en ?? spotlight.rawUrl;
			errors.push(`Spotlight hours: "${title}" has no Pokemon matched.`);
		}
	}
}

// Guards against LeekDuck silently breaking any of our scrapers (HTML/class
// reshuffles, id renames, etc.) by asserting the shape of a healthy dataset:
// every source that's always populated on the live site must still be
// populated in what we're about to write. This runs once per `generate` and
// throws (failing the CI job, skipping the commit, firing the Discord
// webhook) rather than silently writing degraded data.
export function validateLeekduckData(input: LeekduckQaInput): void {
	const errors: Array<string> = [];

	validateEggs(input.eggs, errors);
	validateRocketLineups(input.rocketLineups, errors);
	validateRaidBosses(input.raidBosses, errors);
	validateSpecialRaidBosses(input.specialRaidBosses, errors);
	validateSpotlightHours(input.spotlightHours, errors);

	if (errors.length > 0) {
		throw new Error(
			`LeekDuck data QA failed (${errors.length} issue${errors.length === 1 ? '' : 's'}):\n` +
				errors.map((e) => `  - ${e}`).join('\n')
		);
	}
}
