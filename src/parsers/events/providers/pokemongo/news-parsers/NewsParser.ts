import { JSDOM } from 'jsdom';

import { IPokemonGoHtmlParser } from '../../../../types/events';

class PokemonGoNewsParser implements IPokemonGoHtmlParser {
    private document: Document;

    constructor(html: string) {
        const dom = new JSDOM(html);
        this.document = dom.window.document;
    }

    getTitle() {
        const allArticleNewsDescendants =
            this.document.querySelector('article[aria-labelledby=news-title]')?.querySelectorAll('*') ?? [];

        const descendantsWithTitleClass = Array.from(allArticleNewsDescendants).filter((a) =>
            Array.from(a.classList).some((c) => c.includes('_title_'))
        );

        return descendantsWithTitleClass[0]?.textContent ?? '';
    }

    getImgUrl() {
        return this.document.querySelector('article>div>div>picture>img')?.getAttribute('src') ?? '';
    }

    getSubEvents() {
        const allArticleNewsDescendants =
            this.document.querySelector('article[aria-labelledby=news-title]')?.querySelectorAll('*') ?? [];

        const containerBlocks = Array.from(allArticleNewsDescendants).filter((a) =>
            Array.from(a.classList).some((c) => c.includes('_containerBlock'))
        );

        const subTitle = containerBlocks[0].querySelector('h2')?.textContent ?? '';

        const imgUrl = this.document.querySelector('article>div>div>picture>img')?.getAttribute('src') ?? '';

        const dateString = Array.from(containerBlocks[0].children)[1].textContent?.trim() ?? '';

        // Assuming (for now) that events only have 1 sub-event (itself) at most.
        return [
            {
                subTitle,
                imgUrl,
                dateString,
                getEventBlocks: () => containerBlocks,
            },
        ];
    }
}

export default PokemonGoNewsParser;
