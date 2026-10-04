import { JSDOM } from 'jsdom';
import { describe, expect, it, vi } from 'vitest';

import HttpDataFetcher from '../../../services/data-fetcher';
import GameMasterTranslator from '../../../services/gamemaster-translator';
import BossesParser from './BossesParser';
import EggsParser from './EggsParser';
import EventsParser from './EventsParser';
import RocketLineupsParser from './RocketLineupsParser';

// The matcher is tested on its own: here it turns a name into its species id, so what is checked is which entries the
// LeekDuck parsers mark as shiny from the shiny icon of each card.
vi.mock('../../utils/pokemon-matcher', () => ({
	default: class {
		matchPokemonFromText(texts: Array<string>) {
			const seen = new Set<string>();
			return texts
				.map((text) => text.replace(/^shadow /i, '').trim())
				.filter((text) => text && !seen.has(text) && seen.add(text))
				.map((text) => ({
					speciesId: text.toLowerCase().replaceAll(' ', '_'),
					kind: '5',
					shiny: false,
				}));
		}
	},
	isPokemonResourceReference: () => false,
}));

/** A fetcher whose pages are all `html` — only `fetchText` is used by these parsers. */
class StubFetcher extends HttpDataFetcher {
	constructor(private readonly html: string) {
		super();
	}

	override fetchText(): Promise<string> {
		return Promise.resolve(this.html);
	}
}
const fetcherReturning = (html: string): HttpDataFetcher =>
	new StubFetcher(html);

/** A translator that has no phrase for any trainer. */
class StubTranslator extends GameMasterTranslator {
	constructor() {
		super(new StubFetcher(''));
	}

	override getTranslationForRocketPhrase(): string {
		return '';
	}
}

const SHINY_SVG =
	'<svg class="shiny-icon"><use href="#shiny-icon"></use></svg>';

describe('raid bosses (standing tiers)', () => {
	const card = (name: string, shiny: boolean) => `<div class="card">
		<div class="boss-img"><img src="x.png">${shiny ? SHINY_SVG : ''}</div>
		<div class="identity"><p class="name">${name}</p></div></div>`;
	const parse = (html: string) => {
		const doc = new JSDOM(`<body>${html}</body>`).window.document;
		const parser = new BossesParser({} as never, {}, {} as never);
		const pokemons: Array<{
			speciesId: string;
			shiny: boolean;
			kind?: string;
		}> = [];
		(
			parser as unknown as {
				parseTiers: (
					d: Document,
					m: unknown,
					s: Set<string>,
					p: typeof pokemons
				) => void;
			}
		).parseTiers(
			doc,
			{
				matcher: new (class {
					matchPokemonFromText(t: Array<string>) {
						return t.map((x) => ({
							speciesId: x.toLowerCase(),
							shiny: false,
							kind: '',
						}));
					}
				})(),
				prefix: '',
			},
			new Set(),
			pokemons
		);
		return pokemons;
	};

	it('flags the boss whose card has the shiny icon, and only that one', () => {
		const html = `<div class="tier"><h2 data-tier="3">Tier 3</h2>${card('Miltank', true)}${card('Machamp', false)}</div>`;
		expect(parse(html)).toEqual([
			{ speciesId: 'miltank', shiny: true, kind: '3' },
			{ speciesId: 'machamp', shiny: false, kind: '3' },
		]);
	});

	it('reads the icon of each card on its own across tiers', () => {
		const html =
			`<div class="tier"><h2 data-tier="1">Tier 1</h2>${card('Bulbasaur', false)}</div>` +
			`<div class="tier"><h2 data-tier="3">Tier 3</h2>${card('Miltank', true)}</div>`;
		expect(parse(html).map((p) => [p.speciesId, p.shiny])).toEqual([
			['bulbasaur', false],
			['miltank', true],
		]);
	});
});

describe('eggs', () => {
	const card = (name: string, shiny: boolean) =>
		`<li class="pokemon-card pokemon-card-1km"><div class="icon"><img src="x.png" alt="${name}">${
			shiny ? SHINY_SVG : ''
		}</div><span class="name">${name}</span><div class="cp-range"><span class="label">CP </span>540</div></li>`;
	const parse = async (html: string) => {
		const fetcher = fetcherReturning(html);
		const parser = new EggsParser(fetcher, {}, []);
		return parser.parse();
	};

	it('flags the Pokémon whose card has the shiny icon', async () => {
		const html = `<div class="page-content"><h2>1 km Eggs</h2><ul class="egg-grid">${card('Squirtle', true)}${card('Pidgey', false)}</ul></div>`;
		const result = await parse(html);
		expect(result.map((p) => [p.speciesId, p.shiny, p.kind])).toEqual([
			['squirtle', true, '1'],
			['pidgey', false, '1'],
		]);
	});

	it('lines each flag up with its own Pokémon when a name repeats or is unknown to the list match', async () => {
		const html = `<div class="page-content"><h2>2 km Eggs</h2><ul class="egg-grid">${card('Pidgey', false)}${card('Pidgey', true)}${card('Squirtle', true)}</ul></div>`;
		const result = await parse(html);
		expect(
			Object.fromEntries(result.map((p) => [p.speciesId, p.shiny]))
		).toEqual({ pidgey: true, squirtle: true });
	});
});

