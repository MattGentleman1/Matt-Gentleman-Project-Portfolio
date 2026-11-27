/* ==========================================================================
   content.js — the questionnaire and all the jokes.
   Iteration 4 has its own copy with extra questions (the dishwasher, the
   bin, and a secret one hidden under Hayden's sticky note). Add, remove or
   reword freely.

   Question types: text, textarea, choice, multi, range, consent
   group: 'crew' | 'interrogation' | 'fineprint' (pages use these as steps)
   ========================================================================== */
window.BOOKING_QUESTIONS = [
  /* ---------- crew ---------- */
  {
    id: 'name', group: 'crew', type: 'text', required: true, maxlength: 60, autocomplete: 'name',
    label: 'What do we call you?',
    placeholder: "Name, gamertag, or 'the guy with the car'",
    error: "We need a name. 'Some guy' is not a name.",
  },
  {
    id: 'contact', group: 'crew', type: 'text', required: true, maxlength: 100, autocomplete: 'off',
    label: 'How do we reach you?',
    hint: 'Phone, Insta, Snap — whatever you actually check.',
    placeholder: '902-555-0199 or @yourhandle',
    error: 'How else will we tell you to bring chips?',
  },
  {
    id: 'crew', group: 'crew', type: 'range', min: 0, max: 4, step: 1, value: 0,
    label: 'How many goons are you bringing?',
    format: (v) => (v === 0 ? 'Just me' : '+' + v),
    comments: [
      [0, 'Lone wolf. Respect.'],
      [1, 'A duo. Classic.'],
      [2, "The couch is getting tight. There are two controllers. Do the math."],
      [3, "Someone's sitting on the radiator."],
      [4, "That's a party. Hayden has been notified. He is nervous."],
    ],
  },
  {
    id: 'transport', group: 'crew', type: 'choice',
    label: 'How are you getting here?',
    options: [
      { value: 'walk',    label: 'Walking (Halifax hills build character)', reply: 'Calves of steel. Welcome.' },
      { value: 'transit', label: 'Halifax Transit',                         reply: 'See you in three to five business days.' },
      { value: 'uber',    label: 'Uber',                                    reply: 'Look at Mr. Money over here.' },
      { value: 'stolen',  label: 'Stolen car (method acting)',              reply: 'We admire the commitment. We do not condone it.' },
      { value: 'side',    label: 'Via the side path, discreetly',           reply: "You've done this before. Use the knock." },
    ],
  },

  /* ---------- interrogation ---------- */
  {
    id: 'beer', group: 'interrogation', type: 'choice',
    label: 'Are you bringing beer?',
    options: [
      { value: 'keiths',   label: "Yes, a 24 of Keith's",          reply: "Nova Scotia's finest. You may enter." },
      { value: 'garrison', label: "Garrison's, I'm fancy",         reply: 'Ooh, craft. Look at you.' },
      { value: 'busch',    label: "Yes, but it's Busch Light",     reply: "We'll allow it. Barely." },
      { value: 'no',       label: 'No',                            reply: 'Interesting choice. Hayden will remember this.' },
    ],
  },
  {
    id: 'robert', group: 'interrogation', type: 'choice', required: true,
    label: 'Do you think Robert is handsome?',
    error: 'Robert needs to hear it.',
    options: [
      { value: 'yes',     label: 'Yes',                  reply: 'Correct.' },
      { value: 'very',    label: 'Extremely yes',        reply: 'Robert thanks you for your honesty.' },
      { value: 'isthat',  label: 'Robert, is that you?', reply: '...no comment. — Robert' },
      { value: 'no',      label: 'No', runaway: true },
    ],
    runawayLines: ['No?', 'Nope', "Can't catch me", 'Still no', 'Give up', 'Fine, you win'],
    runawayFixed: 'Nice try. We fixed that for you.',
  },
  {
    id: 'donation', group: 'interrogation', type: 'range', min: 0, max: 700, step: 5, value: 0,
    label: 'Willing to chip in for a second PS5?',
    hint: 'Pledges are legally non-binding. Emotionally binding.',
    format: (v) => '$' + v,
    comments: [
      [0,   'Freeloader detected. Noted in your file.'],
      [5,   'Every bit helps. Mostly it does not, but still.'],
      [25,  "That's a controller's worth of respect."],
      [60,  'Hayden just smiled for the first time this semester.'],
      [150, "You're basically a shareholder now."],
      [400, 'Do you... want to live here?'],
      [650, 'You ARE the second PS5.'],
    ],
  },
  {
    id: 'snacks', group: 'interrogation', type: 'multi',
    label: 'What snacks are you contributing?',
    options: [
      { value: 'donair',  label: "Donair (it's the law here)", reply: 'Sweet sauce on the couch is a war crime. Be careful.' },
      { value: 'garlic',  label: 'Garlic fingers',            reply: 'With donair sauce? You get it.' },
      { value: 'chips',   label: 'Chips',                     reply: 'Reliable. Unremarkable. Appreciated.' },
      { value: 'pop',     label: 'Pop',                       reply: 'Hydration secured.' },
      { value: 'pizza',   label: 'Pizza Corner at 2 AM',      reply: 'A true Haligonian.' },
      { value: 'nothing', label: 'Nothing. I am a burden.',   reply: 'Bold. Honest. Still a burden.' },
    ],
  },
  {
    id: 'playstyle', group: 'interrogation', type: 'choice',
    label: 'Your GTA VI playstyle?',
    options: [
      { value: 'lawful',  label: 'Stops at red lights',          reply: 'Psychopath behaviour, honestly.' },
      { value: 'chaos',   label: 'Pure chaos',                   reply: 'Five stars within ninety seconds. Love that.' },
      { value: 'radio',   label: 'Just drives around listening to the radio', reply: 'The most relatable answer on this form.' },
      { value: 'backseat',label: 'Backseat gamer',               reply: 'You will be seated in the kitchen.' },
    ],
  },
  {
    id: 'hog', group: 'interrogation', type: 'range', min: 1, max: 10, step: 1, value: 5,
    label: 'Rate your controller-hogging tendencies.',
    format: (v) => v + '/10',
    comments: [
      [1,  'Generous. Suspicious.'],
      [4,  'A normal, well-adjusted human.'],
      [7,  'We will be timing you.'],
      [10, 'Hayden is hiding the second controller as we speak.'],
    ],
  },
  {
    id: 'dishwasher', group: 'interrogation', type: 'choice',
    label: "Our dishwasher hasn't drained since reading week. Your move?",
    options: [
      { value: 'guy',      label: 'I know a guy',                   reply: "Robert asks that the guy be a plumber this time and not 'a guy'." },
      { value: 'bucket',   label: 'A bucket and a positive attitude', reply: 'That is, word for word, our current system.' },
      { value: 'aquarium', label: "That's an aquarium now",          reply: "It has a name. We don't say it out loud." },
      { value: 'nope',     label: 'Not my problem',                  reply: 'It will be when you need a fork.' },
    ],
  },
  {
    id: 'leftovers', group: 'interrogation', type: 'choice', secret: true,
    label: "Who ate Hayden's leftover donair?",
    options: [
      { value: 'matt',    label: 'Matt',                  reply: 'Matt denies everything. Matt has sauce on his hoodie.' },
      { value: 'robert',  label: 'Robert',                reply: 'Robert says a handsome man would never.' },
      { value: 'raccoon', label: 'The raccoon in the shed', reply: 'The raccoon has a lawyer now. Thanks a lot.' },
      { value: 'me',      label: "It was me. I'm sorry.",  reply: 'Hayden forgives you. Hayden does not forget.' },
    ],
  },
  {
    id: 'bin', group: 'interrogation', type: 'choice',
    label: 'Hypothetically: someone tells you not to open a green bin. Do you open it?',
    options: [
      { value: 'no',      label: 'No. I respect boundaries.', reply: 'Good. Stay that way.' },
      { value: 'yes',     label: 'Obviously',                 reply: 'That is exactly what someone who opens bins would say. Noted.' },
      { value: 'already', label: 'I already did',             reply: '...we need to talk. In person. Alone.' },
    ],
  },
  {
    id: 'rent', group: 'interrogation', type: 'choice',
    label: 'True or false: rent in Halifax is too damn high.',
    options: [
      { value: 'true',    label: 'True',                  reply: 'Hence the shared PS5.' },
      { value: 'very',    label: 'Extremely true',        reply: 'We pay rent in tears and Keith\'s.' },
      { value: 'parents', label: 'I live with my parents', reply: 'Must be nice.' },
    ],
  },
  {
    id: 'weird', group: 'interrogation', type: 'choice',
    label: 'Is it weird that three grown men built a website for this?',
    options: [
      { value: 'genius',  label: "No, it's genius",                 reply: 'Thank you. Finally, someone gets it.' },
      { value: 'yes',     label: 'Yes',                             reply: 'And yet here you are, filling it out.' },
      { value: 'worried', label: "I'm a little worried about you guys", reply: 'Valid. Book a slot and check on us.' },
    ],
  },

  /* ---------- fine print ---------- */
  {
    id: 'savefile', group: 'fineprint', type: 'consent', required: true,
    label: "I solemnly swear I will not touch Hayden's save file.",
    error: 'Hayden needs this. Check the box.',
  },
  {
    id: 'owner', group: 'fineprint', type: 'consent',
    label: 'I acknowledge the PS5 belongs to Hayden and I am merely a guest in its presence.',
  },
  {
    id: 'lastwords', group: 'fineprint', type: 'textarea', maxlength: 400,
    label: 'Any last words for Hayden?',
    placeholder: "e.g. 'thank you for your service'",
  },
];

window.BOOKING_COPY = {
  prelaunch: "GTA VI isn't out yet. Go outside. Touch grass. It's free.",
  beyond: "We don't plan that far ahead. We barely plan dinner.",
  full: 'Fully booked. Popular house, this.',
  past: 'That already happened. You missed it.',
  pickDayFirst: 'Pick a day first. The slots are shy.',
  needDate: 'Pick a day on the calendar first.',
  needSlot: 'Pick a time slot. Any slot. Please.',
  takenLines: [
    'Someone cooler got here first.',
    'Booked. Skill issue.',
    'Taken. Should have been faster.',
    'Gone. Like your rent money.',
    'Sniped by a friend of Robert.',
  ],
  errors: {
    taken: 'Someone sniped that slot while you were answering questions about Robert. Pick another.',
    busy: 'The booking desk is swamped. Give it a few seconds and try again.',
    network: "Couldn't reach the booking desk. Check your connection and try again.",
    invalid: 'A few answers are missing. Scroll up.',
  },
  demoBadge: 'Demo mode',
  demoBadgeMore: 'not connected yet (see README)',
};
