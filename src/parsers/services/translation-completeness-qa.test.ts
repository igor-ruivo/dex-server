import { describe, expect, it } from 'vitest';

import type { IRocketGrunt, PublicEvent } from '../types/events';
import type { IGameMasterMove } from '../types/pokemon';
import { AvailableLocales } from './gamemaster-translator';
import type { TranslationQaInput } from './translation-completeness-qa';
import { validateTranslationCompleteness } from './translation-completeness-qa';

const ALL_LOCALES = Object.values(AvailableLocales);

const fullRecord = (value: string): Partial<Record<AvailableLocales, string>> =>
	Object.fromEntries(
		ALL_LOCALES.map((locale) => [locale, `${value} (${locale})`])
	);

const fullBonuses = (
	bonuses: Array<string>
): Partial<Record<AvailableLocales, Array<string>>> =>
	Object.fromEntries(ALL_LOCALES.map((locale) => [locale, bonuses]));

const makeEvent = (overrides: Partial<PublicEvent> = {}): PublicEvent => ({
	id: 'test-event',
	url: fullRecord('https://pokemongo.com/en/post/test-event'),
	source: 'pokemongo',
	imageUrl: '',
	startDate: 0,
	endDate: 0,
	wild: [],
	raids: [],
	incenses: [],
	eggs: [],
	researches: [],
	lures: [],
	isSeason: false,
	title: fullRecord('Test Event'),
	subtitle: fullRecord('Test Subtitle'),
	bonuses: fullBonuses(['+2x Stardust']),
	...overrides,
});

const makeMove = (
	overrides: Partial<IGameMasterMove> = {}
): IGameMasterMove => {
	const move: IGameMasterMove = {
		moveId: 'TEST_MOVE',
		vId: 'V0001_MOVE_TEST_MOVE',
		type: 'normal',
		isFast: false,
		isSuperMega: false,
		pvpPower: 10,
		pvpEnergy: -40,
		pvpCooldown: 1000,
		pvePower: 10,
		pveEnergy: -33,
		pveCooldown: 1000,
		moveName: fullRecord('Test Move'),
	};
	return { ...move, ...overrides };
};

const makeGrunt = (overrides: Partial<IRocketGrunt> = {}): IRocketGrunt => ({
	trainerId: 'test_grunt',
	type: undefined,
	phrase: fullRecord('Watch out!'),
	tier1: [],
	tier2: [],
	tier3: [],
	catchableTiers: [],
	...overrides,
});

const validInput = (): TranslationQaInput => ({
	events: [makeEvent()],
	season: makeEvent({ id: 'season', isSeason: true }),
	moves: { TEST_MOVE: makeMove() },
	rocketLineups: [makeGrunt()],
});

describe('validateTranslationCompleteness', () => {
	it('passes when every locale is present and non-empty across all datasets', () => {
		expect(() => validateTranslationCompleteness(validInput())).not.toThrow();
	});

	it('passes when an event genuinely has no bonuses in any locale', () => {
		const input = validInput();
		input.events = [makeEvent({ bonuses: fullBonuses([]) })];
		expect(() => validateTranslationCompleteness(input)).not.toThrow();
	});

	it('throws when an event title is missing for one locale', () => {
		const input = validInput();
		const event = makeEvent();
		delete event.title[AvailableLocales.ru];
		input.events = [event];
		expect(() => validateTranslationCompleteness(input)).toThrow(/ru/);
	});

	it('throws when an event title is empty (present but blank) for one locale', () => {
		const input = validInput();
		const event = makeEvent();
		event.title[AvailableLocales.zhHant] = '';
		input.events = [event];
		expect(() => validateTranslationCompleteness(input)).toThrow(/zh-Hant/);
	});

	it('throws when EN has bonuses but another locale does not', () => {
		const input = validInput();
		const event = makeEvent();
		event.bonuses[AvailableLocales.esMx] = [];
		input.events = [event];
		expect(() => validateTranslationCompleteness(input)).toThrow(/es-MX/);
	});

	it('throws when the season is missing entirely', () => {
		const input = validInput();
		input.season = undefined;
		expect(() => validateTranslationCompleteness(input)).toThrow(/Season/);
	});

	it('throws when a move name is missing a locale', () => {
		const input = validInput();
		const move = makeMove();
		delete move.moveName[AvailableLocales.ja];
		input.moves = { TEST_MOVE: move };
		expect(() => validateTranslationCompleteness(input)).toThrow(/TEST_MOVE/);
	});

	it('throws when a rocket grunt phrase is missing a locale', () => {
		const input = validInput();
		const grunt = makeGrunt();
		delete grunt.phrase[AvailableLocales.ko];
		input.rocketLineups = [grunt];
		expect(() => validateTranslationCompleteness(input)).toThrow(/test_grunt/);
	});

	it('throws when events/moves/lineups are all empty', () => {
		expect(() =>
			validateTranslationCompleteness({
				events: [],
				season: undefined,
				moves: {},
				rocketLineups: [],
			})
		).toThrow(/Events.*Season.*Moves.*Rocket lineups/s);
	});
});
