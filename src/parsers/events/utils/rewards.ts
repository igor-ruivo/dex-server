import type { RichBlock } from '../../types/rich-text';
import { parseRichBlocks } from './rich-text';

/** The section of a post that lists a GO Pass's rewards together with its featured Pokémon. */
export const FEATURED_REWARDS_TITLE = 'Featured Pokémon and Rewards';

const escapeRegExp = (text: string) =>
	text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const textOf = (block: RichBlock) =>
	block.runs
		.map((run) => run.text)
		.join('')
		.replace(/\s+/g, ' ');

/** The blocks of a section (after its headline), with the formatting the post gives them. */
export const sectionBlocks = (section: Element): Array<RichBlock> =>
	parseRichBlocks(Array.from(section.children).slice(1));

/**
 * The rewards of a "Featured Pokémon and Rewards" section: what it says apart from the lines the Pokémon were taken from ("Encounter
 * with Kyogre*") and the remark about them being shiny. Returns what is kept and the places (among all the section's blocks) of what
 * was left out, so that the post of another language, which lays its blocks out the same way, can leave out the same ones.
 */
export const rewardBlocksWithout = (
	section: Element,
	pokemonNames: ReadonlyArray<string>
): { blocks: Array<RichBlock>; dropped: Array<number> } => {
	const all = sectionBlocks(section);
	const names = pokemonNames
		.filter(Boolean)
		.map((name) => new RegExp(`\\b${escapeRegExp(name)}\\b`, 'i'));
	const dropped: Array<number> = [];
	const blocks = all.filter((block, index) => {
		const text = textOf(block);
		const named =
			block.kind !== 'heading' && names.some((name) => name.test(text));
		const shinyRemark = block.kind === 'note' && /shiny/i.test(text);
		if (named || shinyRemark) {
			dropped.push(index);
			return false;
		}
		return true;
	});
	return { blocks, dropped };
};

/** The blocks of the same section in another language, without the places that were left out of the English one. */
export const rewardBlocksLike = (
	section: Element,
	dropped: ReadonlyArray<number>
): Array<RichBlock> => {
	const all = sectionBlocks(section);
	// a post laid out differently has nothing to line up with: it keeps all of its blocks
	if (dropped.some((index) => index >= all.length)) {
		return all;
	}
	return all.filter((_, index) => !dropped.includes(index));
};
