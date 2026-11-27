/* ==========================================================================
   config.js — the one file you edit.
   Identical in every iteration, so whichever one wins, edit it here.
   ========================================================================== */
window.BOOKING_CONFIG = {
  /* Paste the Google Apps Script "Web app" URL here (see backend/SETUP.md).
     While this is empty the site runs in DEMO MODE: bookings stay in your
     own browser and nothing gets emailed. */
  endpoint: '',

  address: '1257 Wright Avenue',
  city: 'Halifax, Nova Scotia',
  coords: { lat: 44.64, lng: -63.58 },          // city-level, used by the animations
  timezone: 'America/Halifax',

  launch: '2026-11-19T00:00:00-04:00',          // GTA VI launch, Atlantic time
  startDate: '2026-11-19',                      // first bookable day
  endDate: '2027-01-31',                        // last bookable day

  /* start/end are hours from midnight of the chosen day.
     24 = midnight that night, 27 = 3 AM the next morning.
     days: 0 = Sun ... 6 = Sat (omit to allow every day). */
  slots: [
    { id: 'class',  name: 'Skipping Class',      start: 9,  end: 12, days: [1, 2, 3, 4, 5], blurb: "We won't tell your prof." },
    { id: 'heist',  name: 'The Daytime Heist',   start: 12, end: 15, blurb: 'Natural light. Questionable choices.' },
    { id: 'golden', name: 'Golden Hour Joyride', start: 15, end: 18, blurb: 'Sunset cruise down the Leonida Keys.' },
    { id: 'prime',  name: 'Prime Time Crime',    start: 18, end: 21, blurb: 'Peak couch hours. Bring snacks or else.' },
    { id: 'late',   name: 'Late Night Rampage',  start: 21, end: 24, blurb: 'The neighbours have been warned (they have not).' },
    { id: 'bad',    name: 'Bad Decisions Hour',  start: 24, end: 27, blurb: 'Your 8:30 lecture is not our problem.' },
  ],

  /* Slots the house keeps for itself: 'YYYY-MM-DD|slotId': 'reason' */
  hostReserved: {
    '2026-11-19|class': 'Hayden. Since midnight. Has not blinked.',
  },

  /* Whole days nobody can book. Delete this if you're staying in town. */
  blackouts: [
    { from: '2026-12-21', to: '2027-01-03', tag: 'BREAK', reason: "Winter break. We're home eating our parents' food. The PS5 waits alone. Pray for it." },
  ],

  /* Bookable days that get a little label + warning. */
  dayTags: [
    { from: '2026-11-19', to: '2026-11-19', tag: 'LAUNCH', note: 'Launch day. Expect nine people on a three-seat couch.' },
    { from: '2026-12-07', to: '2026-12-18', tag: 'EXAMS',  note: 'Exam season. We are "studying". Book at your own moral risk.' },
  ],
};
