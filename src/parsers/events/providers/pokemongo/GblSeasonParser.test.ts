import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { getDomains } from '../../../pokemon/game-master-parser';
import type { GameMasterData, IGameMasterMove } from '../../../types/pokemon';
import {
	attackChangeVerdict,
	parseAttackChange,
} from '../../utils/gbl-attack-changes';
import { hasShinySparkle } from '../../utils/shiny-sparkle';
import {
	findLatestGblSlug,
	gblPictureUrls,
	parseGblSeason,
	seasonNameOf,
} from './GblSeasonParser';

/** The real "GO Battle League: Twilight Trails" post (saved as a fixture) against the real Pokémon and moves. */
const gameMaster = JSON.parse(
	fs.readFileSync(path.join(process.cwd(), 'data', 'game-master.json'), 'utf8')
) as GameMasterData;
const moves = JSON.parse(
	fs.readFileSync(path.join(process.cwd(), 'data', 'moves.json'), 'utf8')
) as Record<string, IGameMasterMove>;
const html = fs.readFileSync(
	path.join(
		__dirname,
		'__fixtures__',
		'go-battle-league-twilight-trails-en.html'
	),
	'utf8'
);

/** The post's pictures of its encounters, saved in the order of the post (the five rank-ups, then the standard ones). */
const pictureFiles = [
	...[0, 1, 2, 3, 4].map((i) => `g${i}`),
	...Array.from({ length: 16 }, (_, i) => `s${i}`),
];
const readPicture = (name: string) =>
	fs.readFileSync(
		path.join(
			__dirname,
			'__fixtures__',
			'go-battle-league-twilight-trails',
			`${name}.png`
		)
	);
const shinyByUrl = new Map(
	gblPictureUrls(html).map((url, i) => [
		url,
		hasShinySparkle(readPicture(pictureFiles[i])),
	])
);

const ptBrHtml = fs.readFileSync(
	path.join(
		__dirname,
		'__fixtures__',
		'go-battle-league-twilight-trails-pt_br.html'
	),
	'utf8'
);

const parse = (source = html) =>
	parseGblSeason({
		slug: 'go-battle-league-twilight-trails',
		html: source,
		shinyOf: (url) => shinyByUrl.get(url) ?? false,
		gameMaster,
		domain: getDomains(gameMaster).allDomain,
		moves,
	});

describe('parseAttackChange', () => {
	it('reads a power change and the change to the chance of a stat effect in the same bullet point', () => {
		expect(
			parseAttackChange(
				'Trainer Battles: 45 → 60 power and decreased chance to increase user’s Attack by one stage.'
			)
		).toEqual([
			{ kind: 'power', arena: 'pvp', direction: 'buff', from: 45, to: 60 },
			{
				kind: 'buffChance',
				arena: 'pvp',
				direction: 'nerf',
				chance: 'decreased',
				target: 'user',
				stat: 'attack',
				effect: 'raise',
				stages: 1,
			},
		]);
	});

	it('judges a guaranteed stat effect by whom it helps', () => {
		const [, raise] = parseAttackChange(
			'Trainer Battles: 60 → 80 power and guaranteed chance to raise the user’s Defense one stage.'
		);
		const [, lower] = parseAttackChange(
			'Trainer Battles: 45 → 80 power and guaranteed chance to decrease the opponent’s Defense by one stage.'
		);
		const [, drawback] = parseAttackChange(
			'Trainer Battles: 70 → 85 power and guaranteed chance to decrease the user’s Defense by one stage.'
		);
		expect(raise.direction).toBe('buff');
		expect(lower.direction).toBe('buff');
		expect(drawback.direction).toBe('nerf');
	});

	it('tells the arena and the direction of energy changes', () => {
		expect(parseAttackChange('Energy cost increased')).toMatchObject([
			{ kind: 'energyCost', arena: 'pvp', direction: 'nerf' },
		]);
		expect(
			parseAttackChange('Energy cost decreased in Gyms and Raid Battles')
		).toMatchObject([{ kind: 'energyCost', arena: 'pve', direction: 'buff' }]);
		expect(parseAttackChange('Energy generation increased')).toMatchObject([
			{ kind: 'energyGain', arena: 'pvp', direction: 'buff' },
		]);
	});

	it('reads a power change that does not say "power"', () => {
		expect(parseAttackChange('Trainer Battles: 45 → 50')).toMatchObject([
			{ kind: 'power', from: 45, to: 50 },
		]);
	});

	it('throws on wording it does not know', () => {
		expect(() => parseAttackChange('Now glows in the dark')).toThrow(
			/Unrecognised attack change/
		);
		expect(() =>
			parseAttackChange('Trainer Battles: 45 → 60 power and makes a sound')
		).toThrow(/Unrecognised attack change/);
	});

	it('calls a move adjusted when it gains and loses', () => {
		expect(
			attackChangeVerdict(parseAttackChange('Energy cost decreased'))
		).toBe('buff');
		expect(
			attackChangeVerdict(parseAttackChange('Trainer Battles: 100 → 90'))
		).toBe('nerf');
		expect(
			attackChangeVerdict([
				...parseAttackChange('Trainer Battles: 110 → 90 power'),
				...parseAttackChange('Energy cost decreased'),
			])
		).toBe('adjusted');
	});
});

