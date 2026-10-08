import type { RichBlock } from '../../types/rich-text';
import { parseRichBlocks } from './rich-text';

/** The section of a post that lists a GO Pass's rewards together with its featured Pokémon. */
export const FEATURED_REWARDS_TITLE = 'Featured Pokémon and Rewards';

/** The blocks of a section (after its headline), with the formatting the post gives them. */
export const sectionBlocks = (section: Element): Array<RichBlock> =>
	parseRichBlocks(Array.from(section.children).slice(1));

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
