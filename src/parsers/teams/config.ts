import { LeagueDefinitions } from '../pokemon/config/pokemon-config';
import type { TeamLeague } from '../types/teams';

export const PVPOKE_SRC_URL =
	'https://raw.githubusercontent.com/pvpoke/pvpoke/master/src';
const PVPOKE_RAW = `${PVPOKE_SRC_URL}/data`;

export const PVPOKE_MOVES_URL = `${PVPOKE_RAW}/gamemaster/moves.json`;

/** Each supported league's CP cap, from the same league table the PvP rankings use. */
export const TEAM_LEAGUE_CP: Record<TeamLeague, number> = {
	great: LeagueDefinitions.great.cpCap,
	ultra: LeagueDefinitions.ultra.cpCap,
	master: LeagueDefinitions.master.cpCap,
};

/** The quick-fill group PvPoke's team builder treats as each league's meta. */
export const metaGroupUrl = (league: TeamLeague) =>
	`${PVPOKE_RAW}/groups/${league}.json`;

/** The quick-fill group files a cup's meta may be in: PvPoke names them after the format, with the league's name when the
 *  same format has one group per cap (`megagreat`, `megaultra`). First one that exists wins. */
export const cupMetaGroupUrls = (
	format: string,
	cpCap: number
): Array<string> => {
	const suffix = cpCap === 1500 ? 'great' : cpCap === 2500 ? 'ultra' : '';
	return [...new Set([`${format}${suffix}`, format])].map(
		(name) => `${PVPOKE_RAW}/groups/${name}.json`
	);
};
