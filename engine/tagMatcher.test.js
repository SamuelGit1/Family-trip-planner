// engine/tagMatcher.test.js — Comprehensive tests for the Matcher engine
// Run: node engine/tagMatcher.test.js

const fs = require('fs');
const path = require('path');
const vm = require('vm');

// ---- Setup: Load engine files into global scope ----

// 1. Load activities.js to set global PERSONAS and ACTIVITIES
const activitiesCode = fs.readFileSync(
  path.join(__dirname, 'activities.js'), 'utf8'
);
vm.runInThisContext(activitiesCode);

// 2. Set up mock App global (simulating main.js)
global.App = {
  state: {
    mode: 'kaohsiung',
    destination: 'Kaohsiung',
    personas: PERSONAS,
    activities: ACTIVITIES,
    swipes: {
      mom: {},
      brother: {},
      grandma: {},
      you: {}
    },
    itinerary: [],
    loading: false,
    currentScreen: 'swipe',
    currentPersona: 'mom'
  }
};

// 3. Load tagMatcher.js to set global Matcher
const matcherCode = fs.readFileSync(
  path.join(__dirname, 'tagMatcher.js'), 'utf8'
);
vm.runInThisContext(matcherCode);

// ---- Test Harness ----

let passed = 0;
let failed = 0;
const failures = [];