describe('parseGblSeason (Twilight Trails)', () => {
	const season = parse();

	it('names the season and the post', () => {
		expect(season.slug).toBe('go-battle-league-twilight-trails');
		expect(season.name.en).toBe('Twilight Trails');
		// a language without a post of its own shows the English name
		expect(season.name.pt_br).toBe('Twilight Trails');
		// the post's own picture, found as the other news posts' are
		expect(season.imageUrl).toMatch(
			/^https:\/\/lh3\.googleusercontent\.com\/jRv78WS9N3uii/
		);
	});

	it('reads the reward encounters, with the rank each is met at', () => {
		expect(season.rankUpEncounters.map((e) => [e.speciesId, e.rank])).toEqual([
			['toxtricity', 1],
			['dondozo', 2000],
			['kingdra', 2500],
			['duraludon', 2750],
			['pikachu', 3000],
		]);
		expect(season.standardEncounters).toHaveLength(15);
		expect(season.standardEncounters.map((e) => e.rank)).toEqual([
			1, 1, 1, 1, 1, 6, 6, 11, 11, 11, 11, 16, 16, 16, 16,
		]);
		expect(season.standardEncounters.map((e) => e.speciesId)).toContain(
			'voltorb_hisuian'
		);
		expect(season.legendarySurprise).toEqual({ rank: 20 });
	});

	it('knows which Pokémon can be shiny from the sparkle on their pictures', () => {
		const notShiny = [...season.rankUpEncounters, ...season.standardEncounters]
			.filter((e) => !e.shiny)
			.map((e) => e.speciesId);
		// the post shows no sparkle for these two
		expect(notShiny).toEqual(['mimikyu', 'cramorant']);
	});

	it('fails when the encounters are not the ones whose ranks are known', () => {
		// a sixth rank-up encounter
		expect(() =>
			parse(
				html.replace(
					'>Dondozo<',
					'>Dondozo</div></div><div><div><div><img src="https://x/y.png"></div></div><div class="_pokemonImageGridBlockGridPokemonCaption_x">Kingdra<'
				)
			)
		).toThrow(/rank-up encounters/);
	});

	it('labels the attack changes', () => {
		const verdict = (moveId: string) =>
			season.attackChanges.find((c) => c.moveId === moveId)?.verdict;
		expect(season.attackChanges).toHaveLength(27);
		expect(verdict('IRON_HEAD')).toBe('buff');
		expect(verdict('SHADOW_BALL')).toBe('nerf');
		expect(verdict('MOONBLAST')).toBe('adjusted');
		expect(verdict('BULLDOZE')).toBe('adjusted');
		// one direction per bullet point of the English post: Air Cutter gains power but loses a chance, then costs more
		expect(
			season.attackChanges.find((c) => c.moveId === 'AIR_CUTTER')?.directions
		).toEqual(['mixed', 'nerf']);
	});

	it('keeps the English wording of the changes of each move, the old value struck through', () => {
		const airCutter = season.attackChanges.find(
			(c) => c.moveId === 'AIR_CUTTER'
		);
		expect(airCutter?.text.en[0].runs).toEqual([
			{ text: 'Trainer Battles: ' },
			{ text: '45', strike: true },
			{
				text: ' → 60 power and decreased chance to increase user’s Attack by one stage.',
			},
		]);
		expect(airCutter?.text.en[1].runs).toEqual([
			{ text: 'Energy cost increased' },
		]);
		// a language without a post of its own shows the English text
		expect(airCutter?.text.de).toEqual(airCutter?.text.en);
	});

	it('takes the wording of each language from its own post', () => {
		const localized = parseGblSeason({
			slug: 'go-battle-league-twilight-trails',
			html,
			localizedHtml: { pt_br: ptBrHtml },
			shinyOf: () => true,
			gameMaster,
			domain: getDomains(gameMaster).allDomain,
			moves,
		});
		const airCutter = localized.attackChanges.find(
			(c) => c.moveId === 'AIR_CUTTER'
		);
		expect(airCutter?.text.pt_br[0].runs).toEqual([
			{ text: 'Batalhas de Treinador: ' },
			{ text: '45', strike: true },
			{
				text: ' → 60 pontos e menor chance de aumentar o ataque do usuário em um estágio.',
			},
		]);
		expect(airCutter?.text.pt_br[1].runs[0].text).toBe(
			'Aumento do custo de energia'
		);
		// the other languages are untouched
		expect(airCutter?.text.fr).toEqual(airCutter?.text.en);
	});

	it('shows the English text for a language whose post does not have the same moves', () => {
		const localized = parseGblSeason({
			slug: 'go-battle-league-twilight-trails',
			html,
			localizedHtml: {
				pt_br:
					'<div><h2>Liga de Batalha GO: X</h2><div id="rewards"></div></div>',
			},
			shinyOf: () => true,
			gameMaster,
			domain: getDomains(gameMaster).allDomain,
			moves,
		});
		expect(localized.attackChanges[0].text.pt_br).toEqual(
			localized.attackChanges[0].text.en
		);
	});

	it('reads which Pokémon learn which moves, once per pair', () => {
		expect(season.attackAvailability).toContainEqual({
			speciesId: 'miltank',
			moveId: 'HIGH_HORSEPOWER',
		});
		// the same fast move name can be a charged move too: the sentence says which
		expect(season.attackAvailability).toContainEqual({
			speciesId: 'audino',
			moveId: 'CHARGE_BEAM',
		});
		// Toxtricity's two forms are one species here
		expect(
			season.attackAvailability.filter(
				(a) => a.speciesId === 'toxtricity' && a.moveId === 'SWIFT'
			)
		).toHaveLength(1);
		expect(season.attackAvailability).toHaveLength(41);
	});

	it('fails on a Pokémon it cannot name', () => {
		expect(() => parse(html.replace('>Dondozo<', '>Nonexistomon<'))).toThrow(
			/Cannot match the Pokémon "Nonexistomon"/
		);
		// ... in the attack availability too
		expect(() => parse(html.replace('>Miltank<', '>Nonexistomon<'))).toThrow(
			/Cannot match the Pokémon "Nonexistomon"/
		);
	});

	it('fails on a move it cannot name', () => {
		expect(() =>
			parse(html.replace('Attack High Horsepower.', 'Attack Moonshot Blast.'))
		).toThrow(/Cannot match the move "Moonshot Blast"/);
		expect(() =>
			parse(html.replace('>Air Cutter<', '>Moonshot Blast<'))
		).toThrow(/Cannot match the move "Moonshot Blast"/);
	});

	it('fails on a change it does not understand', () => {
		expect(() =>
			parse(
				html.replace('Energy cost decreased</li>', 'Glows in the dark</li>')
			)
		).toThrow(/Unrecognised attack change/);
	});
});

