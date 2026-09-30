# Pokémon GO Data Generator

PvP rankings are emitted as one `data/*-league-pvp.json` object keyed by
`speciesId`. The existing `great`, `ultra`, and `master` files retain their
names and rank-change behavior. Cup rankings use stable URL-safe ids such as
`catch-1500` and are listed in `data/leagues.json`:

```json
{
	"leagues": [
		{
			"id": "great",
			"title": "Great League",
			"cpCap": 1500,
			"rankingFile": "great-league-pvp.json",
			"icon": "great-league.svg"
		}
	]
}
```

The generator reads PvPoke's `gamemaster/formats.json` on every run and
ingests only formats with `showFormat: true` that are not hidden from rankings
(`hideRankings: true`) or named `Custom`. New non-blacklisted formats fail
generation until they are configured, which causes the daily workflow's
existing Discord failure notification to fire. LAIC, Battle Frontier, and
Gymbreakers formats are intentionally excluded. Great, Ultra, and Master
League are always included.

## Teams data

Two files feed go-pokedex's Teams view (Great, Ultra and Master League only), both derived from PvPoke
by `src/parsers/teams/`:

- `data/team-builder.json` — what go-pokedex's port of PvPoke's simulator needs beyond `game-master.json`
  and the ranking files: PvPoke's move table (energy, turns, buff chances…), its default IVs per ranked
  species, its team-builder meta groups, the few form-changing species (Aegislash, Mimikyu, Morpeko,
  Cramorant), and a `simulator` status block.
- `data/team-leaderboard.json` — PvPoke's training-analysis team ranking (`train/analysis`), with movesets
  resolved from PvPoke's abbreviations to move ids.

`simulator.verified` is `false` when PvPoke's simulator source (fingerprinted in
`src/parsers/teams/simulator-guard.ts`) changed, or its data uses a mechanic the port doesn't know. That
fails the daily run twice over — `simulator-guard.upstream.test.ts` in `pnpm run test`, and
`assertSimulatorVerified` in `pnpm run generate` — so nothing is published and the Discord alert fires until
the port is re-verified (see go-pokedex's `scripts/pvp-sim-parity`).

Every Pokémon is rated at its **rank-1 IVs** (`ivs` in `team-builder.json`), taken from the level-50
tied-for-best spreads already in `species-search-metadata.json` (ties: highest Attack, then Defense, then
HP) — not PvPoke's default IVs. 
