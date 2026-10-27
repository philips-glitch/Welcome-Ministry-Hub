// Mini Events #1, #2, #3 and #5 from "Playbook - Welcome UR Outing 2026" (rules, how to play, scoring,
// schedule). Seeds both the demo store and the database (server/schema.js).
// Mini Event #4 (Spice It Up) is kept as it was, only renumbered to R4.
// Times are WIB. Sections are shown on the portal challenge page: "- " lines are bullets, "1. " lines are steps.

const PARTICIPATION_2 = { tiers: [{ min: 10, pts: 10 }, { min: 7, pts: 6 }, { min: 0, pts: 2 }] };
const PARTICIPATION_3 = { tiers: [{ min: 10, pts: 50 }, { min: 7, pts: 35 }, { min: 0, pts: 20 }] };

// Mini Event #4 "Spice It Up" — digital scrapbook / e-poster (guideline Oct 2026). The seed keeps R4 as a draft.
export const R4 = {
  sections: {"game_idea":"Celebrate your Flourish journey as a team: create one digital scrapbook collage or e-poster that tells your story — then present it together.","how_to_play":"1. NAME YOUR TEAM — discuss and decide on a group name inspired by the theme \"Flourish\" that best represents your team.\n2. COLLECT PHOTOS — every member submits a recent photo taken in the UR area; add individual photos of every member and/or group photos taken during the Flourish event.\n3. TELL YOUR STORY — share your thoughts, impressions and experiences during Flourish Hub and/or serving in the UR Campus Welcome Ministry.\n4. SAY THANK YOU — include at least three appreciations: to an individual, to yourself, or to something else related to your experience in the UR Campus Welcome Ministry.\n5. SUBMIT — the Group Leader submits the e-poster as a PDF (16:9) in Flourish Hub and tags every member by 19 November, 21:00 WIB.\n6. PRESENT — each team presents its e-poster on 21 November (max 5 minutes per group).","rules":"- Each team creates ONE digital scrapbook collage or e-poster.\n- Use a group name inspired by the theme \"Flourish\".\n- Include individual photos of every team member and/or group photos taken during the Flourish event.\n- Share your thoughts, impressions and experiences during Flourish Hub and/or serving in the UR Campus Welcome Ministry.\n- Include at least three appreciations (to an individual, yourself, or something else related to your experience in the UR Campus Welcome Ministry).\n- No printing needed: submit it as a PDF in a 16:9 format, like a standard PowerPoint slide.\n- Only the Group Leader submits the file to Flourish Hub — by 19 November, no later than 21:00 WIB.\n- Each team presents its e-poster on 21 November, max 5 minutes per group.","points_rewards":"- Submission to Flourish Hub: 70 pts.\n- Individual member participation (max 30): each member submits a recent photo taken in the UR area and all photos are included in the PDF; the Group Leader tags each member in Flourish Hub. Only unique members count: tagged members ÷ team size × 30.\n- Max 100. Example (12 members): submitted (70) + 10 of 12 members tagged and verified (25) = 95.","flourish_hub":"Only the Group Leader submits: the cover image, the link to the e-poster PDF (16:9, e.g. Google Drive), and tags every member whose photo is in the e-poster.","what_we_need":"- 19 Nov, 21:00 WIB: e-poster PDF submitted by the Group Leader\n- 21 Nov: each team presents its e-poster (max 5 minutes)","duration":"Until 19 November 2026, 21:00 WIB · presentations on 21 November."},
  scoring: {"type":"submit_participation","submit_pts":70,"participation_pts":30},
  form: {"photo":"required","link_label":"Link e-poster / scrapbook (PDF 16:9, mis. Google Drive)","photo_label":"Cover","photo_pick_label":"Upload disini","tag_label":"Siapa aja yang terlibat?","confirm":["Semua orang di foto adalah anggota {grup}","Tidak menyebut nama gereja & tidak ada wajah jemaat tanpa izin","Deklarasi No-AI"],"link":"required","tags":true,"checks":["Satu e-poster per tim, PDF 16:9","Nama grup bertema \"Flourish\"","Foto setiap anggota / foto grup dari event Flourish","Cerita & kesan selama Flourish / pelayanan","Minimal 3 apresiasi"],"reasons":["Bukan PDF / bukan 16:9","Link tidak bisa dibuka","Foto anggota tidak ada","Kurang dari 3 apresiasi","Lewat deadline"]},
  form_patch: {"link":"required","link_label":"Link e-poster / scrapbook (PDF 16:9, mis. Google Drive)","tags":true,"checks":["Satu e-poster per tim, PDF 16:9","Nama grup bertema \"Flourish\"","Foto setiap anggota / foto grup dari event Flourish","Cerita & kesan selama Flourish / pelayanan","Minimal 3 apresiasi"],"reasons":["Bukan PDF / bukan 16:9","Link tidak bisa dibuka","Foto anggota tidak ada","Kurang dari 3 apresiasi","Lewat deadline"]},
  deadline: '2026-11-19T21:00', validate_by: '2026-11-21T23:59',
};