describe('rocket grunts', () => {
	const pokemon = (name: string, shiny: boolean) =>
		`<span class="shadow-pokemon-wrapper"><span class="shadow-pokemon" data-pokemon="${name}" data-type1="fighting">${
			shiny ? SHINY_SVG : ''
		}<span class="image-wrapper"><img class="pokemon-image" alt="${name}"></span></span></span>`;
	const html = `<div class="rocket-profile"><span class="name">Grunt</span><div class="lineup-info">
		<div class="slot">${pokemon('Pancham', true)}</div>
		<div class="slot">${pokemon('Sneasel', false)}</div>
		<div class="slot encounter">${pokemon('Pancham', true)}${pokemon('Larvitar', false)}</div></div></div>`;
	const gm = Object.fromEntries(
		['pancham', 'sneasel', 'larvitar'].flatMap((id) => [
			[`${id}_shadow`, {}],
			[id, {}],
		])
	);
	const parse = async () => {
		const fetcher = fetcherReturning(html);
		const translator = new StubTranslator();
		return new RocketLineupsParser(
			fetcher,
			gm as never,
			translator,
			[]
		).parse();
	};

	it('lists the shadow Pokémon that carry the shiny icon, once, across the tiers', async () => {
		const [grunt] = await parse();
		expect(grunt.tier1).toEqual(['pancham_shadow']);
		expect(grunt.shinyPokemon).toEqual(['pancham_shadow']);
	});

	it('does not list the ones without the icon', async () => {
		const [grunt] = await parse();
		expect(grunt.shinyPokemon).not.toContain('sneasel_shadow');
		expect(grunt.shinyPokemon).not.toContain('larvitar_shadow');
	});
});

describe('special raid bosses (news posts)', () => {
	const item = (name: string, shiny: boolean) =>
		`<li class="pkmn-list-item"><div class="pkmn-list-img fairy"><img src="x.png"></div>${
			shiny ? '<img class="shiny-icon" src="shiny-icon.png" alt="shiny">' : ''
		}<div class="pkmn-name">${name}</div></li>`;
	const parse = (title: string, html: string) => {
		const parser = new EventsParser(
			{} as never,
			{},
			{
				nonMegaDomain: [],
				nonShadowDomain: [],
				nonMegaNonShadowDomain: [],
			} as never,
			{}
		);
		const htmlDoc = new JSDOM(`<body>${html}</body>`).window.document;
		return (
			parser as unknown as {
				parseSpecialRaidBossEvent: (
					parsed: {
						title: string;
						date: number;
						dateEnd: number;
						htmlDoc: Document;
					},
					gm: unknown,
					url: string
				) =>
					| { raids: Array<{ speciesId: string; shiny: boolean }> }
					| undefined;
			}
		).parseSpecialRaidBossEvent(
			{ title, date: 0, dateEnd: 1, htmlDoc },
			{},
			'https://leekduck.com/events/x/'
		);
	};

	it('flags the boss whose list item has the shiny icon (Xerneas)', () => {
		const result = parse(
			'Xerneas in 5-star Raid Battles',
			`<ul>${item('Xerneas', true)}</ul>`
		);
		expect(result?.raids).toEqual([
			expect.objectContaining({ speciesId: 'xerneas', shiny: true }),
		]);
	});

	it('leaves it non-shiny without the icon', () => {
		const result = parse(
			'Xerneas in 5-star Raid Battles',
			`<ul>${item('Xerneas', false)}</ul>`
		);
		expect(result?.raids[0].shiny).toBe(false);
	});

	it('matches a Shadow or Mega boss by its name without the prefix', () => {
		const shadow = parse(
			'Shadow Mewtwo in Shadow Raids',
			`<ul>${item('Mewtwo', true)}</ul>`
		);
		expect(shadow?.raids[0].shiny).toBe(true);
		const mega = parse(
			'Mega Charizard X in Mega Raids',
			`<ul>${item('Charizard X', true)}</ul>`
		);
		expect(mega?.raids[0].shiny).toBe(true);
	});
});
