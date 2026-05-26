import { JSDOM } from 'jsdom';

import type {
	IPokemonGoEventBlockParser,
	IPokemonGoHtmlParser,
} from '../../../../types/events';

class PokemonGoNewsParser implements IPokemonGoHtmlParser {
	private document: Document;

	constructor(readonly html: string) {
		const dom = new JSDOM(html);
		this.document = dom.window.document;
	}

	getTitle() {
		const allArticleNewsDescendants =
			this.document
				.querySelector('article[aria-labelledby=news-title]')
				?.querySelectorAll('*') ?? [];

		const descendantsWithTitleClass = Array.from(
			allArticleNewsDescendants
		).filter((a) => Array.from(a.classList).some((c) => c.includes('_title_')));

		return descendantsWithTitleClass[0]?.textContent ?? '';
	}

	getImgUrl() {
		return (
			this.document
				.querySelector('article>div>div>picture>img')
				?.getAttribute('src') ?? ''
		);
	}

	private extractDateString(block: Element): string {
		const rawDateString =
			block
				.querySelector(':scope > [class*="_markdown_"] p')
				?.textContent?.trim() ?? '';
		return rawDateString.includes('\n')
			? rawDateString.slice(0, rawDateString.indexOf('\n')).trim()
			: rawDateString;
	}

	private isEventRootBlock(
		block: Element,
		allContainerBlocks: Array<Element>
	): boolean {
		const parentBlock = block.parentElement?.closest(
			'[class*="_containerBlock_"][style]'
		);
		if (parentBlock && allContainerBlocks.includes(parentBlock)) {
			return false;
		}

		if (block.querySelector('[class*="_ImageBlock_"]')) {
			return true;
		}

		const style = block.getAttribute('style') ?? '';
		if (!style || style.includes('#ffffff')) {
			return false;
		}

		return !!block.querySelector(':scope > [class*="_markdown_"] p');
	}

	private getContainerBlocks(): Array<Element> {
		const allArticleNewsDescendants =
			this.document
				.querySelector('article[aria-labelledby=news-title]')
				?.querySelectorAll('*') ?? [];

		return Array.from(allArticleNewsDescendants).filter(
			(a) =>
				Array.from(a.classList).some((c) => c.includes('_containerBlock')) &&
				!!a.getAttribute('style')
		);
	}

	getSubEvents(): Array<IPokemonGoEventBlockParser> {
		const containerBlocks = this.getContainerBlocks();
		const imgUrl = this.getImgUrl();

		const questBlockIndices = containerBlocks.reduce<Array<number>>(
			(indices, block, index) => {
				if (this.isEventRootBlock(block, containerBlocks)) {
					indices.push(index);
				}
				return indices;
			},
			[]
		);

		if (questBlockIndices.length === 0) {
			return [];
		}

		return questBlockIndices.map((startIndex, questIndex) => {
			const block = containerBlocks[startIndex];
			const endIndex =
				questBlockIndices[questIndex + 1] ?? containerBlocks.length;

			return {
				subTitle: block.querySelector('h2')?.textContent ?? '',
				imgUrl,
				dateString: this.extractDateString(block),
				getEventBlocks: () => containerBlocks.slice(startIndex, endIndex),
			};
		});
	}
}

export default PokemonGoNewsParser;
