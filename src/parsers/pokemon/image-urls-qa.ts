import type { GameMasterData } from '../types/pokemon';

/**
 * Throws when a Pokémon's official artwork couldn't be found on either host (`missing` — typically artwork Pokémon.com hasn't
 * shipped yet) or couldn't be checked (`unchecked` — a host kept failing). Either way its `imageUrl` is a link that may well be
 * broken, which the client would otherwise only find out by showing a broken picture. `unresolved` is what
 * `ImageHostResolver.getUnresolved()` returns.
 */
export function validateImageUrls(
	pokemonDictionary: GameMasterData,
	unresolved: ReadonlyMap<string, 'missing' | 'unchecked'>
): void {
	const problems = Object.values(pokemonDictionary)
		.filter((p) => unresolved.has(p.imageUrl))
		.map(
			(p) => `  - ${p.speciesId} (${unresolved.get(p.imageUrl)}): ${p.imageUrl}`
		);

	if (problems.length > 0) {
		throw new Error(
			`${problems.length} Pokémon without a working official-artwork URL:\n${problems.join('\n')}`
		);
	}
}