describe('seasonNameOf', () => {
	const post = (heading: string) =>
		`<div><h2>${heading}</h2><div id="rewards"></div></div>`;

	it('reads the season from the heading of a post, however its language writes it', () => {
		expect(seasonNameOf(post('GO Battle League: Twilight Trails'))).toBe(
			'Twilight Trails'
		);
		expect(
			seasonNameOf(post('Liga de Batalha GO: Trilhas do Entardecer'))
		).toBe('Trilhas do Entardecer');
		expect(
			seasonNameOf(post('Ligue Combat GO : Sentiers crépusculaires'))
		).toBe('Sentiers crépusculaires');
		expect(seasonNameOf(post('GO बैटल लीग - संध्या की सैर'))).toBe(
			'संध्या की सैर'
		);
		expect(seasonNameOf(post('「GOバトルリーグ：黄昏の旅路」の最新情報'))).toBe(
			'黄昏の旅路'
		);
		expect(seasonNameOf(post('GO對戰聯盟：黃昏之旅'))).toBe('黃昏之旅');
	});

	it('has none for a missing post or a heading without a season', () => {
		expect(seasonNameOf(undefined)).toBeUndefined();
		expect(seasonNameOf('')).toBeUndefined();
		expect(seasonNameOf(post('Rewards'))).toBeUndefined();
	});

	it('is used for each language that has a post', () => {
		const season = parseGblSeason({
			slug: 'go-battle-league-twilight-trails',
			html,
			localizedHtml: {
				pt_br: post('Liga de Batalha GO: Trilhas do Entardecer'),
			},
			shinyOf: () => true,
			gameMaster,
			domain: getDomains(gameMaster).allDomain,
			moves,
		});
		expect(season.name.pt_br).toBe('Trilhas do Entardecer');
		expect(season.name.de).toBe('Twilight Trails');
	});
});

describe('findLatestGblSlug', () => {
	const card = (slug: string, timestamp: number) =>
		`<a href="/news/${slug}"><pg-date-format timestamp="${timestamp}"></pg-date-format></a>`;
	const listing = (pages: Array<Array<string>>) => (url: string) => {
		const offset = Number(new URL(url).searchParams.get('nr'));
		// past the last page the listing keeps showing the last one
		const page = pages[Math.min(offset / 30, pages.length - 1)];
		return Promise.resolve(`<html><body>${page.join('')}</body></html>`);
	};

	it('finds a post that is not on the first page, and takes the newest', async () => {
		const slug = await findLatestGblSlug(
			listing([
				[card('into-the-wild-2026', 300), card('halloween-2026', 290)],
				[
					card('go-battle-league-twilight-trails', 200),
					card('go-battle-league-forever-forward', 100),
				],
				[card('go-battle-league-memories-in-motion', 50)],
			])
		);
		expect(slug).toBe('go-battle-league-twilight-trails');
	});

	it('fails when there is no such post', async () => {
		await expect(
			findLatestGblSlug(listing([[card('into-the-wild-2026', 300)]]))
		).rejects.toThrow(/No "go-battle-league/);
	});
});
