import { POKEMON_CONFIG } from '../../../pokemon/config/pokemon-config';
import { AvailableLocales } from '../../../services/gamemaster-translator';
import type { IGameMasterMove } from '../../../types/pokemon';

/** The game master has one Hidden Power (typed Normal); the game gives each Pokémon a type for it from its IVs. */
export const GENERIC_HIDDEN_POWER = 'HIDDEN_POWER';

/**
 * Replaces the generic Hidden Power with one move per type (`HIDDEN_POWER_PSYCHIC`…), the way PvPoke lists them — and the way
 * a Pokémon's move pool already lists them. Each variant is the generic move with its type changed, so it has the type's own
 * STAB and effectiveness in every damage calculation, and is named "<Hidden Power> (<Type>)" in each language (the type from the
 * data-mined `pokemon_type_<type>` strings, English when a locale has none). A game master without the generic move is
 * returned as it is.
 */
export const expandHiddenPower = (
	moves: Record<string, IGameMasterMove>,
	typeName: (locale: AvailableLocales, type: string) => string | undefined
): Record<string, IGameMasterMove> => {
	const generic = moves[GENERIC_HIDDEN_POWER];
	if (!generic) return moves;
	const expanded: Record<string, IGameMasterMove> = { ...moves };
	delete expanded[GENERIC_HIDDEN_POWER];
	for (const moveId of POKEMON_CONFIG.HIDDEN_POWERS) {
		const type = moveId
			.substring(GENERIC_HIDDEN_POWER.length + 1)
			.toLocaleLowerCase();
		const english = type.charAt(0).toLocaleUpperCase() + type.slice(1);
		const moveName: Partial<Record<AvailableLocales, string>> = {};
		const groupName: Partial<Record<AvailableLocales, string>> = {};
		for (const locale of Object.values(AvailableLocales)) {
			const base =
				generic.moveName[locale] ??
				generic.moveName[AvailableLocales.en] ??
				'Hidden Power';
			groupName[locale] = base;
			moveName[locale] = `${base} (${typeName(locale, type) ?? english})`;
		}
		expanded[moveId] = { ...generic, moveId, type, moveName, groupName };
	}
	return expanded;
};
