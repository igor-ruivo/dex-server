import type { IMilestoneBonuses, IMilestoneTier } from '../../types/events';
import type { RichBlock } from '../../types/rich-text';
import { parseRichBlocks } from './rich-text';

/** The title of the milestone bonuses when the page does not give one in its own language. */
export const MILESTONE_TITLE = 'Major Milestone Bonuses';

const COLOR = /#[0-9a-f]{3,8}\b/i;

/** The two colours a card's header goes from, as the card's style gives them (`--title-background-color-1` and `-2`). */
const colorsOf = (style: string): [string, string] | undefined => {
	const first = COLOR.exec(
		style.split('--title-background-color-1:')[1] ?? ''
	)?.[0];
	const second = COLOR.exec(
		style.split('--title-background-color-2:')[1] ?? ''
	)?.[0];
	return first && second ? [first, second] : undefined;
};

/**
 * The major milestone bonuses of a season page (the `bonus-cards` block): one card per tier, each with its tier ("Tier 1"), the
 * rank that earns it ("Rank 25"), the bonuses it gives (kept as formatted blocks) and the colours of its header. Texts are as the
 * page writes them, in the language of the page. None when the block is not there or has no card.
 */
export const parseMilestoneBonuses = (
	doc: Document
): IMilestoneBonuses | undefined => {
	const root = doc.getElementById('bonus-cards');
	if (!root) {
		return undefined;
	}
	const tiers: Array<IMilestoneTier> = [];
	for (const heading of Array.from(root.querySelectorAll('h3'))) {
		const wrapper = heading.parentElement;
		const body = wrapper?.querySelector('[class*="body"]');
		const tier = heading.textContent?.replace(/\s+/g, ' ').trim() ?? '';
		const rank =
			wrapper
				?.querySelector('[class*="subtitle"]')
				?.textContent?.replace(/\s+/g, ' ')
				.trim() ?? '';
		const blocks = body ? parseRichBlocks(Array.from(body.childNodes)) : [];
		if (!tier || blocks.length === 0) {
			continue;
		}
		const colors = colorsOf(
			wrapper?.parentElement?.getAttribute('style') ?? ''
		);
		tiers.push({ tier, rank, ...(colors ? { colors } : {}), blocks });
	}
	if (tiers.length === 0) {
		return undefined;
	}
	// the section above the cards has the title and the sentence that introduces them, in the language of the page
	const head =
		root.previousElementSibling?.id === 'bonuses'
			? root.previousElementSibling
			: doc.getElementById('bonuses');
	const title = head
		?.querySelector('[class*="heading"]')
		?.textContent?.replace(/\s+/g, ' ')
		.trim();
	const intro = Array.from(
		head?.querySelectorAll('[class*="size:body"]') ?? []
	).flatMap((el) => parseRichBlocks(Array.from(el.childNodes)));
	return {
		title: title ?? MILESTONE_TITLE,
		...(intro.length > 0 ? { intro } : {}),
		tiers,
	};
};

/** A heading of a tier in a post: a paragraph that is all bold ("Tier 1 Bonus Starting at Rank 25"). */
const isTierHeading = (block: RichBlock) =>
	block.kind === 'text' &&
	block.runs.length > 0 &&
	block.runs.every((run) => run.bold);

const textOf = (block: RichBlock) =>
	block.runs
		.map((run) => run.text)
		.join('')
		.replace(/\s+/g, ' ')
		.trim();

/**
 * The tier and the rank out of a heading such as "Tier 1 Bonus Starting at Rank 25": the tier is what comes up to its first number
 * ("Tier 1") and the rank the last word with a number at the end ("Rank 25"). A heading that does not read like that is kept whole
 * as the tier, without a rank.
 */
const splitTierHeading = (heading: string): { tier: string; rank: string } => {
	const tier = /^\D*?\d+/.exec(heading)?.[0];
	const rank = /(\S+\s*\d+)\s*$/.exec(heading)?.[1];
	return tier && rank && tier !== heading.trim() && rank !== tier
		? { tier: tier.trim(), rank: rank.trim() }
		: { tier: heading, rank: '' };
};

/**
 * The major milestone bonuses of a news post's "Major Milestone Bonuses" section: a sentence that introduces them, then for each
 * tier a bold heading ("Tier 1 Bonus Starting at Rank 1") followed by its bullet points. A sentence between two tiers (the GO Pass
 * Deluxe's stronger version of a bonus) goes with the tier after it, whatever follows the last one stays with the last one. The
 * title is the section's own headline, in the language of the post (the posts of the other languages are read the same way, by the
 * section's position).
 */
export const parseMilestoneSection = (
	section: Element
): IMilestoneBonuses | undefined => {
	const blocks = parseRichBlocks(Array.from(section.children).slice(1));
	const intro: Array<RichBlock> = [];
	const tiers: Array<IMilestoneTier> = [];
	let pending: Array<RichBlock> = [];
	for (let i = 0; i < blocks.length; i++) {
		const block = blocks[i];
		if (isTierHeading(block) && blocks[i + 1]?.kind === 'item') {
			const { tier, rank } = splitTierHeading(textOf(block));
			const items: Array<RichBlock> = [];
			while (blocks[i + 1]?.kind === 'item') {
				items.push(blocks[++i]);
			}
			if (tiers.length === 0) {
				intro.push(...pending);
				tiers.push({ tier, rank, blocks: items });
			} else {
				tiers.push({ tier, rank, blocks: [...pending, ...items] });
			}
			pending = [];
		} else {
			pending.push(block);
		}
	}
	if (tiers.length === 0) {
		return undefined;
	}
	tiers[tiers.length - 1].blocks.push(...pending);
	const headline = section.children[0]?.textContent
		?.replace(/\s+/g, ' ')
		.trim();
	return {
		title: headline || MILESTONE_TITLE,
		...(intro.length > 0 ? { intro } : {}),
		tiers,
	};
};
