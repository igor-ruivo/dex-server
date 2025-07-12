// Shared normalization utilities for both event and pokemon pipelines

export const normalizeSpeciesNameForId = (speciesName: string): string => {
	return speciesName
		.replaceAll('-', '_')
		.replaceAll('. ', '_')
		.replaceAll("'", '')
		.replaceAll('’', '')
		.replaceAll(' ', '_')
		.replaceAll(' (jr)', '_jr')
		.replaceAll('♂', '_male')
		.replaceAll('♀', '_female');
};

export const normalizePokemonName = (pokemonName: string): string => {
	return ndfNormalized(pokemonName.replace('*', '').replace(' Forme', '').trim())
		.replaceAll('(normal)', '')
		.replaceAll(' cloak', '')
		.trim();
};

export const sexConverter = (name: string): string => {
	return name.replace('Male', '♂').replace('Female', '♀');
};

export const ndfNormalized = (str: string): string => {
	return str
		.toLocaleLowerCase()
		.replaceAll(/[’‘‛′`]/g, "'")
		.replaceAll("'", '')
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '');
};
