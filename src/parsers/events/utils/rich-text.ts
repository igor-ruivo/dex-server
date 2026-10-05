import type { RichBlock, RichRun } from '../../types/rich-text';

const SITE = 'https://pokemongo.com';
const SKIPPED = new Set([
	'STYLE',
	'SCRIPT',
	'IFRAME',
	'IMG',
	'PICTURE',
	'SVG',
	'FIGURE',
]);
const LISTS = new Set(['UL', 'OL']);
/** What makes an element a block of its own rather than text running on inside a line. */
const BLOCKS = new Set([
	'P',
	'DIV',
	'UL',
	'OL',
	'LI',
	'SECTION',
	'ARTICLE',
	'H1',
	'H2',
	'H3',
	'H4',
	'H5',
	'H6',
	'BLOCKQUOTE',
	'TABLE',
]);
const HEADINGS = new Set(['H1', 'H2', 'H3', 'H4', 'H5', 'H6']);
/** A paragraph that starts with one of these is a remark about the text above it. */
const NOTE_START = /^[*†‡]/;

const absolute = (href: string | null): string | undefined => {
	if (!href) {
		return undefined;
	}
	if (/^https?:\/\//i.test(href)) {
		return href;
	}
	return href.startsWith('/') ? `${SITE}${href}` : undefined;
};

type Style = { bold: boolean; italic: boolean; href: string | undefined };

/** The runs of the text inside a node, each with the bold / italic / link it is under. Whitespace is collapsed as in a page. */
const inlineRuns = (
	nodes: ReadonlyArray<Node>,
	style: Style = { bold: false, italic: false, href: undefined }
): Array<RichRun> => {
	const runs: Array<RichRun> = [];
	for (const node of nodes) {
		if (node.nodeType === 3) {
			const text = (node.textContent ?? '').replace(/\s+/g, ' ');
			if (text) {
				runs.push({
					text,
					...(style.bold ? { bold: true as const } : {}),
					...(style.italic ? { italic: true as const } : {}),
					...(style.href ? { href: style.href } : {}),
				});
			}
			continue;
		}
		if (node.nodeType !== 1) {
			continue;
		}
		const el = node as Element;
		if (SKIPPED.has(el.tagName.toUpperCase())) {
			continue;
		}
		if (el.tagName === 'BR') {
			runs.push({ text: '\n' });
			continue;
		}
		const tag = el.tagName.toUpperCase();
		runs.push(
			...inlineRuns(Array.from(el.childNodes), {
				bold: style.bold || tag === 'STRONG' || tag === 'B',
				italic: style.italic || tag === 'EM' || tag === 'I',
				href:
					tag === 'A'
						? (absolute(el.getAttribute('href')) ?? style.href)
						: style.href,
			})
		);
	}
	return runs;
};

/** The runs of a line, tidied: neighbours with the same look joined, the edges trimmed and the empty ones dropped. */
const tidy = (runs: ReadonlyArray<RichRun>): Array<RichRun> => {
	const merged: Array<RichRun> = [];
	for (const run of runs) {
		const last = merged[merged.length - 1];
		if (
			last &&
			!!last.bold === !!run.bold &&
			!!last.italic === !!run.italic &&
			last.href === run.href
		) {
			last.text += run.text;
		} else {
			merged.push({ ...run });
		}
	}
	// a space next to a line break is not shown; the line's own ends are trimmed
	for (const run of merged) {
		run.text = run.text.replace(/ *\n */g, '\n');
	}
	if (merged.length > 0) {
		merged[0].text = merged[0].text.replace(/^\s+/, '');
		merged[merged.length - 1].text = merged[merged.length - 1].text.replace(
			/\s+$/,
			''
		);
	}
	return merged.filter((run) => run.text !== '');
};

const textOf = (runs: ReadonlyArray<RichRun>) =>
	runs.map((r) => r.text).join('');

const pushBlock = (
	blocks: Array<RichBlock>,
	kind: RichBlock['kind'],
	runs: Array<RichRun>,
	extra: Pick<RichBlock, 'level' | 'ordered'> = {}
) => {
	const tidied = tidy(runs);
	if (tidied.length === 0) {
		return;
	}
	const noteLike = kind === 'text' && NOTE_START.test(textOf(tidied));
	blocks.push({ kind: noteLike ? 'note' : kind, runs: tidied, ...extra });
};

const readList = (list: Element, level: number, blocks: Array<RichBlock>) => {
	const ordered = list.tagName === 'OL';
	for (const item of Array.from(list.children)) {
		if (item.tagName !== 'LI') {
			continue;
		}
		// the item's own text, then the lists nested in it
		const own: Array<Node> = [];
		const nested: Array<Element> = [];
		for (const child of Array.from(item.childNodes)) {
			if (child.nodeType === 1 && LISTS.has((child as Element).tagName)) {
				nested.push(child as Element);
			} else {
				own.push(child);
			}
		}
		pushBlock(blocks, 'item', inlineRuns(own), {
			level,
			...(ordered ? { ordered: true as const } : {}),
		});
		nested.forEach((inner) => readList(inner, level + 1, blocks));
	}
};

const readNodes = (nodes: ReadonlyArray<Node>, blocks: Array<RichBlock>) => {
	// loose text and inline elements between blocks make a paragraph of their own
	let loose: Array<Node> = [];
	const flush = () => {
		pushBlock(blocks, 'text', inlineRuns(loose));
		loose = [];
	};
	for (const node of nodes) {
		if (node.nodeType !== 1) {
			loose.push(node);
			continue;
		}
		const el = node as Element;
		const tag = el.tagName.toUpperCase();
		if (SKIPPED.has(tag)) {
			continue;
		}
		if (!BLOCKS.has(tag)) {
			loose.push(el);
			continue;
		}
		flush();
		if (LISTS.has(tag)) {
			readList(el, 0, blocks);
		} else if (HEADINGS.has(tag)) {
			pushBlock(blocks, 'heading', inlineRuns(Array.from(el.childNodes)));
		} else if (tag === 'LI') {
			pushBlock(blocks, 'item', inlineRuns(Array.from(el.childNodes)), {
				level: 0,
			});
		} else if (tag === 'P') {
			pushBlock(blocks, 'text', inlineRuns(Array.from(el.childNodes)));
		} else if (/footnote/i.test(el.getAttribute('class') ?? '')) {
			const runs = inlineRuns(Array.from(el.childNodes));
			pushBlock(blocks, 'note', runs);
		} else {
			readNodes(Array.from(el.childNodes), blocks);
		}
	}
	flush();
};

/**
 * The formatting of a piece of a post, as blocks: paragraphs, bullet points (with how deep they are nested), footnotes and
 * headings, each with its bold, italic and link runs. Nothing of the page's own markup or styling is kept, only what the text
 * says in its own way.
 */
export const parseRichBlocks = (
	nodes: ReadonlyArray<Node>
): Array<RichBlock> => {
	const blocks: Array<RichBlock> = [];
	readNodes(nodes, blocks);
	return blocks;
};

/** The plain lines of some blocks, one per block (a bullet point or a paragraph each). */
export const richBlocksToLines = (
	blocks: ReadonlyArray<RichBlock>
): Array<string> =>
	blocks.map((block) => textOf(block.runs).replace(/\n/g, ' '));