export const PLAYBOOK = [
  {
    code: 'R1', kind: 'main', round: 1, name: 'Get to Know Me', status: 'live', sort: 1, riddles_per_group: 0,
    schedule: ['2026-10-12T00:00', '2026-10-12T00:00', '2026-10-18T23:59', '2026-10-19T23:59'],
    sections: {
      game_idea: "Udah Kenal Belom? Get to know 2 people from your new group — people you don't normally interact with — and remember something meaningful about them. The challenge is to see whether you actually talked, listened, and discovered something new.",
      how_to_play: [
        "1. PICK — Choose 2 people from your new group whom you don't normally interact with. You can choose any 2 people; there are no assigned pairs.",
        '2. TALK — Have a real conversation. Ask them about something they really enjoy, one thing people might not know about them, and their hidden talent.',
        '3. REMEMBER — After talking, answer 3 questions about each person:',
        '- Q1. What are 3 words they used to describe themselves?',
        "- Q2. What's something they really enjoy doing?",
        "- Q3. What's their hidden talent?",
        "4. DISCOVER — Q4. What's ONE thing you discovered about them that you didn't know before?",
        "5. SUBMIT — Submit each person's answers through Flourish Hub before the deadline.",
        'BONUS: Take a photo together and get +2 points per person.',
      ].join('\n'),
      rules: [
        '- Each member must get to know 2 people from their new group.',
        "- The 2 people should be people they don't normally interact with / don't know well.",
        '- Members must actually talk to the person.',
        '- For each person, members answer 3 questions based on the existing Get to Know Me information.',
        '- Members answer 1 additional Discovery question based on their actual conversation.',
        '- All answers are open answers — no multiple choice.',
        '- Each person can only be submitted once by the same member.',
        '- Submission is done through Flourish Hub before the deadline.',
        '- Answers must be based on a real conversation and not copied from another member.',
        '- Keep discoveries appropriate and respectful — no sensitive/personal information.',
      ].join('\n'),
      connection: "Connection > Competition. The goal isn't to get to know most people. It's to actually know someone a little better.",
      points_rewards: [
        '- Q1–Q3 (knowledge), 2 pts each: 2 = clearly matches their Get to Know Me answer · 1 = close enough · 0 = incorrect or blank.',
        '- Q4 (discovery), 4 pts: 4 = specific, genuine and learned in the conversation · 2 = relevant but too generic · 0 = blank, irrelevant or copied from their profile.',
        '- Photo together: +2 per person (optional, no penalty). One clear photo of the two of you, taken during/around the conversation.',
        '- Max 12 per person, 24 per member (2 people).',
        '- Team score = (average member score ÷ 24 × 70) + (participation rate × 30), max 100. The average counts members who took part; participation rate = (members who submitted + members who were interviewed) ÷ team size × ½.',
      ].join('\n'),
      flourish_hub: 'Every member submits for themselves: pick the person, answer Q1–Q4, and add an optional photo together. One submission per person, 2 people per member.',
      make_it_flourish: "Let's meet. Let's connect. Let's flourish together.",
      duration: '12–18 October 2026 · deadline Sunday 18 October, 23:59 WIB.',
    },
    scoring: {
      type: 'connect', people: 2, photo_bonus: 2, individual_weight: 70, participation_weight: 30,
      questions: [
        { key: 'q1', text: 'What are 3 words they used to describe themselves?', max: 2, ref: 'words' },
        { key: 'q2', text: "What's something they really enjoy doing?", max: 2, ref: 'enjoy' },
        { key: 'q3', text: "What's their hidden talent?", max: 2, ref: 'talent' },
        { key: 'q4', text: "What's ONE thing you discovered about them that you didn't know before?", max: 4 },
      ],
    },
    form: {
      photo: 'optional', link: 'none', tags: false,
      confirm: [
        'Jawaban saya dari obrolan langsung dengan orang ini, bukan disalin dari member lain',
        'Discovery saya pantas & menghormati — tanpa informasi sensitif/pribadi',
      ],
      checks: ['Orangnya satu grup dengan yang submit', 'Jawaban dari obrolan asli, tidak disalin', 'Konten pantas & tidak sensitif'],
      reasons: ['Jawaban disalin / bukan dari obrolan asli', 'Bukan anggota grup yang sama', 'Konten tidak pantas / terlalu pribadi', 'Orang yang sama sudah disubmit'],
    },
  },
  {
    code: 'R2', kind: 'main', round: 2, name: 'Guess, Find, Snap!', status: 'scheduled', sort: 2, riddles_per_group: 4,
    schedule: ['2026-10-21T00:00', '2026-10-21T00:00', '2026-10-25T23:59', '2026-10-26T23:59'],
    sections: {
      game_idea: "Get your team to work together, explore, and create a shared moment. GUESS what the clue is describing, FIND the answer around you, SNAP it as a team. The goal isn't just the correct answer — it's collaborating, having fun, and creating a memory together.",
      how_to_play: [
        '1. GET YOUR CLUES — Each team receives 4 random riddles/clues. Each clue describes something you need to find.',
        '2. GUESS — Read the clue together and figure out what the answer could be.',
        '3. FIND — Go around the church and find the actual object/place/thing described by the clue.',
        '4. SNAP — Take a photo showing the correct answer. The photo should clearly prove that your team found it.',
        '5. SUBMIT — The Group Leader submits each clue through Flourish Hub: the answer, its photo, and the IG Story link.',
        '6. GET VALIDATED — The Captain checks the submission based on the challenge rules.',
      ].join('\n'),
      rules: [
        '- Each team receives 4 random clues.',
        '- The team must solve all 4 clues.',
        '- Each answer must be supported by a photo.',
        '- The photo must clearly show the correct answer.',
        '- Photos should be taken by the team during the challenge — no old photos.',
        '- Team members should participate in the challenge, not just have one person do everything.',
        '- The required IG Story must be uploaded and tag the official event account.',
        '- The Group Leader is responsible for submitting the final answers through Flourish Hub.',
        '- The Captain validates the submission.',
        '- Keep everything safe, respectful, and within the church area.',
        "- No inappropriate content or photos of people who haven't given permission.",
      ].join('\n'),
      connection: "The goal isn't just to find the answer. It's to find it together.",
      points_rewards: [
        "- Per riddle (4 riddle), max 25 pts: correct answer = 12.5 pts, plus participation = members who took part ÷ team size × 12.5.",
        "- Participation is counted per riddle: the Group Leader submits and selects by name who took part (captains don't count).",
        "- Max 4 × 12.5 (answers) + 4 × 12.5 (participation) = 100. Example (12 members): 12, 9, 10 and 6 in the photos → 12.5 + 9.38 + 10.42 + 6.25 = 38.54; 3 correct answers → 37.5; total 76.0.",
      ].join('\n'),
      flourish_hub: 'The Group Leader submits per clue: your answer, a photo that proves it, the IG Story link, and tags everyone who took part. Participation counts everyone tagged across your validated photos.',
      make_it_flourish: "GUESS. FIND. SNAP. Let's flourish together!",
      duration: '21–25 October 2026 · deadline Sunday 25 October, 23:59 WIB.',
    },
    // Skenario 1 — Proportional Scoring (Skema Penilaian Riddle): per riddle 12.5 answer + 12.5 × headcount ÷ team.
    scoring: { type: 'proportional', answer_pts: 12.5, participation_pts: 12.5 },
    form: {
      photo: 'required', link: 'required', link_label: 'Link IG Story', answer_label: 'Jawaban kalian', tag_label: 'Siapa aja yang ikut?',
      confirm: [
        'Foto diambil tim saat challenge ini (bukan foto lama)',
        'IG Story sudah diupload & tag akun event',
        'Pantas & menghormati — tanpa foto orang yang belum memberi izin',
      ],
      checks: ['Foto jelas menunjukkan jawaban', 'Foto diambil saat challenge (bukan foto lama)', 'Jawaban sesuai clue & foto', 'IG Story sudah tag akun event', 'Pantas & tanpa wajah orang tanpa izin'],
      reasons: ['IG tag tidak ada', 'Foto tidak jelas', 'Foto lama / bukan saat challenge', 'Indikasi AI / edit', 'Wajah orang tanpa izin'],
    },
  },
  {
    code: 'R3', kind: 'main', round: 3, name: 'Give and Grow', status: 'scheduled', sort: 3, riddles_per_group: 0,
    schedule: ['2026-10-28T00:00', '2026-10-28T00:00', '2026-11-08T23:59', '2026-11-10T23:59'],
    sections: {"game_idea":"Share a meaningful lesson or practical insight that can help others grow — as a team, in a short video of maximum 60 seconds.","how_to_play":"1. CHOOSE A THEME — pick one of the suggested themes, or propose your own theme for committee approval (proposals by 30 Oct, approval 31 Oct):\n- The Art of Welcoming\n- Little Things That Make a Difference\n- Lessons from Serving\n- Something We Wish Everyone Knew\n2. SHOOT TOGETHER — make one official team video (max 60 seconds). Members take real roles in the offline shooting: acting, camera, directing, lighting, on-site production help.\n3. DOCUMENT — capture behind-the-scenes (BTS) photos or video that show who was involved in the shooting.\n4. ONLINE ALTERNATIVE — members who could not join the offline shooting may post an individual Instagram Reel (15–60 seconds) on the Give and Grow theme.\n5. SUBMIT — by 8 Nov the Group Leader submits the official video link, the BTS link and the members who took part offline; each member who posted a Reel submits their own Reel link in Flourish Hub.","rules":"A. Official team video\n- Each team submits ONE official video for scoring. Additional videos are allowed but earn no extra video points.\n- Maximum duration: 60 seconds.\nB. Offline participation\n- Members must be directly involved in the offline shooting or production: acting, camera operation, directing, lighting, on-site production assistance.\n- Each team submits behind-the-scenes (BTS) documentation showing the members involved in the shooting.\n- Members do not need to appear in the final video if their production involvement is documented.\n- Merely attending, being listed as a team member, or claiming a role without actual involvement does not qualify.\n- Editing, scripting, subtitles and other online-only tasks do not count as offline participation.\nC. Online participation — individual Instagram Reel\n- Members who do not qualify for offline participation may post an individual Instagram Reel instead.\n- The Reel must be 15–60 seconds, relevant to the Give and Grow theme, posted on an existing personal Instagram account, publicly accessible, and tag the official Flourish Together Instagram account.\n- The Reel link must be given to the committee for validation. No new Instagram account is needed.\nD. One member, one participation credit\n- Each member gets participation credit only once, however many shooting sessions or Reels.\n- A member who qualifies offline gets no extra credit for also posting a Reel.\n- Offline and online participation count the same for the participation rate.","connection":"Participation credit is based on verified involvement — not attendance, assigned roles, or the number of submissions. Offline shooting participation and a valid individual Instagram Reel are alternative routes to the same participation credit.","points_rewards":"- Official team video (max 50): challenge & fit 20 · useful / meaningful content 15 · clarity (easy to understand) 10 · team involvement / execution 5.\n- Participation (max 50):\n- Overall participation rate (max 40) = unique validated participants (offline + online, each member once) ÷ total team members × 40.\n- Offline participation (+5) if the team has at least one validated offline participant.\n- Behind the scenes (max 5): BTS photos (at least 3) = 2 · BTS video (at least 15 seconds) = 5. Photos + video still count 5.\n- Max 100. Example (12 members): video 42 + 9 of 12 took part (30) + offline 5 + BTS video 5 = 82.","flourish_hub":"Group Leader: submit once for the team — the official video link (max 60 s), the BTS link (e.g. Google Drive) and the members who took part offline. Members with an individual Reel: open Give and Grow → \"Reels kamu\" and submit your own Reels link (Reels on your personal Instagram, not IG Story; account not private; tag @flourishtogether.ur). The committee verifies everyone; unverified claims are not counted.","what_we_need":"- 30 Oct: deadline for proposed themes · 31 Oct: theme approval\n- 8 Nov, 23:59 WIB: final video, BTS documentation and Instagram Reel links\n- 9 Nov: participation validation · 10 Nov: scoring · 11 Nov: winner announcement","duration":"28 October – 8 November 2026 · deadline Sunday 8 November, 23:59 WIB."},
    scoring: {"type":"give_grow","criteria":[{"key":"fit","label":"Challenge & fit","max":20,"hint":"Follows Give and Grow and one clear theme."},{"key":"useful","label":"Useful / meaningful content","max":15,"hint":"Gives viewers a meaningful lesson or practical insight."},{"key":"clear","label":"Clarity (easy to understand)","max":10,"hint":"Easy to follow and within 60 seconds."},{"key":"team","label":"Team involvement / execution","max":5,"hint":"Shows genuine team involvement in the making."}],"overall_pts":40,"offline_pts":5,"bts_photo_pts":2,"bts_video_pts":5},
    form: {"photo":"none","link":"required","link_label":"Link video resmi tim (maks 60 detik)","answer_label":"Link BTS (foto / video, mis. Google Drive)","answer_optional":true,"tags":true,"tags_optional":true,"tag_label":"Siapa yang ikut OFFLINE (terlibat shooting, ada di BTS)?","confirm":["Satu video resmi tim, maksimal 60 detik","Anggota offline benar-benar terlibat shooting / produksi (terdokumentasi di BTS)"],"checks":["Satu video resmi, maks 60 detik","Sesuai tema Give and Grow","BTS menunjukkan anggota yang terlibat","Reel publik & tag akun resmi","Pantas & tanpa wajah orang tanpa izin"],"reasons":["Lebih dari 60 detik","Link tidak bisa dibuka","Tema tidak sesuai","BTS tidak ada / tidak jelas","Wajah orang tanpa izin"],"reel_link_label":"Link Reels Instagram (diupload di akun IG pribadi)","reel_hint":"Tempel link REELS (bukan IG Story) yang kamu upload di akun Instagram pribadi: 15–60 detik, sesuai tema Give and Grow.","reel_confirm":["Satu video resmi tim, maksimal 60 detik","IG tidak diprivate dan sudah ditag ke akun IG flourishtogether.ur"],"reel_checks":["Reels (bukan IG Story), 15–60 detik","Akun IG pribadi & tidak diprivate","Sudah tag akun IG flourishtogether.ur","Sesuai tema Give and Grow"],"reel_reasons":["Bukan Reels (IG Story)","Akun IG diprivate","Tidak tag flourishtogether.ur","Durasi tidak sesuai","Tema tidak sesuai","Link tidak bisa dibuka"]},
  },
  {
    code: 'R5', kind: 'main', round: 5, name: 'Ingatlah hari ini', status: 'scheduled', sort: 5, riddles_per_group: 0,
    schedule: ['2026-10-12T00:00', '2026-11-10T00:00', '2026-11-15T23:59', '2026-11-16T23:59'],
    sections: {
      game_idea: 'Your team scrapbook / poster of the Flourish Together journey: the photos, moments, quotes and stories you collected along the way.',
      how_to_play: [
        '1. COLLECT — Gather photos, moments, quotes or stories from the journey (11–13 November).',
        '2. CREATE — Arrange your memories into one team scrapbook / poster (11–15 November).',
        '3. SUBMIT — The Group Leader submits the final scrapbook through Flourish Hub by 15 November, 23:59 WIB.',
        'The full format, rules and scoring will be announced by the committee before the challenge opens.',
      ].join('\n'),
      rules: 'Rules will be announced before the challenge opens on 10 November.',
      points_rewards: 'Scoring will be announced before the challenge opens.',
      make_it_flourish: 'Selected memories may be showcased at the Main Event on 21 November.',
      duration: 'Opens 10 November · deadline Sunday 15 November 2026, 23:59 WIB.',
    },
    scoring: { type: 'manual', max: 30, tba: true },
    form: { photo: 'required', link: 'optional', link_label: 'Link file scrapbook (opsional)', tag_label: 'Siapa aja yang ikut?' },
  },
];
