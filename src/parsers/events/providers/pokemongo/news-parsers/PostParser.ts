import { JSDOM } from 'jsdom';

import type {
	IPokemonGoEventBlockParser,
	IPokemonGoHtmlParser,
} from '../../../../types/events';

class PokemonGoPostParser implements IPokemonGoHtmlParser {
	private document: Document;

	constructor(readonly html: string) {
		const dom = new JSDOM(html);
		this.document = dom.window.document;
	}

	getTitle() {
		return (
			this.document.querySelectorAll('h2.blogPost__title')[0]?.textContent ?? ''
		);
	}

	getImgUrl() {
		return (
			this.document
				.getElementsByClassName('image__image')[0]
				?.getAttribute('src') ?? ''
		);
	}

	getSubEvents() {
		const subEvents: Array<IPokemonGoEventBlockParser> = Array.from(
			this.document.querySelectorAll(
				'.blogPost__post__blocks>.block--ContainerBlock'
			)
		).map((e) => ({
			subTitle:
				e.querySelector(
					'h2.ContainerBlock__headline>span.ContainerBlock__headline__title'
				)?.textContent ?? '',
			imgUrl: e.querySelector('.ImageBlock>img')?.getAttribute('src') ?? '',
			dateString:
				(() => {
					const body = e.querySelector(':scope>div.ContainerBlock>div.ContainerBlock__body');
					if (!body) {
						return '';
					}
					const firstParagraph = body.querySelector('p');
					if (firstParagraph) {
						return firstParagraph.textContent ?? '';
					}
					return body.textContent ?? '';
				})(),
			getEventBlocks: () =>
				Array.from(e.getElementsByClassName('block--ContainerBlock')).map(
					(b) => b.children[0]
				),
		}));

		return subEvents;
	}
}

export default PokemonGoPostParser;
