import { IPokemonGoEventBlockParser, IPokemonGoHtmlParser } from "../../../types/events";
import { JSDOM } from 'jsdom';

class PokemonGoPostParser implements IPokemonGoHtmlParser {
    private document: Document;

    constructor(html: string) {
        const dom = new JSDOM(html);
        this.document = dom.window.document;
    }

    getTitle = () => this.document.querySelectorAll('h2.blogPost__title')[0]?.textContent ?? '';

    getImgUrl = () => this.document.getElementsByClassName('image__image')[0]?.getAttribute('src') ?? '';

    getSubEvents = () => {
        const subEvents: Array<IPokemonGoEventBlockParser> = Array.from(this.document.querySelectorAll('.blogPost__post__blocks>.block--ContainerBlock'))
            .map(e => ({
                subTitle: e.querySelector('h2.ContainerBlock__headline>span.ContainerBlock__headline__title')?.textContent ?? '',
                imgUrl: e.querySelector('.ImageBlock>img')?.getAttribute('src') ?? '',
                dateString: e.querySelector(':scope>div.ContainerBlock>div.ContainerBlock__body')?.textContent ?? '',
                getEventBlocks: () => Array.from(e.getElementsByClassName('block--ContainerBlock')).map(b => b.children[0])
            }));

        return subEvents;
    }
}

export default PokemonGoPostParser;