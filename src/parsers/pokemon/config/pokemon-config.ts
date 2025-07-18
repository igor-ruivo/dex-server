export enum Leagues {
	GREAT = 'https://raw.githubusercontent.com/pvpoke/pvpoke/master/src/data/rankings/all/overall/rankings-1500.json',
	ULTRA = 'https://raw.githubusercontent.com/pvpoke/pvpoke/master/src/data/rankings/all/overall/rankings-2500.json',
	MASTER = 'https://raw.githubusercontent.com/pvpoke/pvpoke/master/src/data/rankings/all/overall/rankings-10000.json',
	HISUI = 'https://raw.githubusercontent.com/pvpoke/pvpoke/master/src/data/rankings/hisui/overall/rankings-1500.json',
}

export const POKEMON_CONFIG = {
	SOURCE_URL:
		'https://raw.githubusercontent.com/pvpoke/pvpoke/master/src/data/gamemaster/pokemon.json',

	// Pokemon that should be included even if not released
	RELEASED_OVERRIDE: new Set([
		'cosmog',
		'cosmoem',
		'rayquaza_mega',
		'typhlosion_hisuian',
		'ditto',
		'shedinja',
		'annihilape',
		'heracross_mega',
		'hatenna',
		'hattrem',
		'hatterene',
		'morpeko_full_belly',
		'mawile_mega',
		'spewpa',
		'toxel',
		'cursola',
		'corsola_galarian',
		'sinistea',
		'polteageist',
		'sizzlipede',
		'centiskorch',
		'gossifleur',
		'eldegoss',
		'applin',
		'flapple',
		'appletun',
		'dipplin',
		'hydrapple',
		'tinkatink',
		'tinkatuff',
		'tinkaton',
		'lilligant_hisuian',
		'zorua_hisuian',
		'zoroark_hisuian',
		'honedge',
		'doublade',
		'aegislash_blade',
		'aegislash_shield',
		'toedscool',
		'toedscruel',
	]),

	// Pokemon that should be excluded
	BLACKLISTED_SPECIES: new Set([
		'pikachu_5th_anniversary',
		'pikachu_flying',
		'pikachu_kariyushi',
		'pikachu_libre',
		'pikachu_pop_star',
		'pikachu_rock_star',
		'pikachu_shaymin',
		'pikachu_horizons',
	]),

	// Hidden power moves that should be consolidated
	HIDDEN_POWERS: new Set([
		'HIDDEN_POWER_BUG',
		'HIDDEN_POWER_DARK',
		'HIDDEN_POWER_DRAGON',
		'HIDDEN_POWER_ELECTRIC',
		'HIDDEN_POWER_FIGHTING',
		'HIDDEN_POWER_FIRE',
		'HIDDEN_POWER_FLYING',
		'HIDDEN_POWER_GHOST',
		'HIDDEN_POWER_GRASS',
		'HIDDEN_POWER_GROUND',
		'HIDDEN_POWER_ICE',
		'HIDDEN_POWER_POISON',
		'HIDDEN_POWER_PSYCHIC',
		'HIDDEN_POWER_ROCK',
		'HIDDEN_POWER_STEEL',
		'HIDDEN_POWER_WATER',
	]),

	// Image URL builders
	POKEMON_BASE_URL: 'https://assets.pokemon.com/assets/cms2/img/pokedex/full/',

	// Override mappings for special Pokemon
	IMAGE_OVERRIDE_MAPPINGS: new Map<string, string>([
		[
			'slowbro_mega',
			'https://assets.pokemon.com/assets/cms2/img/pokedex/full/080_f2.png',
		],
		[
			'slowbro_galarian',
			'https://assets.pokemon.com/assets/cms2/img/pokedex/full/080_f3.png',
		],
		['mewtwo_armored', 'https://i.imgur.com/Vwhh8KW.png'],
		[
			'castform_sunny',
			'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/10013.png',
		],
		[
			'castform_rainy',
			'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/10014.png',
		],
		[
			'castform_snowy',
			'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/10015.png',
		],
		[
			'rotom_frost',
			'https://assets.pokemon.com/assets/cms2/img/pokedex/full/479_f4.png',
		],
		[
			'rotom_mow',
			'https://assets.pokemon.com/assets/cms2/img/pokedex/full/479_f6.png',
		],
		[
			'rotom_wash',
			'https://assets.pokemon.com/assets/cms2/img/pokedex/full/479_f3.png',
		],
		[
			'rotom_fan',
			'https://assets.pokemon.com/assets/cms2/img/pokedex/full/479_f5.png',
		],
		[
			'rotom_heat',
			'https://assets.pokemon.com/assets/cms2/img/pokedex/full/479_f2.png',
		],
		[
			'darmanitan_galarian_standard',
			'https://assets.pokemon.com/assets/cms2/img/pokedex/full/555_f2.png',
		],
		[
			'darmanitan_galarian_standard_shadow',
			'https://assets.pokemon.com/assets/cms2/img/pokedex/full/555_f2.png',
		],
		[
			'darmanitan_standard',
			'https://assets.pokemon.com/assets/cms2/img/pokedex/full/555.png',
		],
		[
			'darmanitan_standard_shadow',
			'https://assets.pokemon.com/assets/cms2/img/pokedex/full/555.png',
		],
		[
			'genesect_burn',
			'https://assets.pokemon.com/assets/cms2/img/pokedex/full/649.png',
		],
		[
			'genesect_chill',
			'https://assets.pokemon.com/assets/cms2/img/pokedex/full/649.png',
		],
		[
			'genesect_douse',
			'https://assets.pokemon.com/assets/cms2/img/pokedex/full/649.png',
		],
		[
			'genesect_shock',
			'https://assets.pokemon.com/assets/cms2/img/pokedex/full/649.png',
		],
		[
			'zygarde_10',
			'https://assets.pokemon.com/assets/cms2/img/pokedex/full/718_f2.png',
		],
		[
			'zygarde',
			'https://assets.pokemon.com/assets/cms2/img/pokedex/full/718.png',
		],
		[
			'zygarde_complete',
			'https://assets.pokemon.com/assets/cms2/img/pokedex/full/718_f3.png',
		],
		[
			'oricorio_pau',
			'https://assets.pokemon.com/assets/cms2/img/pokedex/full/741_f3.png',
		],
		[
			'oricorio_pom_pom',
			'https://assets.pokemon.com/assets/cms2/img/pokedex/full/741_f2.png',
		],
		[
			'pumpkaboo_small',
			'https://assets.pokemon.com/assets/cms2/img/pokedex/full/710.png',
		],
		[
			'necrozma_dawn_wings',
			'https://assets.pokemon.com/assets/cms2/img/pokedex/full/800_f3.png',
		],
		[
			'necrozma_dusk_mane',
			'https://assets.pokemon.com/assets/cms2/img/pokedex/full/800_f2.png',
		],
		[
			'kyurem_black',
			'https://assets.pokemon.com/assets/cms2/img/pokedex/full/646_f3.png',
		],
		[
			'kyurem_white',
			'https://assets.pokemon.com/assets/cms2/img/pokedex/full/646_f2.png',
		],
		[
			'tauros_blaze',
			'https://assets.pokemon.com/assets/cms2/img/pokedex/full/128_f3.png',
		],
		[
			'tauros_aqua',
			'https://assets.pokemon.com/assets/cms2/img/pokedex/full/128_f4.png',
		],
		[
			'urshifu_single_strike',
			'https://assets.pokemon.com/assets/cms2/img/pokedex/full/892.png',
		],
		[
			'urshifu_rapid_strike',
			'https://assets.pokemon.com/assets/cms2/img/pokedex/full/892_f2.png',
		],
		[
			'zacian_hero',
			'https://assets.pokemon.com/assets/cms2/img/pokedex/full/888.png',
		],
		[
			'zacian_crowned_sword',
			'https://assets.pokemon.com/assets/cms2/img/pokedex/full/888_f2.png',
		],
		[
			'zamazenta_hero',
			'https://assets.pokemon.com/assets/cms2/img/pokedex/full/889.png',
		],
		[
			'zamazenta_crowned_shield',
			'https://assets.pokemon.com/assets/cms2/img/pokedex/full/889_f2.png',
		],
		[
			'aegislash_blade',
			'https://assets.pokemon.com/assets/cms2/img/pokedex/full/681_f2.png',
		],
		[
			'aegislash_shield',
			'https://assets.pokemon.com/assets/cms2/img/pokedex/full/681.png',
		],
	]),

	// GO image override mappings
	GO_OVERRIDE_MAPPINGS: new Map<string, string>([
		['unown', '201.fUNOWN_F.icon.png'],
		['spinda', '327.f00.icon.png'],
		['kyogre_primal', '382.fPRIMAL.icon.png'],
		['groudon_primal', '383.fPRIMAL.icon.png'],
		['burmy_plant', '412.fBURMY_PLANT.icon.png'],
		['burmy_sandy', '412.fBURMY_SANDY.icon.png'],
		['burmy_trash', '412.fBURMY_TRASH.icon.png'],
		['wormadam_plant', '413.fWORMADAM_PLANT.icon.png'],
		['wormadam_sandy', '413.fWORMADAM_SANDY.icon.png'],
		['wormadam_trash', '413.fWORMADAM_TRASH.icon.png'],
		['shellos', '422.fWEST_SEA.icon.png'],
		['gastrodon', '423.fWEST_SEA.icon.png'],
		['basculin', '550.fRED_STRIPED.icon.png'],
		['darmanitan_galarian_standard', '555.fGALARIAN_STANDARD.icon.png'],
		['darmanitan_galarian_standard_shadow', '555.fGALARIAN_STANDARD.icon.png'],
		['darmanitan_standard_shadow', '555.fSTANDARD.icon.png'],
		['deerling', '585.fSPRING.icon.png'],
		['sawsbuck', '586.fSPRING.icon.png'],
		['kyurem', '646.fNORMAL.icon.png'],
		['genesect', '649.fNORMAL.icon.png'],
		['vivillon', '666.fMEADOW.icon.png'],
		['flabebe', '669.fRED.icon.png'],
		['floette', '670.fRED.icon.png'],
		['florges', '671.fRED.icon.png'],
		['furfrou', '676.fNATURAL.icon.png'],
		['meowstic', '678.icon.png'],
	]),

	// Shiny GO image override mappings
	SHINY_GO_OVERRIDE_MAPPINGS: new Map<string, string>([
		['unown', '201.fUNOWN_F.s.icon.png'],
		['spinda', '327.f00.s.icon.png'],
		['kyogre_primal', '382.fPRIMAL.s.icon.png'],
		['groudon_primal', '383.fPRIMAL.s.icon.png'],
		['burmy_plant', '412.fBURMY_PLANT.s.icon.png'],
		['burmy_sandy', '412.fBURMY_SANDY.s.icon.png'],
		['burmy_trash', '412.fBURMY_TRASH.s.icon.png'],
		['wormadam_plant', '413.fWORMADAM_PLANT.s.icon.png'],
		['wormadam_sandy', '413.fWORMADAM_SANDY.s.icon.png'],
		['wormadam_trash', '413.fWORMADAM_TRASH.s.icon.png'],
		['shellos', '422.fWEST_SEA.s.icon.png'],
		['gastrodon', '423.fWEST_SEA.s.icon.png'],
		['basculin', '550.fRED_STRIPED.s.icon.png'],
		['darmanitan_galarian_standard', '555.fGALARIAN_STANDARD.s.icon.png'],
		[
			'darmanitan_galarian_standard_shadow',
			'555.fGALARIAN_STANDARD.s.icon.png',
		],
		['darmanitan_standard_shadow', '555.fSTANDARD.s.icon.png'],
		['deerling', '585.fSPRING.s.icon.png'],
		['sawsbuck', '586.fSPRING.s.icon.png'],
		['kyurem', '646.fNORMAL.s.icon.png'],
		['genesect', '649.fNORMAL.s.icon.png'],
		['vivillon', '666.fMEADOW.s.icon.png'],
		['flabebe', '669.fRED.s.icon.png'],
		['floette', '670.fRED.s.icon.png'],
		['florges', '671.fRED.s.icon.png'],
		['furfrou', '676.fNATURAL.s.icon.png'],
		['meowstic', '678.s.icon.png'],
	]),
};
