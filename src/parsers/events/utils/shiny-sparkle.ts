import { inflateSync } from 'node:zlib';

interface Picture {
	width: number;
	height: number;
	/** 8-bit RGBA, row by row. */
	pixels: Buffer;
}

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

/** Decodes an 8-bit RGBA, non-interlaced PNG (what the posts' pictures are). Throws on anything else, so a changed format is noticed. */
export const decodePng = (png: Buffer): Picture => {
	if (!png.subarray(0, 8).equals(PNG_SIGNATURE)) {
		throw new Error('Not a PNG picture');
	}
	let width = 0;
	let height = 0;
	const data: Array<Buffer> = [];
	for (let at = 8; at < png.length; ) {
		const length = png.readUInt32BE(at);
		const type = png.toString('ascii', at + 4, at + 8);
		const chunk = png.subarray(at + 8, at + 8 + length);
		if (type === 'IHDR') {
			width = chunk.readUInt32BE(0);
			height = chunk.readUInt32BE(4);
			// bit depth 8, colour type 6 (RGBA), no interlacing
			if (chunk[8] !== 8 || chunk[9] !== 6 || chunk[12] !== 0) {
				throw new Error('Unsupported PNG picture (expected 8-bit RGBA)');
			}
		} else if (type === 'IDAT') {
			data.push(chunk);
		}
		at += 12 + length;
	}

	const raw = inflateSync(Buffer.concat(data));
	const bytesPerPixel = 4;
	const stride = width * bytesPerPixel;
	const pixels = Buffer.alloc(height * stride);
	for (let y = 0; y < height; y++) {
		const filter = raw[y * (stride + 1)];
		const row = y * (stride + 1) + 1;
		for (let x = 0; x < stride; x++) {
			const left =
				x >= bytesPerPixel ? pixels[y * stride + x - bytesPerPixel] : 0;
			const up = y > 0 ? pixels[(y - 1) * stride + x] : 0;
			const upLeft =
				x >= bytesPerPixel && y > 0
					? pixels[(y - 1) * stride + x - bytesPerPixel]
					: 0;
			let value = raw[row + x];
			if (filter === 1) {
				value += left;
			} else if (filter === 2) {
				value += up;
			} else if (filter === 3) {
				value += (left + up) >> 1;
			} else if (filter === 4) {
				const p = left + up - upLeft;
				const pa = Math.abs(p - left);
				const pb = Math.abs(p - up);
				const pc = Math.abs(p - upLeft);
				value += pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft;
			}
			pixels[y * stride + x] = value & 255;
		}
	}
	return { width, height, pixels };
};

/** Where the sparkles sit in a post's picture of an encounter, as fractions of its size (top right of the ball). */
const SPARKLE_AREA = { left: 0.55, right: 0.8, top: 0.35, bottom: 0.55 };
/** The sparkles are about 170 pure-white pixels there in a picture that has them, none in one that has not. */
const MIN_SPARKLE_PIXELS = 60;

/**
 * Whether a post's picture of an encounter carries the shiny sparkle: the post marks the Pokémon that can be shiny only in the
 * picture, as two white stars beside the ball.
 */
export const hasShinySparkle = (png: Buffer): boolean => {
	const { width, height, pixels } = decodePng(png);
	let white = 0;
	for (
		let y = Math.floor(height * SPARKLE_AREA.top);
		y < height * SPARKLE_AREA.bottom;
		y++
	) {
		for (
			let x = Math.floor(width * SPARKLE_AREA.left);
			x < width * SPARKLE_AREA.right;
			x++
		) {
			const at = (y * width + x) * 4;
			if (
				pixels[at] >= 250 &&
				pixels[at + 1] >= 250 &&
				pixels[at + 2] >= 250 &&
				pixels[at + 3] >= 250
			) {
				white++;
			}
		}
	}
	return white >= MIN_SPARKLE_PIXELS;
};
