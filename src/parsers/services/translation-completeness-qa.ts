import type { IRocketGrunt, PublicEvent } from '../types/events';
import type { IGameMasterMove } from '../types/pokemon';
import { AvailableLocales } from './gamemaster-translator';

export interface TranslationQaInput {
	events: Array<PublicEvent>;
	season: PublicEvent | undefined;
	moves: Record<string, IGameMasterMove>;
	rocketLineups: Array<IRocketGrunt>;
}

const ALL_LOCALES = Object.values(AvailableLocales);
const MAX_ERRORS_SHOWN = 50;

function checkAllLocalesPresent<T>(
	record: Partial<Record<AvailableLocales, T>>,
	label: string,
	errors: Array<string>
): void {
	const missing = ALL_LOCALES.filter((locale) => !(locale in record));
	if (missing.length > 0) {
		errors.push(`${label}: missing locale key(s) ${missing.join(', ')}.`);
	}
}

function checkAllLocalesNonEmptyString(
	record: Partial<Record<AvailableLocales, string>>,
	label: string,
	errors: Array<string>
): void {
	checkAllLocalesPresent(record, label, errors);
	const empty = ALL_LOCALES.filter((locale) => !record[locale]);
	if (empty.length > 0) {
		errors.push(`${label}: empty value for locale(s) ${empty.join(', ')}.`);
	}
}

/** `bonuses` is an array, so "non-empty" isn't the right bar uniformly —
 *  plenty of real events genuinely have no bonuses at all, for every locale.
 *  Only flags a locale as missing when EN itself has bonuses but that
 *  locale doesn't — the actual translation-gap shape. */
function checkBonusesComplete(
	bonuses: Partial<Record<AvailableLocales, Array<string>>>,
	label: string,
	errors: Array<string>
): void {
	checkAllLocalesPresent(bonuses, label, errors);

	const enBonuses = bonuses[AvailableLocales.en] ?? [];
	if (enBonuses.length === 0) {
		return;
	}

	const empty = ALL_LOCALES.filter(
		(locale) => (bonuses[locale]?.length ?? 0) === 0
	);
	if (empty.length > 0) {
		errors.push(
			`${label}: EN has bonuses but locale(s) ${empty.join(', ')} don't.`
		);
	}
}

function validateEvents(
	events: Array<PublicEvent>,
	errors: Array<string>
): void {
	if (events.length === 0) {
		errors.push('Events: events.json would be completely empty.');
		return;
	}

	for (const event of events) {
		const label = `Event "${event.title[AvailableLocales.en] ?? event.id}" (${event.id})`;
		checkAllLocalesNonEmptyString(event.title, `${label} title`, errors);
		checkAllLocalesNonEmptyString(event.subtitle, `${label} subtitle`, errors);
		checkBonusesComplete(event.bonuses, `${label} bonuses`, errors);
	}
}

function validateSeason(
	season: PublicEvent | undefined,
	errors: Array<string>
): void {
	if (!season) {
		errors.push('Season: season.json would be empty/undefined.');
		return;
	}

	checkAllLocalesNonEmptyString(season.title, 'Season title', errors);
	checkAllLocalesNonEmptyString(season.subtitle, 'Season subtitle', errors);
	checkBonusesComplete(season.bonuses, 'Season bonuses', errors);
}

function validateMoves(
	moves: Record<string, IGameMasterMove>,
	errors: Array<string>
): void {
	const entries = Object.values(moves);
	if (entries.length === 0) {
		errors.push('Moves: moves.json would be completely empty.');
		return;
	}

	for (const move of entries) {
		checkAllLocalesNonEmptyString(
			move.moveName,
			`Move "${move.moveId}" name`,
			errors
		);
	}
}

function validateRocketLineups(
	lineups: Array<IRocketGrunt>,
	errors: Array<string>
): void {
	if (lineups.length === 0) {
		errors.push(
			'Rocket lineups: rocket-lineups.json would be completely empty.'
		);
		return;
	}

	for (const grunt of lineups) {
		checkAllLocalesNonEmptyString(
			grunt.phrase,
			`Rocket grunt "${grunt.trainerId}" phrase`,
			errors
		);
	}
}

// Same philosophy as leekduck-data-qa.ts, one level up: that module guards
// against a scraper silently returning degraded *content*; this one guards
// against a *translation* silently going missing for one locale while every
// other locale (and the underlying content itself) is fine — e.g. exactly
// the es-MX/zh-Hant casing bug and the events/rocket-phrase missing-EN-
// fallback gap this was written to catch a regression of. Runs once per
// `generate` and throws (failing the CI job) rather than silently writing
// data with a hole in one locale.
export function validateTranslationCompleteness(
	input: TranslationQaInput
): void {
	const errors: Array<string> = [];

	validateEvents(input.events, errors);
	validateSeason(input.season, errors);
	validateMoves(input.moves, errors);
	validateRocketLineups(input.rocketLineups, errors);

	if (errors.length > 0) {
		const shown = errors.slice(0, MAX_ERRORS_SHOWN);
		const rest = errors.length - shown.length;
		throw new Error(
			`Translation completeness QA failed (${errors.length} issue${errors.length === 1 ? '' : 's'}):\n` +
				shown.map((e) => `  - ${e}`).join('\n') +
				(rest > 0 ? `\n  ...and ${rest} more` : '')
		);
	}
}
