import { BasePokemon } from '../../types/pokemon';

export const SYNTHETIC_POKEMON: Array<BasePokemon> = [
    {
        dex: 554,
        speciesId: 'darumaka_shadow',
        speciesName: 'Darumaka (Shadow)',
        baseStats: { atk: 153, def: 86, hp: 172 },
        types: ['fire', 'none'],
        fastMoves: ['TACKLE', 'FIRE_FANG'],
        chargedMoves: ['FIRE_PUNCH', 'FLAME_CHARGE'],
        eliteMoves: [],
        legacyMoves: [],
        released: true,
        family: {
            id: 'FAMILY_DARUMAKA',
            evolutions: ['darmanitan_standard_shadow'],
        },
        tags: ['shadow'],
    },
];
