# Most Wanted · 1257 Wright Ave

Wanted Level's story and map, dressed in Wright City's Vice City colours. The one with all the secrets.

## The story

1. **An unknown number calls** a Haydia 1257 burner phone. You can try to decline. Don't.
2. **The call** plays out as GTA-style subtitles: Hayden on a burner line, Robert yelling about the bin
   in the background, Matt asking if it's the co-op people.
3. **Texts arrive** (location, a pixelated photo of the house), then **self-destruct**.
4. **Briefing:** a live **3D recon scan** of the house (wireframe scan → solid model), a partly
   redacted dossier, objectives.
5. **Missions 1–5:** day, time window, crew, interrogation, fine print → **Mission Passed!**

## The map

The opening animatic zooms in one continuous camera move from orbit to Wright Ave. No d3, no canvas blur
filters; the globe is a small custom projection, so it stays smooth. Afterwards the neon radar is live:
**drag, scroll, pinch, arrow keys, or the +/−/⌖ buttons**. On phones, tap **Explore map** first so
scrolling the page still works.

## Secrets (18 hidden packages; the counter is top-right)

Spoilers, for the three of you only:

| Where | What |
| --- | --- |
| Phone | The decline key falls off after three tries · you can't hang up on Hayden · the hidden "???" contact (unlocks after you open the bin) · voicemails for everyone, including Steve |
| Briefing | Redacted dossier lines (the last one has layers) |
| 3D house | Pink markers: **two green bins** (one is a decoy; the real one takes three tries to open), basement, kitchen, chimney, mailbox (letters for "Kevin"), side path, the deck, Steve's van |
| Map | The bin (open it, it glows) · Steve's flower van (knock, it leaves) · the landlord (**runs from your cursor** until he's winded) · zoom in or pan around to find the cart graveyard, Robert's "fishing" spot, and Hayden's buried spare controller |
| Form | "Is Robert handsome?" No button still runs · Hayden's sticky note hides a secret question (drag it off) · read the whole terms box to find Clause 99 |
| Cheats | Type anywhere: `LEAVEMEALONE`, `HESOYAM`, `BIGBANG`, `PANZER`. On the burner, dial `1999` + the first four letters on the keypad (e.g. 1999-5328). The Konami code tells you you're in the wrong franchise. Clicking the WANTED logo five times maxes your stars. |

The dishwasher is mentioned exactly twice, as requested: once in the interrogation, once in the kitchen.

## Files

- `js/map.js`: animatic + interactive radar + map secrets
- `js/house3d.js`: the 3D model (three.js from a CDN, loaded only when the briefing opens)
- `js/phone.js`: the burner phone
- `js/eggs.js`: hidden-package counter, banners, cheats
- `js/main.js`: the story, the mission wizard, HUD
- `js/content.js`: questions and jokes. **This iteration has its own copy** (the dishwasher, the bin
  question, the secret donair question). `config.js`, `booking-core.js` and `booking-base.css` are still
  the shared ones.

To publish: copy everything in this folder to the root of a GitHub repo and turn on Pages.
To receive bookings: see `../backend/SETUP.md`, then set `endpoint` in `js/config.js`.