function assert(condition, label) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${label}`);
  } else {
    failed++;
    const msg = `  ✗ FAIL: ${label}`;
    failures.push(msg);
    console.log(msg);
  }
}

function assertEqual(actual, expected, label) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    passed++;
    console.log(`  ✓ ${label}`);
  } else {
    failed++;
    const msg = `  ✗ FAIL: ${label}\n       expected: ${JSON.stringify(expected)}\n       actual:   ${JSON.stringify(actual)}`;
    failures.push(msg);
    console.log(msg);
  }
}

// ---- Scoring Tests ----

console.log('\n=== Matcher.score() — Constraint Checks ===\n');

// Grandma constraints (CRITICAL): reject if walkingLevel !== "low" OR restSpots === false OR duration > "2h"
const grandmaId = 'grandma';

// Grandma + Shoushan (high walking, no rest spots) → auto-reject
const shoushan = ACTIVITIES.find(a => a.id === 'shoushan');
assert(
  Matcher.score(shoushan, grandmaId) === -Infinity,
  'Grandma + Shoushan (high walking, no rest): should be -Infinity'
);

// Grandma + Cijin (high walking, has rest spots) → auto-reject (walking too high)
const cijin = ACTIVITIES.find(a => a.id === 'cijin-island');
assert(
  Matcher.score(cijin, grandmaId) === -Infinity,
  'Grandma + Cijin Island (high walking): should be -Infinity'
);

// Grandma + E-DA (full-day) → auto-reject (duration too long)
const edaworld = ACTIVITIES.find(a => a.id === 'edaworld');
assert(
  Matcher.score(edaworld, grandmaId) === -Infinity,
  'Grandma + E-DA (full-day, high walking): should be -Infinity'
);

// Grandma + Fo Guang Shan (low walking, rest spots, half-day)
// NOTE: half-day > 2h per duration order → rejected by constraint system
const foGuangShan = ACTIVITIES.find(a => a.id === 'fo-guang-shan');
const foGuangScore = Matcher.score(foGuangShan, grandmaId);
console.log(`  [INFO] Grandma + Fo Guang Shan score: ${foGuangScore}`);
console.log(`  [INFO] (half-day > 2h per duration order, so constraint check applies)`);

// Brother constraints (from PERSONAS data): maxWalking=medium, maxDuration=2h
const brotherId = 'brother';

// Brother + E-DA (full-day) → auto-reject
assert(
  Matcher.score(edaworld, brotherId) === -Infinity,
  'Brother + E-DA (full-day): should be -Infinity'
);

// Brother + Dream Mall (half-day, dinosaur tag)
// NOTE: brother maxDuration='2h', dream-mall is half-day → rejected
const dreamMall = ACTIVITIES.find(a => a.id === 'dream-mall');
const dreamMallBrotherScore = Matcher.score(dreamMall, brotherId);
console.log(`  [INFO] Brother + Dream Mall score: ${dreamMallBrotherScore}`);
console.log(`  [INFO] (brother maxDuration='2h', dream-mall duration='half-day')`);

// Brother + Lotus Pond (2h, kid-friendly, cultural) — should pass all constraints
const lotusPond = ACTIVITIES.find(a => a.id === 'lotus-pond');
assert(
  Matcher.score(lotusPond, brotherId) > -Infinity,
  'Brother + Lotus Pond (2h): should NOT be rejected'
);

// Brother + Kaohsiung Zoo (half-day, dinosaur) — rejected (half-day > 2h)
const zoo = ACTIVITIES.find(a => a.id === 'kaohsiung-zoo');
const zooBrotherScore = Matcher.score(zoo, brotherId);
console.log(`  [INFO] Brother + Kaohsiung Zoo score: ${zooBrotherScore}`);

// Brother + Children's Art Park (2h, dinosaur, kid-friendly) — accepted
const kidsLand = ACTIVITIES.find(a => a.id === 'kaohsiung-kids-land');
const kidsLandBrotherScore = Matcher.score(kidsLand, brotherId);
console.log(`  [INFO] Brother + Kids Land score: ${kidsLandBrotherScore}`);

// Mom constraints: maxWalking=medium, restRequired=false, maxDuration=half-day
const momId = 'mom';

// Mom + Dream Mall (low walking, rest, half-day, shopping)
const momDreamScore = Matcher.score(dreamMall, momId);
console.log(`  [INFO] Mom + Dream Mall score: ${momDreamScore}`);

// Mom + Sanduo Shopping (low walking, half-day, shopping)
const sanduo = ACTIVITIES.find(a => a.id === 'sanduo-shopping');
console.log(`  [INFO] Mom + Sanduo Shopping score: ${Matcher.score(sanduo, momId)}`);

// Mom + E-DA (full-day, high walking) → rejected (duration + walking)
assert(
  Matcher.score(edaworld, momId) === -Infinity,
  'Mom + E-DA (full-day): should be -Infinity'
);

// Mom + Shoushan (high walking) → rejected
assert(
  Matcher.score(shoushan, momId) === -Infinity,
  'Mom + Shoushan (high walking): should be -Infinity'
);

// Mom + Lotus Pond (2h, low walking, views, cultural) → should pass
assert(
  Matcher.score(lotusPond, momId) > -Infinity,
  'Mom + Lotus Pond: should NOT be rejected'
);

// "You" persona: maxWalking=high, restRequired=false, maxDuration=full-day → accepts everything
const youId = 'you';
assert(
  Matcher.score(edaworld, youId) > -Infinity,
  'You + E-DA (full-day): should NOT be rejected'
);
assert(
  Matcher.score(shoushan, youId) > -Infinity,
  'You + Shoushan (high walking): should NOT be rejected'
);
assert(
  Matcher.score(dreamMall, youId) > -Infinity,
  'You + Dream Mall: should NOT be rejected'
);

console.log('\n=== Matcher.score() — Tag Weight Scoring ===\n');

// Mom + Dream Mall: tags [shopping, dinosaur, indoor, kid-friendly, interactive]
// Mom weights: shopping=3, views=2, food=1, cultural=1, nature=1, indoor=1
// Score: shopping(3) + indoor(1) = 4
assertEqual(Matcher.score(dreamMall, momId), 4, 'Mom + Dream Mall score = 4');

// Brother + Dream Mall: if not rejected, tags [shopping, dinosaur, indoor, kid-friendly, interactive]
// Brother weights: dinosaur=3, kid-friendly=2, interactive=2, food=1, indoor=1
// Score: dinosaur(3) + indoor(1) + kid-friendly(2) + interactive(2) = 8
// But brother's maxDuration='2h' and dream-mall is half-day, so this is -Infinity
if (Matcher.score(dreamMall, brotherId) > -Infinity) {
  assertEqual(Matcher.score(dreamMall, brotherId), 8, 'Brother + Dream Mall score = 8');
} else {
  console.log('  [SKIP] Brother + Dream Mall rejected by duration constraint');
}

// Grandma + Lotus Pond: tags [views, cultural, nature, kid-friendly]
// Grandma weights: views=2, restSpots=999, food=1, cultural=2, shopping=1, nature=1, indoor=2
// Score: views(2) + cultural(2) + nature(1) = 5
assertEqual(Matcher.score(lotusPond, grandmaId), 5, 'Grandma + Lotus Pond score = 5');

// Grandma + Kaohsiung Museum of History: tags [cultural, indoor]
// Grandma weights: cultural=2, indoor=2 → score = 4
const museumHistory = ACTIVITIES.find(a => a.id === 'kaohsiung-museum-history');
assertEqual(Matcher.score(museumHistory, grandmaId), 4, 'Grandma + Museum of History score = 4');

// Brother + Kids Land: tags [kid-friendly, interactive, dinosaur, nature, indoor]
// Brother weights: dinosaur=3, kid-friendly=2, interactive=2, food=1, indoor=1
// Score: kid-friendly(2) + interactive(2) + dinosaur(3) + indoor(1) = 8
if (Matcher.score(kidsLand, brotherId) > -Infinity) {
  assertEqual(Matcher.score(kidsLand, brotherId), 8, 'Brother + Kids Land score = 8');
} else {
  console.log('  [SKIP] Brother + Kids Land rejected by constraint');
}

// "You" + Dream Mall: tags [shopping, dinosaur, indoor, kid-friendly, interactive]
// "You" weights: everything=1 → score = 5
assertEqual(Matcher.score(dreamMall, youId), 5, 'You + Dream Mall score = 5');

// NOTE: fo-guang-shan has duplicate 'views' tag
// tags: [cultural, views, indoor, views] — two 'views' entries
// Grandma weights: views=2, cultural=2, indoor=2
// Score: cultural(2) + views(2) + indoor(2) + views(2) = 8
// But grandma maxDuration='2h' and fo-guang-shan is half-day → -Infinity
if (Matcher.score(foGuangShan, grandmaId) > -Infinity) {
  assertEqual(Matcher.score(foGuangShan, grandmaId), 8, 'Grandma + Fo Guang Shan score = 8 (duplicate views tag)');
} else {
  console.log('  [SKIP] Grandma + Fo Guang Shan rejected by duration constraint');
}

console.log('\n=== Matcher.score() — Edge Cases ===\n');

// Unknown persona
assertEqual(Matcher.score(dreamMall, 'nonexistent'), 0, 'Unknown persona returns 0');

// Activity with no matching tags
const loveRiver = ACTIVITIES.find(a => a.id === 'love-river');
// Mom weights: shopping=3, views=2, food=1, cultural=1, nature=1, indoor=1
// Love River tags: [views, nature] → views(2) + nature(1) = 3
assertEqual(Matcher.score(loveRiver, momId), 3, 'Mom + Love River score = 3');

// Brother + Love River: tags [views, nature] — brother has no weight for views or nature
// Brother weights: dinosaur=3, kid-friendly=2, interactive=2, food=1, indoor=1
// Score: 0
if (Matcher.score(loveRiver, brotherId) > -Infinity) {
  assertEqual(Matcher.score(loveRiver, brotherId), 0, 'Brother + Love River (no matching tags) score = 0');
}

console.log('\n=== Matcher.getLikes() ===\n');

// Setup swipes — strategically designed for conflict detection.
// getConflicts() checks only: persona[i] likes vs persona[j] passes (j > i).
// PERSONAS array order: mom(0), brother(1), grandma(2), you(3)
App.state.swipes.mom = {
  'dream-mall': 'like',
  'lotus-pond': 'like',
  'shoushan': 'like',
  'liuhe-night-market': 'pass'
};
App.state.swipes.brother = {
  'dream-mall': 'like',
  'lotus-pond': 'like',
  'kaohsiung-zoo': 'like',
  'edaworld': 'like',
  'shoushan': 'pass'           // Brother passes shoushan → conflict with mom
};
App.state.swipes.grandma = {
  'lotus-pond': 'like',
  'fo-guang-shan': 'like',
  'kaohsiung-museum-history': 'like',
  'edaworld': 'pass'           // Grandma passes edaworld → conflict with brother
};
App.state.swipes.you = {
  'dream-mall': 'like',
  'lotus-pond': 'like',
  'liuhe-night-market': 'like',
  'shoushan': 'like',
  'edaworld': 'like'
};

const momLikes = Matcher.getLikes('mom');
assertEqual(momLikes, ['dream-mall', 'lotus-pond', 'shoushan'], 'Mom likes: dream-mall, lotus-pond, shoushan');

const brotherLikes = Matcher.getLikes('brother');
assertEqual(brotherLikes, ['dream-mall', 'lotus-pond', 'kaohsiung-zoo', 'edaworld'], 'Brother likes: dream-mall, lotus-pond, kaohsiung-zoo, edaworld');

const grandmaLikes = Matcher.getLikes('grandma');
assertEqual(grandmaLikes, ['lotus-pond', 'fo-guang-shan', 'kaohsiung-museum-history'], 'Grandma likes: lotus-pond, fo-guang-shan, kaohsiung-museum-history');

const youLikes = Matcher.getLikes('you');
assertEqual(youLikes, ['dream-mall', 'lotus-pond', 'liuhe-night-market', 'shoushan', 'edaworld'], 'You likes: 5 activities');

// Empty swipes for unknown persona
assertEqual(Matcher.getLikes('unknown'), [], 'Unknown persona returns empty likes');

console.log('\n=== Matcher.getOverlaps() ===\n');

const overlaps = Matcher.getOverlaps();

// Everyone likes lotus-pond
assert(
  overlaps.everyone.includes('lotus-pond'),
  'Everyone overlap includes lotus-pond'
);
assertEqual(overlaps.everyone.length, 1, 'Exactly 1 activity liked by everyone');

// Pairs check
assertEqual(overlaps.pairs.length, 6, '6 unique persona pairs');

// Find specific pair: mom & brother → overlap: dream-mall, lotus-pond
const momBrotherPair = overlaps.pairs.find(
  p => p.personas.includes('mom') && p.personas.includes('brother')
);
assert(
  momBrotherPair.activities.includes('dream-mall') && momBrotherPair.activities.includes('lotus-pond'),
  'Mom & Brother overlap: dream-mall, lotus-pond'
);

// Find grandma & you pair → overlap: lotus-pond
const grandmaYouPair = overlaps.pairs.find(
  p => p.personas.includes('grandma') && p.personas.includes('you')
);
assert(
  grandmaYouPair.activities.includes('lotus-pond'),
  'Grandma & You overlap: lotus-pond'
);

// Mom & grandma: only lotus-pond overlaps
const momGrandmaPair = overlaps.pairs.find(
  p => p.personas.includes('mom') && p.personas.includes('grandma')
);
assertEqual(momGrandmaPair.activities, ['lotus-pond'], 'Mom & Grandma overlap: only lotus-pond');

console.log('\n=== Matcher.getConflicts() ===\n');

const conflicts = Matcher.getConflicts();
console.log(`  [INFO] Found ${conflicts.length} conflict(s)`);
conflicts.forEach(c => {
  console.log(`  [INFO]   ${c.activityId}: liked by ${c.likedBy}, passed by ${c.passedBy}`);
});

// With current swipes:
//   (0,1): mom likes {dream-mall, lotus-pond, shoushan}, brother passes {shoushan} → conflict
//   (1,2): brother likes {..., edaworld}, grandma passes {edaworld} → conflict
assertEqual(conflicts.length, 2, 'Exactly 2 conflicts detected');

// Conflict 1: shoushan (liked by mom, passed by brother)
const shoushanConflict = conflicts.find(c => c.activityId === 'shoushan');
assert(
  shoushanConflict !== undefined,
  'Conflict: shoushan detected'
);
if (shoushanConflict) {
  assertEqual(
    { likedBy: shoushanConflict.likedBy, passedBy: shoushanConflict.passedBy },
    { likedBy: 'mom', passedBy: 'brother' },
    'Shoushan conflict: likedBy=mom, passedBy=brother'
  );
}

// Conflict 2: edaworld (liked by brother, passed by grandma)
const edaConflict = conflicts.find(c => c.activityId === 'edaworld');
assert(
  edaConflict !== undefined,
  'Conflict: edaworld detected'
);
if (edaConflict) {
  assertEqual(
    { likedBy: edaConflict.likedBy, passedBy: edaConflict.passedBy },
    { likedBy: 'brother', passedBy: 'grandma' },
    'Edaworld conflict: likedBy=brother, passedBy=grandma'
  );
}

console.log('\n=== Matcher.suggestCompromises() ===\n');

const compromises = Matcher.suggestCompromises();
console.log(`  [INFO] Suggested ${compromises.length} compromise(s): ${compromises.join(', ')}`);
assert(
  Array.isArray(compromises),
  'suggestCompromises returns an array'
);
assert(
  compromises.length <= 5,
  'suggestCompromises returns at most 5 items'
);
// All suggested activities should not be in any persona's swipes
for (const cid of compromises) {
  const isSwiped = PERSONAS.some(p => App.state.swipes[p.id]?.[cid] !== undefined);
  assert(!isSwiped, `Compromise ${cid} is not yet swiped by anyone`);
}

console.log('\n=== Matcher.getRecommendations() ===\n');

// Mom recommendations (should be sorted by score, descending)
const momRecs = Matcher.getRecommendations('mom');
// No -Infinity items should be present
assert(
  momRecs.every(r => r.score > -Infinity),
  'Mom recommendations all have valid scores'
);
// Should be sorted descending
for (let i = 1; i < momRecs.length; i++) {
  assert(
    momRecs[i - 1].score >= momRecs[i].score,
    `Mom recs sorted: ${momRecs[i - 1].id}(${momRecs[i - 1].score}) >= ${momRecs[i].id}(${momRecs[i].score})`
  );
}
console.log(`  [INFO] Mom top 5 recs: ${momRecs.slice(0, 5).map(r => `${r.id}(${r.score})`).join(', ')}`);

// Grandma recommendations
const grandmaRecs = Matcher.getRecommendations('grandma');
console.log(`  [INFO] Grandma top 5 recs: ${grandmaRecs.slice(0, 5).map(r => `${r.id}(${r.score})`).join(', ')}`);

// Brother recommendations
const brotherRecs = Matcher.getRecommendations('brother');
console.log(`  [INFO] Brother top 5 recs: ${brotherRecs.slice(0, 5).map(r => `${r.id}(${r.score})`).join(', ')}`);

// "You" recommendations
const youRecs = Matcher.getRecommendations('you');
console.log(`  [INFO] You top 5 recs: ${youRecs.slice(0, 5).map(r => `${r.id}(${r.score})`).join(', ')}`);

// ---- Summary ----

console.log('\n========================================');
console.log(`  TEST RESULTS: ${passed} passed, ${failed} failed`);
console.log('========================================\n');

if (failures.length > 0) {
  console.log('FAILURES:');
  failures.forEach(f => console.log(f));
  process.exit(1);
} else {
  console.log('All tests passed!\n');
  process.exit(0);
}
