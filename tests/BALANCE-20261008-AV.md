# AV balance validation — 2026-10-08

Continuous gauge: 10000/SPD; raid budget 350AV; clear boss HP 120000. Growth at 60/120/180AV, DOT pulses every25AV. Timed effects expire continuously; reactions consume no extra AV. Records use new storage keys.

1152 deterministic simulations: 24 decks × 3 bosses × 8 seeds × 2 modes, no stat investment. Policy: ultimate then skill2 then basic; supports target lowest HP or main, tanks self-shield; bullet main uses basic below4 ammo. This is one policy, not optimal play or a wall-clock measurement. All576 clear runs won. Defensive decks remain slower under this damage-focused policy.

| Deck | Raid score (mean) | Raid ally actions | Clear AV (mean) | Clear ally actions |
|---|---:|---:|---:|---:|
| bullet | 88832 | 15 | 433 | 19 |
| poison | 117101 | 14 | 373 | 16 |
| counter | 101930 | 15 | 484 | 21 |
| follow | 144007 | 15 | 225 | 9 |
| freeze | 138523 | 14 | 258 | 10 |
| lifesteal | 149351 | 14 | 202 | 8 |
| bounce | 151774 | 15 | 229 | 10 |
| hp | 101803 | 14 | 414 | 18 |
| speed | 160381 | 20 | 316 | 19 |
| debuff | 176569 | 15 | 193 | 8 |
| ult | 137848 | 15 | 337 | 14 |
| enhance | 112874 | 14 | 344 | 14 |
| skill | 110805 | 15 | 423 | 18 |
| execute | 134139 | 14 | 238 | 10 |
| crit | 156903 | 14 | 200 | 8 |
| cleanse | 114829 | 16 | 418 | 18 |
| burn | 111101 | 14 | 401 | 17 |
| bleed | 118574 | 14 | 340 | 14 |
| electric | 151502 | 15 | 190 | 8 |
| defense | 75666 | 14 | 565 | 24 |
| radiance | 165707 | 15 | 226 | 10 |
| wave | 122305 | 15 | 364 | 16 |
| tree | 165672 | 14 | 213 | 8 |
| wind | 163940 | 19 | 182 | 9 |

Checks: `node tests/av-regression.cjs`; `node tests/game-regression.cjs` (requires repository assets); `node tests/balance-simulation.cjs game results.json`. Locally, all288 skill previews,84 removed-resource cases and fixed-damage checks passed; asset-frame checks were not run in the partial checkout. AV tests cover speed changes mid-wait, action advance, growth, duration, DOT boundaries, lethal records, skipped actions, all24 deck budgets and manual settlement.

AV is virtual combat time. Human decisions and animation duration determine minutes; 350AV does not guarantee5 minutes.
