/** A stretch of text with the same look: what a post writes in bold or italics, or as a link, keeps it. */
export interface RichRun {
	text: string;
	bold?: true;
	italic?: true;
	/** Where a link goes (an absolute URL). */
	href?: string;
}

/**
 * One block of a formatted text, in the order of the post:
 *  - `text`: a paragraph;
 *  - `item`: a bullet point (or numbered item with `ordered`), `level` being how deep it is nested (0 for the top ones);
 *  - `note`: a footnote or an asterisk remark ("*Max Battles will be available…");
 *  - `heading`: a title inside the text.
 */
export interface RichBlock {
	kind: 'text' | 'item' | 'note' | 'heading';
	runs: Array<RichRun>;
	level?: number;
	ordered?: true;
}
