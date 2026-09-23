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
