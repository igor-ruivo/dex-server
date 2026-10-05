import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';

import { parseRichBlocks, richBlocksToLines } from './rich-text';

const blocksOf = (html: string) =>
	parseRichBlocks(
		Array.from(
			new JSDOM(`<body>${html}</body>`).window.document.body.childNodes
		)
	);

describe('the formatting of a post text', () => {
	it('keeps bullet points, then the asterisk remark under them as a note (a Community Day’s bonuses)', () => {
		const blocks = blocksOf(`<ul>
<li>3× XP for catching Pokémon.</li>
<li>Lure Modules will last for one hour and may attract the featured Pokémon.*</li>
</ul>
<p>*While most bonuses are only active during the three-hour event period, these will be active from 2:00 p.m. to 9:00 p.m. local time.</p>`);
		expect(blocks).toEqual([
			{
				kind: 'item',
				level: 0,
				runs: [{ text: '3× XP for catching Pokémon.' }],
			},
			{
				kind: 'item',
				level: 0,
				runs: [
					{
						text: 'Lure Modules will last for one hour and may attract the featured Pokémon.*',
					},
				],
			},
			{
				kind: 'note',
				runs: [
					{
						text: '*While most bonuses are only active during the three-hour event period, these will be active from 2:00 p.m. to 9:00 p.m. local time.',
					},
				],
			},
		]);
	});

	it('keeps bold, italics and links, and how deep a nested bullet point is', () => {
		const blocks = blocksOf(
			`<ul><li><strong>Raids</strong>: see <a href="/map">the map</a><ul><li><em>Mega</em> raids</li></ul></li></ul>`
		);
		expect(blocks).toEqual([
			{
				kind: 'item',
				level: 0,
				runs: [
					{ text: 'Raids', bold: true },
					{ text: ': see ' },
					{ text: 'the map', href: 'https://pokemongo.com/map' },
				],
			},
			{
				kind: 'item',
				level: 1,
				runs: [{ text: 'Mega', italic: true }, { text: ' raids' }],
			},
		]);
	});

	it('marks a numbered list as ordered, and keeps a footnote div (Max Monday) as a note', () => {
		const blocks = blocksOf(
			`<ol><li>One</li></ol><div><div class="size:footnote _size:footnote_1">*Only in the morning.</div></div>`
		);
		expect(blocks).toEqual([
			{ kind: 'item', level: 0, ordered: true, runs: [{ text: 'One' }] },
			{ kind: 'note', runs: [{ text: '*Only in the morning.' }] },
		]);
	});

	it('reads a heading, a paragraph with a line break, and drops the page’s own markup', () => {
		const blocks = blocksOf(
			`<h3>Bonuses</h3><p>First line<br>Second <span class="x">line</span></p><style>.a{}</style>`
		);
		expect(blocks).toEqual([
			{ kind: 'heading', runs: [{ text: 'Bonuses' }] },
			{ kind: 'text', runs: [{ text: 'First line\nSecond line' }] },
		]);
		expect(richBlocksToLines(blocks)).toEqual([
			'Bonuses',
			'First line Second line',
		]);
	});
});
