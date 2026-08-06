# Family Trip Planner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a mobile-first SPA where a family swipes through activities persona-by-persona to find overlapping preferences and build a 7-day Kaohsiung itinerary.

**Architecture:** Vanilla JS SPA with 5 screens (Setup, Swipe, Match Board, Itinerary, Share). Tag-based scoring engine for personal matching. Three activity source modes: pre-loaded (Kaohsiung), AI (Claude API), Global (Brave Search API). All browser-side, no backend. Deploy to GitHub Pages.

**Tech Stack:** HTML5, CSS3, Vanilla JS (ES6+), localStorage for persistence, Native Drag & Drop API, Claude API (optional), Brave Search API (optional), Taiwan Government Open Data API (public, no auth).

## Global Constraints

- Must deploy to GitHub Pages (static files only, no server)
- Must work on mobile (mobile-first responsive CSS)
- 3-hour total build target
- AI mode requires user-provided Claude API key (in-memory only, never persisted)
- Global mode uses user-provided Brave Search API key (optional, falls back to manual entry)
- Kaohsiung mode must work with zero API keys
- Grandma constraint: auto-reject activities with `walkingLevel !== "low"` OR `restSpots === false`

---

## File Map

```
/
├── index.html              — Single-page shell, all 5 screen sections
├── style.css               — All styles: mobile-first, card animations, colors
├── main.js                 — App state, screen router, event bindings, localStorage
├── engine/
│   ├── activities.js       — 25 placeholder activities + 4 persona profiles
│   ├── tagMatcher.js       — Compatibility scoring per persona
│   ├── itinerary.js        — 7-day greedy scheduler with constraints
│   └── searchFetcher.js    — Brave Search API → activity cards (Global mode)
└── README.md               — Setup instructions, API key guide, persona guide
```

**Dependency graph:** `activities.js` (no deps) → `tagMatcher.js` (depends on activities.js) → `itinerary.js` (depends on tagMatcher.js). `searchFetcher.js` (no deps). `main.js` depends on all engine files. `index.html` loads everything via `<script>` tags in order.

---

### Task 1: Project Scaffold — HTML Shell + CSS Foundation + State Skeleton

**Files:**
- Create: `index.html`
- Create: `style.css`
- Create: `main.js`

**Interfaces:**
- Produces: `App.state` object (all mutable app state), `App.navigate(screenName)` function, CSS custom properties for persona colors

- [ ] **Step 1: Create index.html with all 5 screen sections**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Family Trip Planner</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div id="app">
    <!-- Screen 1: Setup -->
    <section id="screen-setup" class="screen active">
      <h1>🛫 Family Trip Planner</h1>
      <div id="mode-selector">
        <label class="mode-card">
          <input type="radio" name="mode" value="kaohsiung" checked>
          <span>🏙️ Kaohsiung<br><small>Pre-loaded activities</small></span>
        </label>
        <label class="mode-card">
          <input type="radio" name="mode" value="ai">
          <span>🤖 AI Powered<br><small>LLM-generated activities</small></span>
        </label>
        <label class="mode-card">
          <input type="radio" name="mode" value="global">
          <span>🌍 Global Search<br><small>Any city in the world</small></span>
        </label>
      </div>
      <div id="mode-extra-inputs"></div>
      <div id="persona-cards"></div>
      <button id="btn-start" class="btn-primary">Start Swiping →</button>
    </section>

    <!-- Screen 2: Swipe -->
    <section id="screen-swipe" class="screen">
      <div class="swipe-header">
        <span id="swipe-progress"></span>
        <button id="btn-done-swiping" class="btn-secondary">Done Swiping ✓</button>
      </div>
      <div id="card-stack"></div>
      <div class="swipe-actions">
        <button id="btn-pass" class="btn-swipe btn-pass">❌</button>
        <button id="btn-like" class="btn-swipe btn-like">❤️</button>
      </div>
      <div id="persona-tabs"></div>
    </section>

    <!-- Screen 3: Match Board -->
    <section id="screen-match" class="screen">
      <h2>🎯 Match Board</h2>
      <div id="everyone-zone"></div>
      <div id="overlap-strips"></div>
      <div id="conflict-zone"></div>
      <div class="match-actions">
        <button id="btn-compromise" class="btn-secondary">Suggest Compromises 🔄</button>
        <button id="btn-build-itinerary" class="btn-primary">Build Itinerary →</button>
      </div>
    </section>

    <!-- Screen 4: Itinerary Builder -->
    <section id="screen-itinerary" class="screen">
      <h2>📅 7-Day Itinerary</h2>
      <div id="day-columns"></div>
      <div id="family-happiness"></div>
      <button id="btn-share" class="btn-primary">Share Itinerary →</button>
    </section>

    <!-- Screen 5: Share -->
    <section id="screen-share" class="screen">
      <h2>📋 Your Itinerary</h2>
      <pre id="share-text"></pre>
      <button id="btn-copy" class="btn-primary">📋 Copy to Clipboard</button>
      <button id="btn-restart" class="btn-secondary">🔄 Start Over</button>
    </section>
  </div>

  <script src="engine/activities.js"></script>
  <script src="engine/tagMatcher.js"></script>
  <script src="engine/itinerary.js"></script>
  <script src="engine/searchFetcher.js"></script>
  <script src="main.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create style.css with CSS custom properties, mobile-first base, screen visibility**

```css
/* === CSS Custom Properties === */
:root {
  --mom: #9B59B6;
  --brother: #27AE60;
  --grandma: #E67E22;
  --you: #2980B9;
  --bg: #f8f4ff;
  --card-bg: #ffffff;
  --text: #2c2c2c;
  --text-muted: #888;
  --danger: #e74c3c;
  --radius: 16px;
  --shadow: 0 4px 20px rgba(0,0,0,0.08);
  --font: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: var(--font);
  background: var(--bg);
  color: var(--text);
  min-height: 100dvh;
  display: flex;
  justify-content: center;
}

#app {
  width: 100%;
  max-width: 480px;
  min-height: 100dvh;
  position: relative;
  overflow: hidden;
  background: var(--bg);
}

/* Screen visibility */
.screen {
  display: none;
  flex-direction: column;
  padding: 20px;
  min-height: 100dvh;
}
.screen.active {
  display: flex;
}

/* Buttons */
.btn-primary {
  background: var(--you);
  color: white;
  border: none;
  padding: 14px 32px;
  border-radius: 30px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  width: 100%;
  margin-top: 16px;
}
.btn-secondary {
  background: transparent;
  color: var(--you);
  border: 2px solid var(--you);
  padding: 10px 24px;
  border-radius: 30px;
  font-size: 14px;
  cursor: pointer;
}

/* Mode cards */
#mode-selector {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 16px 0;
}
.mode-card {
  display: block;
  padding: 14px 16px;
  border: 2px solid #ddd;
  border-radius: var(--radius);
  cursor: pointer;
}
.mode-card:has(input:checked) {
  border-color: var(--you);
  background: rgba(41, 128, 185, 0.08);
}
.mode-card input { display: none; }
```

- [ ] **Step 3: Create main.js with App state skeleton and screen navigation**

```js
// main.js — App state, screen navigation, event bindings

const App = {
  state: {
    mode: 'kaohsiung',         // 'kaohsiung' | 'ai' | 'global'
    destination: 'Kaohsiung',   // city name (global mode)
    apiKey: null,              // Claude API key (in-memory only, never persisted)
    braveKey: null,            // Brave Search API key (in-memory only)
    currentScreen: 'setup',
    currentPersona: 'mom',
    personas: [],              // loaded from activities.js
    activities: [],            // loaded from activities.js or API
    swipes: { mom: {}, brother: {}, grandma: {}, you: {} },  // { activityId: 'like' | 'pass' }
    itinerary: [],             // 7 arrays of activity IDs
    loading: false
  },

  navigate(screenName) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const target = document.getElementById(`screen-${screenName}`);
    if (target) target.classList.add('active');
    this.state.currentScreen = screenName;
    this.saveToStorage();
  },

  saveToStorage() {
    const toSave = {
      mode: this.state.mode,
      destination: this.state.destination,
      swipes: this.state.swipes,
      itinerary: this.state.itinerary,
      currentScreen: this.state.currentScreen,
      currentPersona: this.state.currentPersona
    };
    localStorage.setItem('trip-planner-state', JSON.stringify(toSave));
  },

  loadFromStorage() {
    const saved = localStorage.getItem('trip-planner-state');
    if (saved) {
      const parsed = JSON.parse(saved);
      Object.assign(this.state, parsed);
    }
  }
};

// Wait for DOM + engine files to load
document.addEventListener('DOMContentLoaded', () => {
  App.loadFromStorage();
  // Initialize personas and activities from engine/activities.js
  if (typeof ACTIVITIES !== 'undefined') App.state.activities = ACTIVITIES;
  if (typeof PERSONAS !== 'undefined') App.state.personas = PERSONAS;
  App.navigate(App.state.currentScreen || 'setup');
});
```

- [ ] **Step 4: Verify — open index.html in browser**

Run: `open index.html`
Expected: 5 screen sections rendered, only Setup visible. "Start Swiping" button visible. Mode selector with 3 cards. No console errors.

- [ ] **Step 5: Commit**

```bash
git init
git add index.html style.css main.js
git commit -m "feat: scaffold HTML shell, CSS foundation, app state skeleton"
```

---

### Task 2: Activity Data — 25 Placeholders + Persona Profiles

**Files:**
- Create: `engine/activities.js`

**Interfaces:**
- Produces: `ACTIVITIES` (global array of 25 activity objects), `PERSONAS` (global array of 4 persona profile objects)
- Consumes: nothing (standalone data file)

- [ ] **Step 1: Create engine/activities.js with persona profiles**

```js
// engine/activities.js — Pre-loaded Kaohsiung activity pool + persona profiles

const PERSONAS = [
  {
    id: 'mom',
    name: 'Mom',
    emoji: '👩',
    color: '#9B59B6',
    tagWeights: { shopping: 3, views: 2, food: 1, cultural: 1, nature: 1, indoor: 1 },
    constraints: { maxWalking: 'medium', restRequired: false, maxDuration: 'half-day' }
  },
  {
    id: 'brother',
    name: 'Brother (5)',
    emoji: '👦',
    color: '#27AE60',
    tagWeights: { dinosaur: 3, 'kid-friendly': 2, interactive: 2, food: 1, indoor: 1 },
    constraints: { maxWalking: 'medium', restRequired: false, maxDuration: '2h' }
  },
  {
    id: 'grandma',
    name: 'Grandma',
    emoji: '👵',
    color: '#E67E22',
    tagWeights: { views: 2, restSpots: 999, food: 1, cultural: 2, shopping: 1, nature: 1, indoor: 2 },
    constraints: { maxWalking: 'low', restRequired: true, maxDuration: '2h' }
  },
  {
    id: 'you',
    name: 'You',
    emoji: '🧒',
    color: '#2980B9',
    tagWeights: { food: 1, views: 1, shopping: 1, cultural: 1, nature: 1, 'kid-friendly': 1, indoor: 1, interactive: 1, dinosaur: 1 },
    constraints: { maxWalking: 'high', restRequired: false, maxDuration: 'full-day' }
  }
];
```

- [ ] **Step 2: Add 25 placeholder activities to engine/activities.js**

```js
const ACTIVITIES = [
  {
    id: 'dream-mall',
    name: 'Dream Mall',
    emoji: '🛍️',
    description: 'Largest mall in Taiwan, rooftop amusement park with dinosaur exhibit',
    location: 'Cianjhen District',
    walkingLevel: 'low',
    restSpots: true,
    tags: ['shopping', 'dinosaur', 'indoor', 'kid-friendly', 'interactive'],
    cost: 'medium',
    duration: 'half-day',
    source: 'preloaded'
  },
  {
    id: 'lotus-pond',
    name: 'Lotus Pond',
    emoji: '🌸',
    description: 'Scenic lake with Dragon & Tiger Pagodas, beautiful views, flat walking paths',
    location: 'Zuoying District',
    walkingLevel: 'low',
    restSpots: true,
    tags: ['views', 'cultural', 'nature', 'kid-friendly'],
    cost: 'free',
    duration: '2h',
    source: 'preloaded'
  },
  {
    id: 'liuhe-night-market',
    name: 'Liuhe Night Market',
    emoji: '🍢',
    description: 'Famous night market with street food, seafood, and local snacks',
    location: 'Sinsing District',
    walkingLevel: 'medium',
    restSpots: true,
    tags: ['food', 'shopping', 'cultural'],
    cost: 'low',
    duration: '2h',
    source: 'preloaded'
  },
  {
    id: 'fo-guang-shan',
    name: 'Fo Guang Shan Buddha Museum',
    emoji: '🏛️',
    description: 'Massive Buddhist monastery and museum, peaceful, indoor exhibits, wheelchair-friendly',
    location: 'Dashu District',
    walkingLevel: 'low',
    restSpots: true,
    tags: ['cultural', 'views', 'indoor', 'views'],
    cost: 'free',
    duration: 'half-day',
    source: 'preloaded'
  },
  {
    id: 'pier-2',
    name: 'Pier-2 Art Center',
    emoji: '🎨',
    description: 'Outdoor art space in converted warehouses, murals, installations, cafes',
    location: 'Yancheng District',
    walkingLevel: 'medium',
    restSpots: true,
    tags: ['cultural', 'views', 'interactive', 'kid-friendly'],
    cost: 'free',
    duration: '2h',
    source: 'preloaded'
  },
  {
    id: 'cijin-island',
    name: 'Cijin Island',
    emoji: '🏖️',
    description: 'Ferry ride to island with beach, lighthouse, seafood street, bike rentals',
    location: 'Cijin District',
    walkingLevel: 'high',
    restSpots: true,
    tags: ['nature', 'views', 'food', 'kid-friendly'],
    cost: 'low',
    duration: 'half-day',
    source: 'preloaded'
  },
  {
    id: 'shinkuchan',
    name: 'Shinkuchan Shopping District',
    emoji: '👗',
    description: 'Popular shopping streets with boutiques, accessories, and street food',
    location: 'Sinsing District',
    walkingLevel: 'medium',
    restSpots: true,
    tags: ['shopping', 'food', 'indoor'],
    cost: 'medium',
    duration: '2h',
    source: 'preloaded'
  },
  {
    id: 'shoushan',
    name: 'Shoushan (Monkey Mountain)',
    emoji: '🐒',
    description: 'Hiking trails with wild monkeys, city views, nature reserve',
    location: 'Gushan District',
    walkingLevel: 'high',
    restSpots: false,
    tags: ['nature', 'views', 'interactive', 'kid-friendly'],
    cost: 'free',
    duration: 'half-day',
    source: 'preloaded'
  },
  {
    id: 'kaohsiung-museum-history',
    name: 'Kaohsiung Museum of History',
    emoji: '📜',
    description: 'City history in a Japanese-era building, air-conditioned, seated exhibits',
    location: 'Yancheng District',
    walkingLevel: 'low',
    restSpots: true,
    tags: ['cultural', 'indoor'],
    cost: 'low',
    duration: '2h',
    source: 'preloaded'
  },
  {
    id: 'ruifeng-night-market',
    name: 'Ruifeng Night Market',
    emoji: '🧋',
    description: 'Largest night market in Kaohsiung, boba tea, grilled squid, game stalls',
    location: 'Zuoying District',
    walkingLevel: 'medium',
    restSpots: true,
    tags: ['food', 'shopping', 'kid-friendly', 'interactive'],
    cost: 'low',
    duration: '2h',
    source: 'preloaded'
  },
  {
    id: 'love-river',
    name: 'Love River Cruise',
    emoji: '🛶',
    description: 'Scenic boat ride along Love River, city views, seated, relaxing',
    location: 'Yancheng District',
    walkingLevel: 'low',
    restSpots: true,
    tags: ['views', 'nature'],
    cost: 'low',
    duration: '1h',
    source: 'preloaded'
  },
  {
    id: 'central-park',
    name: 'Central Park',
    emoji: '🌳',
    description: 'Urban park with pond, playground, MRT access, shaded benches',
    location: 'Cianjin District',
    walkingLevel: 'low',
    restSpots: true,
    tags: ['nature', 'kid-friendly', 'views'],
    cost: 'free',
    duration: '1h',
    source: 'preloaded'
  },
  {
    id: 'dome-of-light',
    name: 'Dome of Light',
    emoji: '💫',
    description: 'World\'s largest glass artwork in Formosa Boulevard MRT station, quick visit, indoor',
    location: 'Sinsing District',
    walkingLevel: 'low',
    restSpots: true,
    tags: ['views', 'cultural', 'indoor'],
    cost: 'free',
    duration: '1h',
    source: 'preloaded'
  },
  {
    id: 'kaohsiung-zoo',
    name: 'Kaohsiung Zoo',
    emoji: '🦁',
    description: 'Zoo with dinosaur exhibit area, train ride, shaded paths, benches throughout',
    location: 'Gushan District',
    walkingLevel: 'medium',
    restSpots: true,
    tags: ['dinosaur', 'kid-friendly', 'interactive', 'nature'],
    cost: 'low',
    duration: 'half-day',
    source: 'preloaded'
  },
  {
    id: 'taiwan-sugar-museum',
    name: 'Taiwan Sugar Museum',
    emoji: '🍬',
    description: 'Historic sugar factory turned museum, ice cream, train ride, indoor exhibits',
    location: 'Ciaotou District',
    walkingLevel: 'low',
    restSpots: true,
    tags: ['cultural', 'food', 'indoor', 'kid-friendly', 'interactive'],
    cost: 'low',
    duration: '2h',
    source: 'preloaded'
  },
  {
    id: 'weiwuying',
    name: 'National Kaohsiung Center for the Arts (Weiwuying)',
    emoji: '🏟️',
    description: 'Massive arts complex, outdoor park, indoor performances, stunning architecture',
    location: 'Fengshan District',
    walkingLevel: 'medium',
    restSpots: true,
    tags: ['cultural', 'views', 'indoor'],
    cost: 'medium',
    duration: '2h',
    source: 'preloaded'
  },
  {
    id: 'kaohsiung-main-library',
    name: 'Kaohsiung Main Public Library',
    emoji: '📚',
    description: 'Modern glass library with garden terrace, city views, quiet, air-conditioned',
    location: 'Cianjhen District',
    walkingLevel: 'low',
    restSpots: true,
    tags: ['cultural', 'views', 'indoor'],
    cost: 'free',
    duration: '1h',
    source: 'preloaded'
  },
  {
    id: 'chenqing-lake',
    name: 'Chengcing Lake',
    emoji: '🌊',
    description: 'Scenic reservoir with bridges, pavilions, golf course views, flat paths',
    location: 'Niaosong District',
    walkingLevel: 'medium',
    restSpots: true,
    tags: ['views', 'nature'],
    cost: 'low',
    duration: '2h',
    source: 'preloaded'
  },
  {
    id: 'martyr-shrine',
    name: 'Kaohsiung Martyrs\' Shrine',
    emoji: '⛩️',
    description: 'Traditional Chinese shrine with city views, stairs but manageable, photo spot',
    location: 'Gushan District',
    walkingLevel: 'medium',
    restSpots: true,
    tags: ['cultural', 'views'],
    cost: 'free',
    duration: '1h',
    source: 'preloaded'
  },
  {
    id: 'sanduo-shopping',
    name: 'Sanduo Shopping District',
    emoji: '🏬',
    description: 'Cluster of department stores (SOGO, Shin Kong Mitsukoshi), indoor, air-conditioned',
    location: 'Lingya District',
    walkingLevel: 'low',
    restSpots: true,
    tags: ['shopping', 'indoor', 'food'],
    cost: 'high',
    duration: 'half-day',
    source: 'preloaded'
  },
  {
    id: 'kaohsiung-museum-fine-arts',
    name: 'Kaohsiung Museum of Fine Arts',
    emoji: '🖼️',
    description: 'Fine art exhibitions, sculpture garden outside, indoor galleries, cafe on site',
    location: 'Gushan District',
    walkingLevel: 'low',
    restSpots: true,
    tags: ['cultural', 'indoor', 'views'],
    cost: 'low',
    duration: '2h',
    source: 'preloaded'
  },
  {
    id: 'edaworld',
    name: 'E-DA Theme Park',
    emoji: '🎢',
    description: 'Greek-themed amusement park with mall attached, dinosaur zone, rides for all ages',
    location: 'Dashu District',
    walkingLevel: 'high',
    restSpots: true,
    tags: ['kid-friendly', 'dinosaur', 'interactive', 'shopping'],
    cost: 'high',
    duration: 'full-day',
    source: 'preloaded'
  },
  {
    id: 'sizihwan-bay',
    name: 'Sizihwan Bay',
    emoji: '🌅',
    description: 'Sunset viewing spot, sandy beach area, cafes along the waterfront, gentle paths',
    location: 'Gushan District',
    walkingLevel: 'low',
    restSpots: true,
    tags: ['views', 'nature', 'food'],
    cost: 'free',
    duration: '1h',
    source: 'preloaded'
  },
  {
    id: 'tsoying-old-city',
    name: 'Zuoying Old City Wall',
    emoji: '🏯',
    description: 'Historic Qing dynasty city walls and gates, flat walking, cultural heritage',
    location: 'Zuoying District',
    walkingLevel: 'low',
    restSpots: true,
    tags: ['cultural', 'views', 'nature'],
    cost: 'free',
    duration: '1h',
    source: 'preloaded'
  },
  {
    id: 'kaohsiung-kids-land',
    name: 'Kaohsiung Children\'s Art Park',
    emoji: '🎠',
    description: 'Interactive art playground, sand pits, dinosaur sculptures, shaded, perfect for 5-year-olds',
    location: 'Fengshan District',
    walkingLevel: 'low',
    restSpots: true,
    tags: ['kid-friendly', 'interactive', 'dinosaur', 'nature', 'indoor'],
    cost: 'free',
    duration: '2h',
    source: 'preloaded'
  }
];
```

- [ ] **Step 3: Verify — check data integrity in browser console**

Open `index.html`, open DevTools console and run:
```js
console.log(ACTIVITIES.length);   // Expected: 25
console.log(PERSONAS.length);     // Expected: 4
console.log(ACTIVITIES.filter(a => a.walkingLevel === 'low' && a.restSpots).length); // Grandma-compatible count
```

- [ ] **Step 4: Commit**

```bash
git add engine/activities.js
git commit -m "feat: add 25 Kaohsiung placeholder activities + 4 persona profiles"
```

---

### Task 3: Tag Matcher Engine — Compatibility Scoring + Overlap Detection

**Files:**
- Create: `engine/tagMatcher.js`

**Interfaces:**
- Consumes: `PERSONAS` (global from activities.js), `App.state.swipes` (from main.js), activity objects with `tags`, `walkingLevel`, `restSpots`, `duration` fields
- Produces: `Matcher.score(activity, personaId) → number`, `Matcher.getLikes(personaId) → string[]` (activity IDs), `Matcher.getOverlaps() → { everyone, pairs }`, `Matcher.getConflicts() → array`

- [ ] **Step 1: Create engine/tagMatcher.js with scoring and constraint checking**

```js
// engine/tagMatcher.js — Compatibility scoring per persona

const Matcher = {
  /**
   * Score an activity for a given persona.
   * Returns -Infinity if constraints are violated (auto-reject).
   * Positive score = good match. Zero = neutral.
   */
  score(activity, personaId) {
    const persona = PERSONAS.find(p => p.id === personaId);
    if (!persona) return 0;

    // Constraint checks — auto reject
    const c = persona.constraints;
    const walkingOrder = { low: 1, medium: 2, high: 3 };
    if (walkingOrder[activity.walkingLevel] > walkingOrder[c.maxWalking]) return -Infinity;
    if (c.restRequired && !activity.restSpots) return -Infinity;
    const durationOrder = { '1h': 1, '2h': 2, 'half-day': 3, 'full-day': 4 };
    if (durationOrder[activity.duration] > durationOrder[c.maxDuration]) return -Infinity;

    // Tag weight scoring
    let score = 0;
    for (const tag of activity.tags) {
      if (persona.tagWeights[tag]) {
        score += persona.tagWeights[tag];
      }
    }
    return score;
  },

  /** Get sorted list of activity IDs that a persona liked (swiped right) */
  getLikes(personaId) {
    const swipes = App.state.swipes[personaId] || {};
    return Object.entries(swipes)
      .filter(([id, verdict]) => verdict === 'like')
      .map(([id]) => id);
  },

  /** Get sorted activity recommendations for a persona based on scores */
  getRecommendations(personaId) {
    return App.state.activities
      .map(a => ({ id: a.id, score: this.score(a, personaId) }))
      .filter(r => r.score > -Infinity)
      .sort((a, b) => b.score - a.score);
  },

  /** Compute overlap sets across all 4 personas */
  getOverlaps() {
    const sets = {};
    for (const p of PERSONAS) {
      sets[p.id] = new Set(this.getLikes(p.id));
    }

    const allIds = PERSONAS.map(p => p.id);
    const everyone = [...sets[allIds[0]]].filter(id =>
      allIds.every(pid => sets[pid].has(id))
    );

    const pairs = [];
    for (let i = 0; i < allIds.length; i++) {
      for (let j = i + 1; j < allIds.length; j++) {
        const a = allIds[i], b = allIds[j];
        const overlap = [...sets[a]].filter(id => sets[b].has(id));
        pairs.push({ personas: [a, b], activities: overlap });
      }
    }

    return { everyone, pairs };
  },

  /** Find conflicts: activities one persona liked that another passed */
  getConflicts() {
    const conflicts = [];
    const ids = PERSONAS.map(p => p.id);
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const aLikes = new Set(this.getLikes(ids[i]));
        const bPasses = Object.entries(App.state.swipes[ids[j]] || {})
          .filter(([id, v]) => v === 'pass')
          .map(([id]) => id);
        for (const id of bPasses) {
          if (aLikes.has(id)) {
            conflicts.push({
              activityId: id,
              likedBy: ids[i],
              passedBy: ids[j]
            });
          }
        }
      }
    }
    return conflicts;
  },

  /** Find compromise activities: high-scoring for conflicting personas, not yet swiped */
  suggestCompromises() {
    const conflicts = this.getConflicts();
    if (!conflicts.length) return [];

    const involvedPersonas = [...new Set(conflicts.flatMap(c => [c.likedBy, c.passedBy]))];
    const swipedIds = new Set();
    for (const p of PERSONAS) {
      Object.keys(App.state.swipes[p.id] || {}).forEach(id => swipedIds.add(id));
    }

    return App.state.activities
      .filter(a => !swipedIds.has(a.id))
      .map(a => {
        const totalScore = involvedPersonas.reduce((sum, pid) => sum + Math.max(0, this.score(a, pid)), 0);
        return { id: a.id, score: totalScore };
      })
      .filter(r => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(r => r.id);
  }
};
```

- [ ] **Step 2: Verify — test scoring in browser console**

```js
const grandmaActivity = ACTIVITIES[3]; // Fo Guang Shan: low walking, rest spots
console.log(Matcher.score(grandmaActivity, 'grandma')); // Expected: positive number (views + cultural)
console.log(Matcher.score(ACTIVITIES[7], 'grandma'));    // Shoushan: high walking, no rest → Expected: -Infinity
console.log(Matcher.score(ACTIVITIES[0], 'brother'));    // Dream Mall: dinosaur tag → Expected: 3+
```

- [ ] **Step 3: Commit**

```bash
git add engine/tagMatcher.js
git commit -m "feat: tag matcher engine with scoring, overlaps, conflicts, compromise suggestions"
```

---

### Task 4: Swipe Screen — Card Stack Animation + Persona Switcher

**Files:**
- Modify: `main.js` — add swipe screen rendering logic
- Modify: `style.css` — add card stack and swipe animation styles

**Interfaces:**
- Consumes: `App.state.activities`, `App.state.personas`, `App.state.swipes`, `Matcher.getRecommendations()`
- Produces: `App.swipeDeck` internal state (current card index per persona), card drag/touch handlers

- [ ] **Step 1: Add swipe card and persona tab styles to style.css**

```css
/* === Swipe Screen === */
.swipe-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

#card-stack {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  min-height: 400px;
}

.card {
  position: absolute;
  width: 100%;
  max-width: 360px;
  background: var(--card-bg);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  padding: 24px;
  transition: transform 0.3s ease;
  cursor: grab;
  user-select: none;
}
.card:active { cursor: grabbing; }
.card.swiping { transition: none; }
.card.swipe-right { transform: translateX(120%) rotate(20deg); opacity: 0; }
.card.swipe-left  { transform: translateX(-120%) rotate(-20deg); opacity: 0; }
.card.fly-back { transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); }

.card-emoji { font-size: 48px; margin-bottom: 8px; }
.card-name { font-size: 22px; font-weight: 700; margin-bottom: 4px; }
.card-desc { font-size: 14px; color: var(--text-muted); margin-bottom: 12px; }
.card-meta { display: flex; flex-wrap: wrap; gap: 8px; font-size: 13px; }
.card-meta span {
  background: #f0f0f0;
  padding: 4px 10px;
  border-radius: 12px;
}

.swipe-actions {
  display: flex;
  justify-content: center;
  gap: 40px;
  margin: 16px 0;
}
.btn-swipe {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  border: none;
  font-size: 28px;
  cursor: pointer;
  box-shadow: var(--shadow);
  display: flex;
  align-items: center;
  justify-content: center;
}
.btn-pass { background: white; color: var(--danger); }
.btn-like { background: white; color: var(--brother); }

/* Persona Tabs */
#persona-tabs {
  display: flex;
  justify-content: space-around;
  gap: 8px;
  padding: 8px 0;
}
.persona-tab {
  flex: 1;
  text-align: center;
  padding: 10px 4px;
  border-radius: 12px;
  border: 2px solid transparent;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.2s;
}
.persona-tab.active {
  border-color: var(--active-color);
  background: var(--active-bg);
  transform: scale(1.05);
}
.persona-tab .emoji { font-size: 24px; display: block; }
.persona-tab .progress { font-size: 11px; color: var(--text-muted); }
```

- [ ] **Step 2: Add swipe screen rendering and interaction logic to main.js**

```js
// Add to main.js (inside DOMContentLoaded handler, after initial state setup)

// === Swipe Deck State ===
App.swipeDeck = {
  currentIndex: { mom: 0, brother: 0, grandma: 0, you: 0 },
  cardEl: null,
  startX: 0,
  currentX: 0,
  dragging: false
};

App.renderPersonaTabs = function() {
  const container = document.getElementById('persona-tabs');
  container.innerHTML = this.state.personas.map(p => {
    const total = this.state.activities.length;
    const swiped = Object.keys(this.state.swipes[p.id] || {}).length;
    const isActive = this.state.currentPersona === p.id;
    return `
      <div class="persona-tab ${isActive ? 'active' : ''}"
           style="--active-color: ${p.color}; --active-bg: ${p.color}22"
           data-persona="${p.id}">
        <span class="emoji">${p.emoji}</span>
        <span>${p.name.split(' ')[0]}</span>
        <span class="progress">${swiped}/${total}</span>
      </div>`;
  }).join('');

  // Click handlers
  container.querySelectorAll('.persona-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      this.state.currentPersona = tab.dataset.persona;
      this.renderPersonaTabs();
      this.renderCard();
      this.saveToStorage();
    });
  });
};

App.getCardIndex = function(personaId) {
  if (!this.swipeDeck.currentIndex[personaId]) {
    this.swipeDeck.currentIndex[personaId] = 0;
  }
  return this.swipeDeck.currentIndex[personaId];
};

App.getCurrentActivity = function(personaId) {
  const recs = Matcher.getRecommendations(personaId);
  const idx = this.getCardIndex(personaId);
  if (idx >= recs.length) return null;
  return this.state.activities.find(a => a.id === recs[idx].id);
};

App.renderCard = function() {
  const stack = document.getElementById('card-stack');
  const activity = this.getCurrentActivity(this.state.currentPersona);
  const persona = this.state.personas.find(p => p.id === this.state.currentPersona);

  if (!activity) {
    stack.innerHTML = '<div class="card" style="text-align:center;padding:60px 20px;"><h3>🎉 All done!</h3><p>No more activities for ' + persona.name + '</p></div>';
    return;
  }

  const score = Matcher.score(activity, this.state.currentPersona);
  const scoreLabel = score >= 5 ? '🔥 Great match' : score >= 2 ? '👍 Good match' : score >= 0 ? '😐 Neutral' : '';

  stack.innerHTML = `
    <div class="card" id="active-card" data-activity-id="${activity.id}">
      <div class="card-emoji">${activity.emoji}</div>
      <div class="card-name">${activity.name}</div>
      <div class="card-desc">${activity.description}</div>
      <div class="card-meta">
        <span>📍 ${activity.location}</span>
        <span>🚶 ${activity.walkingLevel}</span>
        <span>⏱️ ${activity.duration}</span>
        <span>💰 ${activity.cost}</span>
        ${activity.restSpots ? '<span>🪑 Rest OK</span>' : '<span>⚠️ No rest</span>'}
        ${activity.tags.map(t => '<span>#' + t + '</span>').join('')}
      </div>
      ${scoreLabel ? `<div style="margin-top:8px;font-size:13px;color:var(--text-muted)">${scoreLabel}</div>` : ''}
    </div>`;

  this.cardEl = stack.querySelector('#active-card');
  if (this.cardEl) this.bindCardEvents(this.cardEl);

  // Update swipe progress
  document.getElementById('swipe-progress').textContent =
    `${persona.emoji} ${persona.name}: ${this.getCardIndex(this.state.currentPersona)}/${this.state.activities.length}`;
};

App.bindCardEvents = function(card) {
  card.addEventListener('mousedown', (e) => this.startDrag(e.clientX, card));
  card.addEventListener('touchstart', (e) => this.startDrag(e.touches[0].clientX, card), { passive: false });
};

App.startDrag = function(startX, card) {
  this.swipeDeck.dragging = true;
  this.swipeDeck.startX = startX;
  this.swipeDeck.currentX = startX;
  card.classList.add('swiping');

  const onMove = (clientX) => {
    if (!this.swipeDeck.dragging) return;
    const dx = clientX - this.swipeDeck.startX;
    this.swipeDeck.currentX = clientX;
    const rotate = dx * 0.05;
    card.style.transform = `translateX(${dx}px) rotate(${rotate}deg)`;
  };

  const onEnd = () => {
    if (!this.swipeDeck.dragging) return;
    this.swipeDeck.dragging = false;
    card.classList.remove('swiping');
    const dx = this.swipeDeck.currentX - this.swipeDeck.startX;
    const threshold = card.offsetWidth * 0.4;

    if (dx > threshold) {
      this.doSwipe('like', card);
    } else if (dx < -threshold) {
      this.doSwipe('pass', card);
    } else {
      card.classList.add('fly-back');
      card.style.transform = 'translateX(0) rotate(0deg)';
      setTimeout(() => card.classList.remove('fly-back'), 300);
    }

    document.removeEventListener('mousemove', mouseMove);
    document.removeEventListener('mouseup', onEnd);
    document.removeEventListener('touchmove', touchMove);
    document.removeEventListener('touchend', onEnd);
  };

  const mouseMove = (e) => onMove(e.clientX);
  const touchMove = (e) => onMove(e.touches[0].clientX);

  document.addEventListener('mousemove', mouseMove);
  document.addEventListener('mouseup', onEnd);
  document.addEventListener('touchmove', touchMove, { passive: false });
  document.addEventListener('touchend', onEnd);
};

App.doSwipe = function(verdict, card) {
  const activityId = card.dataset.activityId;
  card.classList.add(verdict === 'like' ? 'swipe-right' : 'swipe-left');

  // Record swipe
  if (!this.state.swipes[this.state.currentPersona]) {
    this.state.swipes[this.state.currentPersona] = {};
  }
  this.state.swipes[this.state.currentPersona][activityId] = verdict;

  // Advance card index
  this.swipeDeck.currentIndex[this.state.currentPersona]++;

  this.saveToStorage();

  // Render next card after animation
  setTimeout(() => {
    this.renderCard();
    this.renderPersonaTabs();
  }, 300);
};

App.renderSwipeScreen = function() {
  this.renderPersonaTabs();
  this.renderCard();
};

// Bind swipe buttons
document.getElementById('btn-pass').addEventListener('click', () => {
  const card = document.getElementById('active-card');
  if (card) App.doSwipe('pass', card);
});
document.getElementById('btn-like').addEventListener('click', () => {
  const card = document.getElementById('active-card');
  if (card) App.doSwipe('like', card);
});

// Done swiping button
document.getElementById('btn-done-swiping').addEventListener('click', () => {
  App.navigate('match');
  App.renderMatchScreen();
});
```

- [ ] **Step 3: Wire navigate() to render swipe screen when entering it**

In `App.navigate()`, add after the `classList.add('active')` line:
```js
if (screenName === 'swipe') this.renderSwipeScreen();
if (screenName === 'match') this.renderMatchScreen();
if (screenName === 'itinerary') this.renderItineraryScreen();
if (screenName === 'share') this.renderShareScreen();
```

- [ ] **Step 4: Verify — test swipe mechanics**

Open `index.html`, set some state manually in console:
```js
App.state.activities = ACTIVITIES;
App.state.personas = PERSONAS;
App.renderSwipeScreen();
```
Expected: card renders, drag works, buttons work, persona tabs switch.

- [ ] **Step 5: Commit**

```bash
git add main.js style.css
git commit -m "feat: swipe screen with card stack animation and persona switcher"
```

---

### Task 5: Match Board Screen — Overlap Visualization

**Files:**
- Modify: `main.js` — add `renderMatchScreen` and related functions
- Modify: `style.css` — add match board styles

**Interfaces:**
- Consumes: `Matcher.getOverlaps()`, `Matcher.getConflicts()`, `App.state.activities`
- Produces: rendered match board DOM with expandable overlap zones

- [ ] **Step 1: Add match board styles to style.css**

```css
/* === Match Board === */
#everyone-zone {
  background: linear-gradient(135deg, #f0f8ff, #e8f4fd);
  border: 2px solid var(--you);
  border-radius: var(--radius);
  padding: 20px;
  text-align: center;
  margin-bottom: 16px;
  animation: pulse 2s infinite;
}
@keyframes pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(41, 128, 185, 0.3); }
  50% { box-shadow: 0 0 0 12px rgba(41, 128, 185, 0); }
}
#everyone-zone .count {
  font-size: 48px;
  font-weight: 800;
  color: var(--you);
}
#everyone-zone .label {
  font-size: 14px;
  color: var(--text-muted);
}

.overlap-strip {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  margin: 8px 0;
  background: white;
  border-radius: var(--radius);
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
}
.overlap-strip .persona-dots {
  display: flex;
  gap: -6px;
}
.overlap-strip .persona-dot {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 2px solid white;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-left: -6px;
}
.overlap-strip .persona-dot:first-child { margin-left: 0; }
.overlap-strip .count-badge {
  background: #eee;
  padding: 4px 10px;
  border-radius: 12px;
  font-weight: 600;
  font-size: 14px;
}
.overlap-strip .expand {
  margin-left: auto;
  color: var(--text-muted);
}

.activity-list {
  padding: 8px 16px;
}
.activity-list-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 0;
  border-bottom: 1px solid #f0f0f0;
  font-size: 14px;
}

/* Conflict zone */
#conflict-zone { margin-top: 16px; }
.conflict-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px;
  margin: 6px 0;
  background: #fff5f5;
  border-radius: 10px;
  font-size: 13px;
}
.conflict-item .vs { color: var(--danger); font-weight: 600; }
```

- [ ] **Step 2: Add match board rendering to main.js**

```js
App.renderMatchScreen = function() {
  const overlaps = Matcher.getOverlaps();

  // Everyone zone
  const everyoneZone = document.getElementById('everyone-zone');
  const everyoneActivities = overlaps.everyone.map(id =>
    this.state.activities.find(a => a.id === id)).filter(Boolean);
  everyoneZone.innerHTML = `
    <div class="count">${everyoneActivities.length}</div>
    <div class="label">activities everyone ❤️ loves</div>
    ${everyoneActivities.length ? '<div style="margin-top:8px;font-size:13px;">Tap to see ↓</div>' : '<div style="margin-top:8px;color:var(--text-muted);font-size:13px;">Keep swiping to find overlaps!</div>'}
  `;
  everyoneZone.addEventListener('click', () => {
    App.showActivityList('Everyone ❤️', everyoneActivities);
  });

  // Overlap strips — pairwise
  const stripsContainer = document.getElementById('overlap-strips');
  const colorMap = {};
  this.state.personas.forEach(p => { colorMap[p.id] = p.color; });

  stripsContainer.innerHTML = overlaps.pairs.map(pair => {
    const activities = pair.activities.map(id =>
      this.state.activities.find(a => a.id === id)).filter(Boolean);
    const personaObjs = pair.personas.map(pid =>
      this.state.personas.find(p => p.id === pid)).filter(Boolean);
    return `
      <div class="overlap-strip" data-pair="${pair.personas.join(',')}">
        <div class="persona-dots">
          ${personaObjs.map(p => `<span class="persona-dot" style="background:${p.color}">${p.emoji}</span>`).join('')}
        </div>
        <span>${personaObjs.map(p => p.name.split(' ')[0]).join(' & ')}</span>
        <span class="count-badge">${activities.length}</span>
        <span class="expand">▶</span>
      </div>`;
  }).join('');

  stripsContainer.querySelectorAll('.overlap-strip').forEach(strip => {
    strip.addEventListener('click', () => {
      const personaIds = strip.dataset.pair.split(',');
      const names = personaIds.map(pid => this.state.personas.find(p => p.id === pid)?.name || pid).join(' & ');
      const pairData = overlaps.pairs.find(
        p => p.personas.join(',') === personaIds.join(',')
      );
      const activities = (pairData?.activities || []).map(id =>
        this.state.activities.find(a => a.id === id)).filter(Boolean);
      App.showActivityList(names, activities);
    });
  });

  // Conflicts
  const confContainer = document.getElementById('conflict-zone');
  const conflicts = Matcher.getConflicts();
  confContainer.innerHTML = conflicts.length
    ? `<h3 style="margin-bottom:8px;">⚠️ Conflicts (${conflicts.length})</h3>` + conflicts.slice(0, 5).map(c => {
        const activity = this.state.activities.find(a => a.id === c.activityId);
        const liker = this.state.personas.find(p => p.id === c.likedBy);
        const passer = this.state.personas.find(p => p.id === c.passedBy);
        return `<div class="conflict-item">
          <span>${activity?.emoji || '📍'} ${activity?.name || c.activityId}</span>
          <span>${liker?.emoji} likes</span>
          <span class="vs">vs</span>
          <span>${passer?.emoji} passed</span>
        </div>`;
      }).join('')
    : '<p style="color:var(--text-muted);">No conflicts! 🎉</p>';
};

App.showActivityList = function(title, activities) {
  // Simple modal/overlay showing an activity list
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:100;display:flex;align-items:center;justify-content:center;';
  overlay.innerHTML = `
    <div style="background:white;border-radius:16px;padding:24px;max-width:400px;width:90%;max-height:70vh;overflow-y:auto;">
      <h3 style="margin-bottom:12px;">${title}</h3>
      <div class="activity-list">
        ${activities.map(a => `
          <div class="activity-list-item">
            <span style="font-size:20px;">${a.emoji}</span>
            <div>
              <strong>${a.name}</strong>
              <div style="font-size:12px;color:var(--text-muted);">${a.location} · ${a.duration}</div>
            </div>
          </div>
        `).join('')}
      </div>
      <button style="margin-top:16px;width:100%;padding:12px;border:none;background:var(--you);color:white;border-radius:12px;cursor:pointer;">Close</button>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('button').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
};

// Wire "Build Itinerary" button
document.getElementById('btn-build-itinerary').addEventListener('click', () => {
  App.navigate('itinerary');
  App.renderItineraryScreen();
});

// Wire "Suggest Compromises" button
document.getElementById('btn-compromise').addEventListener('click', () => {
  const compromiseIds = Matcher.suggestCompromises();
  const activities = compromiseIds.map(id => App.state.activities.find(a => a.id === id)).filter(Boolean);
  if (activities.length) {
    App.showActivityList('🔄 Suggested Compromises', activities);
  } else {
    alert('No compromise suggestions found. Try swiping on more activities!');
  }
});
```

- [ ] **Step 3: Verify — test match board rendering**

```js
// Seed some swipes
App.state.activities = ACTIVITIES;
App.state.personas = PERSONAS;
App.state.swipes = {
  mom: { 'dream-mall': 'like', 'lotus-pond': 'like', 'fo-guang-shan': 'like' },
  brother: { 'dream-mall': 'like', 'kaohsiung-zoo': 'like' },
  grandma: { 'dream-mall': 'like', 'fo-guang-shan': 'like', 'lotus-pond': 'like' },
  you: { 'dream-mall': 'like', 'fo-guang-shan': 'like', 'lotus-pond': 'like' }
};
App.renderMatchScreen();
// Expected: "3 activities everyone loves" (dream-mall, lotus-pond, fo-guang-shan)
```

- [ ] **Step 4: Commit**

```bash
git add main.js style.css
git commit -m "feat: match board with overlap visualization and conflict detection"
```

---

### Task 6: Itinerary Builder — 7-Day Drag & Drop + Constraint Gauges

**Files:**
- Create: `engine/itinerary.js`
- Modify: `main.js` — add `renderItineraryScreen`, drag-and-drop handlers
- Modify: `style.css` — add itinerary styles

**Interfaces:**
- Consumes: `Matcher.getOverlaps()`, `App.state.swipes`, `App.state.activities`, `App.state.personas`
- Produces: `Itinerary.schedule(likedActivityIds) → 7-day array`, `Itinerary.getDayStats(dayActivities) → { walkingLoad, personCoverage, grandmaOk }`

- [ ] **Step 1: Create engine/itinerary.js**

```js
// engine/itinerary.js — 7-day greedy scheduler with grandma constraints

const Itinerary = {
  /**
   * Schedule liked activities across 7 days.
   * Prioritizes "everyone loves" activities, spreads evenly, enforces constraints.
   */
  schedule(likedActivityIds) {
    const activityMap = {};
    for (const id of likedActivityIds) {
      const a = App.state.activities.find(a => a.id === id);
      if (a) activityMap[id] = a;
    }

    const everyone = Matcher.getOverlaps().everyone;
    const others = likedActivityIds.filter(id => !everyone.includes(id));

    // Sort everyone first, then by duration (shorter first for better distribution)
    const sorted = [...everyone, ...others].filter(id => activityMap[id]);

    const days = Array.from({ length: 7 }, () => []); // 7 empty arrays of activity IDs
    let dayIndex = 0;

    for (const id of sorted) {
      const activity = activityMap[id];
      // Try to place in current day; if constraints violated, try next day
      let attempts = 0;
      while (attempts < 7) {
        const currentDay = days[dayIndex % 7];
        if (this.canAddActivity(currentDay, activity)) {
          currentDay.push(id);
          break;
        }
        dayIndex++;
        attempts++;
      }
      // If all days fail, place in the day with fewest activities
      if (attempts >= 7) {
        let minDay = 0;
        for (let i = 1; i < 7; i++) {
          if (days[i].length < days[minDay].length) minDay = i;
        }
        days[minDay].push(id);
      }
      dayIndex++;
    }

    return days;
  },

  /** Check if adding this activity to a day violates grandma constraints */
  canAddActivity(dayActivityIds, newActivity) {
    const activities = dayActivityIds.map(id =>
      App.state.activities.find(a => a.id === id)).filter(Boolean);
    activities.push(newActivity);

    // Count walking load
    const walkingWeight = { low: 1, medium: 2, high: 4 };
    const totalWalking = activities.reduce((sum, a) => sum + (walkingWeight[a.walkingLevel] || 1), 0);

    // Grandma constraint: total walking ≤ 3 weight points per day, ≤ 1 "medium" activity
    const mediumCount = activities.filter(a => a.walkingLevel === 'medium' || a.walkingLevel === 'high').length;
    if (totalWalking > 3 || mediumCount > 1) return false;

    // Duration check: no more than 2 half-day activities or 1 full-day
    const durationWeight = { '1h': 1, '2h': 2, 'half-day': 4, 'full-day': 8 };
    const totalDuration = activities.reduce((sum, a) => sum + (durationWeight[a.duration] || 1), 0);
    if (totalDuration > 8) return false;

    return true;
  },

  /** Get per-day statistics for the itinerary UI */
  getDayStats(dayActivityIds) {
    const activities = dayActivityIds.map(id =>
      App.state.activities.find(a => a.id === id)).filter(Boolean);

    const walkingWeight = { low: 1, medium: 2, high: 4 };
    const totalWalking = activities.reduce((sum, a) => sum + (walkingWeight[a.walkingLevel] || 1), 0);
    const grandmaOk = totalWalking <= 3 && activities.every(a => a.walkingLevel === 'low' || (a.walkingLevel === 'medium' && activities.filter(x => x.walkingLevel !== 'low').length <= 1));

    // Person coverage: which personas liked at least one activity in this day
    const personCoverage = {};
    for (const p of PERSONAS) {
      const likes = new Set(Matcher.getLikes(p.id));
      personCoverage[p.id] = activities.some(a => likes.has(a.id));
    }

    const durationHours = activities.reduce((sum, a) => {
      const map = { '1h': 1, '2h': 2, 'half-day': 4, 'full-day': 8 };
      return sum + (map[a.duration] || 2);
    }, 0);

    return { totalWalking, grandmaOk, personCoverage, durationHours, count: activities.length };
  },

  /** Compute aggregate family happiness score (0-100) */
  getHappinessScore(days) {
    let totalScore = 0;
    let totalActivities = 0;
    for (const day of days) {
      for (const activityId of day) {
        const activity = App.state.activities.find(a => a.id === activityId);
        if (!activity) continue;
        for (const p of PERSONAS) {
          totalScore += Math.max(0, Matcher.score(activity, p.id));
        }
        totalActivities++;
      }
    }
    if (!totalActivities) return 0;
    // Normalize: max possible score per activity is roughly sum of all tag weights for all personas (~20)
    return Math.min(100, Math.round((totalScore / (totalActivities * 20)) * 100));
  }
};
```

- [ ] **Step 2: Add itinerary styles to style.css**

```css
/* === Itinerary === */
#day-columns {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding: 8px 0;
  flex: 1;
}
.day-column {
  min-width: 130px;
  flex: 1;
  background: white;
  border-radius: var(--radius);
  padding: 12px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
}
.day-column h3 {
  font-size: 14px;
  margin-bottom: 8px;
  text-align: center;
}
.day-column .grandma-meter {
  width: 100%;
  height: 6px;
  border-radius: 3px;
  margin-bottom: 8px;
  background: #ddd;
}
.day-column .grandma-meter .fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.3s;
}
.fill.ok { background: var(--brother); }
.fill.warn { background: #f1c40f; }
.fill.bad { background: var(--danger); }

.day-slot {
  min-height: 60px;
  border: 2px dashed #eee;
  border-radius: 10px;
  padding: 4px;
  margin-bottom: 4px;
  transition: border-color 0.2s;
}
.day-slot.drag-over { border-color: var(--you); background: rgba(41, 128, 185, 0.05); }

.day-slot .slot-activity {
  background: #f8f4ff;
  padding: 6px 8px;
  border-radius: 8px;
  margin: 4px 0;
  font-size: 12px;
  cursor: grab;
  display: flex;
  align-items: center;
  gap: 4px;
}

#family-happiness {
  text-align: center;
  padding: 16px;
  margin-top: 8px;
}
#family-happiness .gauge {
  width: 100%;
  height: 10px;
  background: #eee;
  border-radius: 5px;
  margin-top: 8px;
  overflow: hidden;
}
#family-happiness .gauge-fill {
  height: 100%;
  border-radius: 5px;
  background: linear-gradient(90deg, var(--danger), #f1c40f, var(--brother));
  transition: width 0.5s;
}
```

- [ ] **Step 3: Add itinerary rendering to main.js**

```js
App.renderItineraryScreen = function() {
  const overlaps = Matcher.getOverlaps();
  const allLiked = new Set();
  for (const p of PERSONAS) {
    Matcher.getLikes(p.id).forEach(id => allLiked.add(id));
  }

  const days = Itinerary.schedule([...allLiked]);
  App.state.itinerary = days;

  const container = document.getElementById('day-columns');
  container.innerHTML = days.map((dayIds, i) => {
    const stats = Itinerary.getDayStats(dayIds);
    const activities = dayIds.map(id => App.state.activities.find(a => a.id === id)).filter(Boolean);
    const meterClass = stats.totalWalking <= 2 ? 'ok' : stats.totalWalking <= 3 ? 'warn' : 'bad';
    const meterWidth = Math.min(100, (stats.totalWalking / 4) * 100);

    return `
      <div class="day-column" data-day="${i}">
        <h3>Day ${i + 1}</h3>
        <div class="grandma-meter">
          <div class="fill ${meterClass}" style="width:${meterWidth}%"></div>
        </div>
        <div style="font-size:11px;color:var(--text-muted);text-align:center;margin-bottom:4px;">
          ${stats.grandmaOk ? '🟢' : stats.totalWalking > 3 ? '🔴' : '🟡'} Grandma · ${stats.durationHours}h
        </div>
        <div class="day-slot" data-day="${i}">
          ${activities.map(a => `
            <div class="slot-activity" draggable="true" data-activity-id="${a.id}" data-from-day="${i}">
              <span>${a.emoji}</span> ${a.name}
            </div>
          `).join('')}
        </div>
        <div style="font-size:12px;text-align:center;margin-top:4px;">
          ${PERSONAS.map(p => stats.personCoverage[p.id] ? p.emoji : '⬜').join('')}
        </div>
        <div style="font-size:11px;color:var(--text-muted);text-align:center;">
          ${stats.count} activities
        </div>
      </div>`;
  }).join('');

  // Family Happiness gauge
  const happiness = Itinerary.getHappinessScore(days);
  document.getElementById('family-happiness').innerHTML = `
    <strong>Family Happiness</strong>
    <div style="font-size:24px;font-weight:700;color:${happiness >= 60 ? 'var(--brother)' : happiness >= 30 ? '#f1c40f' : 'var(--danger)'}">${happiness}%</div>
    <div class="gauge"><div class="gauge-fill" style="width:${happiness}%"></div></div>
  `;

  // Drag and drop between days
  this.bindItineraryDragDrop();
};

App.bindItineraryDragDrop = function() {
  const slots = document.querySelectorAll('.day-slot');
  const activities = document.querySelectorAll('.slot-activity');

  activities.forEach(el => {
    el.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', JSON.stringify({
        activityId: el.dataset.activityId,
        fromDay: parseInt(el.dataset.fromDay)
      }));
      el.style.opacity = '0.5';
    });
    el.addEventListener('dragend', () => { el.style.opacity = '1'; });
  });

  slots.forEach(slot => {
    slot.addEventListener('dragover', (e) => {
      e.preventDefault();
      slot.classList.add('drag-over');
    });
    slot.addEventListener('dragleave', () => { slot.classList.remove('drag-over'); });
    slot.addEventListener('drop', (e) => {
      e.preventDefault();
      slot.classList.remove('drag-over');
      const data = JSON.parse(e.dataTransfer.getData('text/plain'));
      const toDay = parseInt(slot.dataset.day);
      const fromDay = data.fromDay;

      // Remove from source day
      App.state.itinerary[fromDay] = App.state.itinerary[fromDay].filter(id => id !== data.activityId);
      // Check if valid drop
      const activity = App.state.activities.find(a => a.id === data.activityId);
      if (activity && Itinerary.canAddActivity(App.state.itinerary[toDay], activity)) {
        App.state.itinerary[toDay].push(data.activityId);
      } else {
        // Invalid: snap back
        App.state.itinerary[fromDay].push(data.activityId);
        alert('⚠️ Adding this activity would overload Grandma! Try a different day.');
      }
      App.saveToStorage();
      App.renderItineraryScreen();
    });
  });
};
```

- [ ] **Step 4: Verify — generate itinerary and test drag-drop**

```js
// Seed some swipes then render itinerary
App.state.activities = ACTIVITIES;
App.state.personas = PERSONAS;
App.state.swipes = {
  mom: { 'dream-mall': 'like', 'lotus-pond': 'like', 'fo-guang-shan': 'like', 'shinkuchan': 'like' },
  brother: { 'dream-mall': 'like', 'kaohsiung-zoo': 'like', 'edaworld': 'like' },
  grandma: { 'dream-mall': 'like', 'fo-guang-shan': 'like', 'lotus-pond': 'like', 'love-river': 'like' },
  you: { 'dream-mall': 'like', 'fo-guang-shan': 'like', 'lotus-pond': 'like', 'liuhe-night-market': 'like' }
};
App.renderItineraryScreen();
// Expected: 7 day columns, activities distributed, grandma meters visible, drag and drop works
```

- [ ] **Step 5: Commit**

```bash
git add engine/itinerary.js main.js style.css
git commit -m "feat: itinerary builder with 7-day drag-drop and constraint gauges"
```

---

### Task 7: Setup Screen + Share Screen

**Files:**
- Modify: `main.js` — add `renderSetupScreen`, `renderShareScreen`, mode switching logic
- Modify: `style.css` — add setup and share styles

**Interfaces:**
- Consumes: `App.state`, all engine modules
- Produces: Complete screen flow — user can go from setup → swipe → match → itinerary → share → restart

- [ ] **Step 1: Add setup and share styles to style.css**

```css
/* === Setup Screen === */
#screen-setup h1 { font-size: 28px; text-align: center; margin-bottom: 8px; }
#persona-cards { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 16px 0; }
.persona-card {
  padding: 14px;
  border-radius: var(--radius);
  text-align: center;
  color: white;
  font-weight: 600;
}
.persona-card .p-emoji { font-size: 32px; display: block; }
.persona-card .p-name { font-size: 14px; }
.persona-card .p-detail { font-size: 11px; opacity: 0.85; margin-top: 2px; }

#mode-extra-inputs { margin: 12px 0; }
#mode-extra-inputs input, #mode-extra-inputs textarea {
  width: 100%;
  padding: 12px;
  border: 2px solid #ddd;
  border-radius: 12px;
  font-size: 14px;
  margin-top: 8px;
  font-family: var(--font);
}
#mode-extra-inputs textarea { min-height: 80px; resize: vertical; }
#mode-extra-inputs label { font-size: 13px; color: var(--text-muted); display: block; margin-top: 8px; }

/* Loading spinner */
.spinner {
  display: inline-block;
  width: 20px;
  height: 20px;
  border: 3px solid rgba(255,255,255,0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* === Share Screen === */
#screen-share pre {
  white-space: pre-wrap;
  background: white;
  padding: 16px;
  border-radius: var(--radius);
  font-size: 14px;
  line-height: 1.6;
  max-height: 50vh;
  overflow-y: auto;
}
```

- [ ] **Step 2: Add setup screen rendering to main.js**

```js
App.renderSetupScreen = function() {
  // Persona cards
  document.getElementById('persona-cards').innerHTML = this.state.personas.map(p => `
    <div class="persona-card" style="background:${p.color}">
      <span class="p-emoji">${p.emoji}</span>
      <span class="p-name">${p.name}</span>
      <span class="p-detail">${p.constraints.restRequired ? '🪑 Needs rest' : ''} ${p.constraints.maxWalking === 'low' ? '🐢 Slow pace' : ''}</span>
    </div>
  `).join('');

  // Mode extra inputs
  this.renderModeInputs();

  // Mode change listener
  document.querySelectorAll('input[name="mode"]').forEach(radio => {
    radio.addEventListener('change', () => {
      this.state.mode = radio.value;
      this.renderModeInputs();
    });
  });

  // Restore saved mode
  const savedRadio = document.querySelector(`input[value="${this.state.mode}"]`);
  if (savedRadio) savedRadio.checked = true;
};

App.renderModeInputs = function() {
  const container = document.getElementById('mode-extra-inputs');
  const mode = this.state.mode;

  if (mode === 'ai') {
    container.innerHTML = `
      <label>🤖 Claude API Key <small>(in-memory only, never saved)</small></label>
      <input type="password" id="input-api-key" placeholder="sk-ant-api-..." value="${this.state.apiKey || ''}">
      <p style="font-size:11px;color:var(--text-muted);margin-top:4px;">Activities will be generated by AI + Taiwan gov API</p>`;
    document.getElementById('input-api-key').addEventListener('input', (e) => {
      this.state.apiKey = e.target.value;
    });
  } else if (mode === 'global') {
    container.innerHTML = `
      <label>🌍 Destination City</label>
      <input type="text" id="input-destination" placeholder="Tokyo, Paris, Bangkok..." value="${this.state.destination !== 'Kaohsiung' ? this.state.destination : ''}">
      <label>🔍 Brave Search API Key <small>(optional, free tier)</small></label>
      <input type="password" id="input-brave-key" placeholder="BSA-..." value="${this.state.braveKey || ''}">
      <p style="font-size:11px;color:var(--text-muted);margin-top:4px;">Fetches activities from web search. Leave key blank for manual entry mode.</p>`;
    document.getElementById('input-destination').addEventListener('input', (e) => {
      this.state.destination = e.target.value || 'Kaohsiung';
    });
    document.getElementById('input-brave-key').addEventListener('input', (e) => {
      this.state.braveKey = e.target.value;
    });
  } else {
    container.innerHTML = '<p style="font-size:13px;color:var(--text-muted);">🏙️ 25 pre-loaded Kaohsiung activities + Taiwan tourism events. No API keys needed.</p>';
  }
};

// Start button
document.getElementById('btn-start').addEventListener('click', async () => {
  const mode = App.state.mode;
  App.state.loading = true;
  document.getElementById('btn-start').innerHTML = '<span class="spinner"></span> Loading...';
  document.getElementById('btn-start').disabled = true;

  try {
    if (mode === 'ai' && App.state.apiKey) {
      await App.fetchAIActivities();
    } else if (mode === 'global') {
      App.state.destination = document.getElementById('input-destination')?.value || App.state.destination;
      await App.fetchGlobalActivities();
    }
    // Kaohsiung mode: activities already loaded from activities.js
  } catch (err) {
    console.error('Failed to load activities:', err);
    alert('Failed to load activities. Using pre-loaded pool instead.');
  }

  App.state.loading = false;
  document.getElementById('btn-start').innerHTML = 'Start Swiping →';
  document.getElementById('btn-start').disabled = false;
  App.navigate('swipe');
  App.renderSwipeScreen();
});
```

- [ ] **Step 3: Add share screen rendering to main.js**

```js
App.renderShareScreen = function() {
  const days = App.state.itinerary;
  if (!days.length) {
    document.getElementById('share-text').textContent = 'No itinerary yet. Go back and build one!';
    return;
  }

  let text = `🏙️ Family Trip to ${App.state.destination} — 7 Day Itinerary\n`;
  text += '═'.repeat(40) + '\n\n';

  for (let i = 0; i < days.length; i++) {
    const activities = days[i].map(id => App.state.activities.find(a => a.id === id)).filter(Boolean);
    const stats = Itinerary.getDayStats(days[i]);
    text += `📅 Day ${i + 1}  [${stats.grandmaOk ? '🟢 Grandma OK' : '🔴 Heavy walking'}] [${stats.durationHours}h]\n`;
    text += '─'.repeat(30) + '\n';
    if (!activities.length) {
      text += '  (Rest day / free time)\n';
    } else {
      activities.forEach((a, j) => {
        text += `  ${j + 1}. ${a.emoji} ${a.name} — ${a.location} (${a.duration})\n`;
      });
    }
    text += '\n';
  }

  const happiness = Itinerary.getHappinessScore(days);
  text += '═'.repeat(40) + '\n';
  text += `❤️ Family Happiness Score: ${happiness}%\n`;
  text += `Generated by Family Trip Planner — swipe, match, travel!\n`;

  document.getElementById('share-text').textContent = text;
};

// Copy button
document.getElementById('btn-copy').addEventListener('click', () => {
  const text = document.getElementById('share-text').textContent;
  navigator.clipboard.writeText(text).then(() => {
    const btn = document.getElementById('btn-copy');
    btn.textContent = '✅ Copied!';
    setTimeout(() => { btn.textContent = '📋 Copy to Clipboard'; }, 2000);
  });
});

// Restart button
document.getElementById('btn-restart').addEventListener('click', () => {
  if (confirm('Start over? This will clear all swipes and itinerary.')) {
    App.state.swipes = { mom: {}, brother: {}, grandma: {}, you: {} };
    App.state.itinerary = [];
    App.state.currentPersona = 'mom';
    App.swipeDeck.currentIndex = { mom: 0, brother: 0, grandma: 0, you: 0 };
    App.saveToStorage();
    App.navigate('setup');
    App.renderSetupScreen();
  }
});
```

- [ ] **Step 4: Verify — test full screen flow**

Start from setup, select modes, click "Start Swiping" → swipe cards → "Done Swiping" → match board → "Build Itinerary" → drag activities → "Share" → copy → restart.

- [ ] **Step 5: Commit**

```bash
git add main.js style.css
git commit -m "feat: setup screen with mode selection, share screen with copy and restart"
```

---

### Task 8: AI Mode — Claude API Integration

**Files:**
- Modify: `main.js` — add `fetchAIActivities`, LLM call functions

**Interfaces:**
- Consumes: `App.state.apiKey`, `App.state.personas`
- Produces: `App.fetchAIActivities()` populates `App.state.activities` with LLM-generated items

- [ ] **Step 1: Add LLM API functions to main.js**

```js
App.fetchAIActivities = async function() {
  const apiKey = this.state.apiKey;
  if (!apiKey) throw new Error('No API key provided');

  const personaDescriptions = this.state.personas.map(p =>
    `${p.name}: likes ${Object.entries(p.tagWeights).filter(([k,v]) => v > 1).map(([k]) => k).join(', ')}, max walking ${p.constraints.maxWalking}`
  ).join('; ');

  const prompt = `Generate 20 family-friendly activities in Kaohsiung, Taiwan suitable for a family with these members:
${personaDescriptions}

Return ONLY valid JSON array. Each activity must have these exact fields:
{
  "id": "kebab-case-name",
  "name": "Activity Name",
  "emoji": "one emoji",
  "description": "one sentence",
  "location": "District name in Kaohsiung",
  "walkingLevel": "low|medium|high",
  "restSpots": true|false,
  "tags": ["tag1", "tag2", ...],
  "cost": "free|low|medium|high",
  "duration": "1h|2h|half-day|full-day"
}

Important: include several low-walking activities with rest spots for grandma (80s), and dinosaur-themed activities for a 5-year-old boy.`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-5-20241022',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  if (!response.ok) throw new Error(`API error: ${response.status}`);

  const data = await response.json();
  const text = data.content[0].text;
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error('No JSON found in response');

  const aiActivities = JSON.parse(jsonMatch[0]).map((a, i) => ({
    ...a,
    id: a.id || `ai-${i}`,
    source: 'ai-generated'
  }));

  // Merge with pre-loaded, deduplicate by name similarity
  const existingNames = new Set(this.state.activities.map(a => a.name.toLowerCase()));
  const novel = aiActivities.filter(a => !existingNames.has(a.name.toLowerCase()));
  this.state.activities = [...this.state.activities, ...novel];
};

App.fetchAIItinerary = async function() {
  const apiKey = this.state.apiKey;
  if (!apiKey) return;

  const likes = {};
  for (const p of this.state.personas) {
    likes[p.id] = Matcher.getLikes(p.id).map(id => {
      const a = this.state.activities.find(a => a.id === id);
      return a ? a.name : id;
    });
  }

  const prompt = `Here are activities each family member liked in Kaohsiung:
${JSON.stringify(likes, null, 2)}

Build a 7-day itinerary respecting:
- Grandma (80s): max 1 hour walking per activity, needs rest spots, max 2 walking activities per day
- Brother (5): short attention span, loves dinosaurs — at least one fun activity per day
- Mom (50s): loves views and shopping
- Spread activities evenly, no day overloaded

Return ONLY valid JSON: { "days": [["activity-name-1", "activity-name-2"], ...] }`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-5-20241022',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  if (!response.ok) return;

  const data = await response.json();
  const text = data.content[0].text;
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return;

  const result = JSON.parse(jsonMatch[0]);
  // Map activity names back to IDs
  const nameToId = {};
  for (const a of this.state.activities) {
    nameToId[a.name.toLowerCase()] = a.id;
  }

  this.state.itinerary = result.days.map(dayNames =>
    dayNames.map(name => nameToId[name.toLowerCase()] || name).filter(Boolean)
  );
};

// Wire AI itinerary button (on match screen)
document.getElementById('btn-build-itinerary').addEventListener('click', async () => {
  if (App.state.mode === 'ai' && App.state.apiKey) {
    document.getElementById('btn-build-itinerary').innerHTML = '<span class="spinner"></span> AI is planning...';
    await App.fetchAIItinerary();
  }
  App.navigate('itinerary');
  App.renderItineraryScreen();
});
```

- [ ] **Step 2: Verify — test AI mode**

Start with mode "AI Powered", paste a Claude API key, click Start Swiping. Check that additional activities appear. Swipe through, go to match board, click Build Itinerary. AI should generate itinerary.

- [ ] **Step 3: Commit**

```bash
git add main.js
git commit -m "feat: AI mode with Claude API integration for activity generation and itinerary"
```

---

### Task 9: Global Mode — Brave Search API + searchFetcher.js

**Files:**
- Create: `engine/searchFetcher.js`
- Modify: `main.js` — add `fetchGlobalActivities`

**Interfaces:**
- Consumes: `App.state.destination`, `App.state.braveKey`
- Produces: `SearchFetcher.fetchActivities(destination, apiKey) → Activity[]`

- [ ] **Step 1: Create engine/searchFetcher.js**

```js
// engine/searchFetcher.js — Brave Search API → activity cards for any destination

const SearchFetcher = {
  BRAVE_API: 'https://api.search.brave.com/res/v1/web/search',

  /** Fetch activities for a destination using Brave Search */
  async fetchActivities(destination, apiKey) {
    if (!apiKey) return this.manualEntry(); // fallback

    const queries = [
      `best family-friendly activities in ${destination}`,
      `things to do with young kids in ${destination}`,
      `accessible attractions elderly friendly ${destination}`
    ];

    try {
      const results = await Promise.all(
        queries.map(q => this.search(q, apiKey))
      );
      const allResults = results.flat();

      // Deduplicate by URL
      const seen = new Set();
      const unique = allResults.filter(r => {
        if (seen.has(r.url)) return false;
        seen.add(r.url);
        return true;
      });

      // Parse into activity objects
      return unique.slice(0, 25).map((r, i) => this.parseResult(r, i, destination));
    } catch (err) {
      console.error('Brave Search failed:', err);
      return this.manualEntry();
    }
  },

  /** Single search query */
  async search(query, apiKey) {
    const url = `${this.BRAVE_API}?q=${encodeURIComponent(query)}&count=10`;
    const resp = await fetch(url, {
      headers: { 'X-Subscription-Token': apiKey }
    });
    if (!resp.ok) throw new Error(`Brave API error: ${resp.status}`);
    const data = await resp.json();
    return (data.web?.results || []).map(r => ({
      title: r.title,
      description: r.description || '',
      url: r.url
    }));
  },

  /** Parse a search result snippet into an activity object */
  parseResult(result, index, destination) {
    const title = result.title.replace(/[-–|].*$/, '').trim();
    const desc = result.description || '';

    // Auto-tag from keywords in title + description
    const text = (title + ' ' + desc).toLowerCase();
    const tags = [];
    if (/museum|gallery|exhibit|history|temple|shrine|cultural/.test(text)) tags.push('cultural');
    if (/park|garden|nature|hike|beach|lake|mountain|trail/.test(text)) tags.push('nature');
    if (/shop|mall|market|boutique|store/.test(text)) tags.push('shopping');
    if (/food|restaurant|cafe|eat|cuisine|market/.test(text)) tags.push('food');
    if (/kid|child|family|dinosaur|zoo|aquarium|playground/.test(text)) tags.push('kid-friendly');
    if (/interactive|hands-on|workshop|game|ride/.test(text)) tags.push('interactive');
    if (/view|scenic|panorama|lookout|sunset/.test(text)) tags.push('views');
    if (/indoor|mall|museum|inside|air-conditioned/.test(text)) tags.push('indoor');
    if (/dinosaur/.test(text)) tags.push('dinosaur');

    // Infer walking level from keywords
    let walkingLevel = 'medium';
    if (/hike|climb|trek|trail|mountain|steep/.test(text)) walkingLevel = 'high';
    if (/flat|accessible|wheelchair|easy walk|stroll|indoor|mall|museum/.test(text)) walkingLevel = 'low';

    // Infer rest spots
    const restSpots = !/remote|wilderness|hike|steep trail/.test(text);

    // Infer duration
    let duration = '2h';
    if (/full day|day trip|spend the day/.test(text)) duration = 'full-day';
    if (/half day|morning|afternoon/.test(text)) duration = 'half-day';
    if (/quick stop|photo stop|pass by/.test(text)) duration = '1h';

    // Infer cost
    let cost = 'medium';
    if (/free|no charge|complimentary/.test(text)) cost = 'free';
    if (/cheap|affordable|budget/.test(text)) cost = 'low';
    if (/expensive|luxury|premium/.test(text)) cost = 'high';

    return {
      id: `global-${index}`,
      name: title,
      emoji: this.pickEmoji(tags),
      description: desc.slice(0, 120) || `Activity in ${destination}`,
      location: destination,
      walkingLevel,
      restSpots,
      tags: tags.length ? [...new Set(tags)] : ['cultural'],
      cost,
      duration,
      source: 'web-search'
    };
  },

  /** Pick an emoji based on tags */
  pickEmoji(tags) {
    if (tags.includes('food')) return '🍜';
    if (tags.includes('shopping')) return '🛍️';
    if (tags.includes('nature')) return '🌿';
    if (tags.includes('cultural')) return '🏛️';
    if (tags.includes('kid-friendly')) return '🎠';
    if (tags.includes('dinosaur')) return '🦕';
    if (tags.includes('views')) return '🌅';
    return '📍';
  },

  /** Fallback: manual entry textarea → activity cards */
  manualEntry() {
    // This returns a placeholder that the UI handles with a textarea
    return null; // Signal to UI to show manual entry form
  },

  /** Parse manual text entry into activities */
  parseManual(text, destination) {
    return text.split('\n')
      .filter(line => line.trim())
      .map((line, i) => {
        // Format: "Activity Name — brief description"
        const parts = line.split(/[—–-]/);
        const name = (parts[0] || line).trim();
        return {
          id: `manual-${i}`,
          name: name,
          emoji: '📍',
          description: (parts[1] || `Activity in ${destination}`).trim(),
          location: destination,
          walkingLevel: 'medium',
          restSpots: true,
          tags: [],
          cost: 'medium',
          duration: '2h',
          source: 'web-search'
        };
      });
  }
};
```

- [ ] **Step 2: Add global mode integration to main.js**

```js
App.fetchGlobalActivities = async function() {
  const destination = this.state.destination;
  const apiKey = this.state.braveKey;

  if (apiKey) {
    const activities = await SearchFetcher.fetchActivities(destination, apiKey);
    if (activities) {
      this.state.activities = activities;
      return;
    }
  }

  // Fallback: show manual entry
  await this.showManualEntry(destination);
};

App.showManualEntry = function(destination) {
  return new Promise((resolve) => {
    const container = document.createElement('div');
    container.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:100;display:flex;align-items:center;justify-content:center;';
    container.innerHTML = `
      <div style="background:white;border-radius:16px;padding:24px;max-width:400px;width:90%;">
        <h3>🌍 Activities in ${destination}</h3>
        <p style="font-size:13px;color:var(--text-muted);margin:8px 0;">No search API key provided. Paste 5-10 activities below, one per line:</p>
        <p style="font-size:11px;color:var(--text-muted);">Format: Activity Name — brief description</p>
        <textarea id="manual-activities" rows="8" style="width:100%;padding:12px;border-radius:12px;border:2px solid #ddd;font-family:var(--font);font-size:14px;margin-top:8px;" placeholder="Dream Mall — largest mall with rooftop dinosaur park&#10;Lotus Pond — scenic lake with pagodas, easy walk&#10;..."></textarea>
        <button id="btn-manual-submit" class="btn-primary">Start Swiping →</button>
      </div>`;
    document.body.appendChild(container);

    document.getElementById('btn-manual-submit').addEventListener('click', () => {
      const text = document.getElementById('manual-activities').value;
      if (text.trim()) {
        App.state.activities = SearchFetcher.parseManual(text, destination);
      }
      container.remove();
      resolve();
    });
  });
};
```

- [ ] **Step 3: Verify — test Global mode**

Enter "Tokyo" as destination with a Brave Search API key. Check that activities are fetched from web search results and parsed into cards. Test without key — manual entry modal should appear.

- [ ] **Step 4: Commit**

```bash
git add engine/searchFetcher.js main.js
git commit -m "feat: global mode with Brave Search API and manual entry fallback"
```

---

### Task 10: README + Final Polish + GitHub Pages Deploy

**Files:**
- Create: `README.md`
- Modify: `index.html` — minor polish (loading states, empty states)
- Modify: `style.css` — last visual tweaks

- [ ] **Step 1: Create README.md**

```markdown
# Family Trip Planner 🛫

A mobile-first web app to plan a 7-day family trip by swiping through activities persona-by-persona. Finds where everyone's preferences overlap and builds a grandma-friendly itinerary.

## How It Works

1. **Setup** — Pick a mode: Kaohsiung (pre-loaded), AI (LLM), or Global (web search)
2. **Swipe** — Swipe through activities as Mom, Brother (5), Grandma (80s), and You. Left = pass, right = like.
3. **Match** — See which activities everyone loves, where preferences clash
4. **Build** — Drag activities into 7 day slots. Grandma's walking limits are enforced.
5. **Share** — Copy your itinerary as text.

## Three Modes

| Mode | Activities From | API Key Needed? |
|------|----------------|-----------------|
| 🏙️ Kaohsiung | 25 pre-loaded + Taiwan gov API | None |
| 🤖 AI Powered | Claude API generates + Taiwan gov API | Claude API key |
| 🌍 Global | Brave Search for any city worldwide | Brave Search key (optional) |

## Getting API Keys

- **Claude API:** https://console.anthropic.com — free credits available
- **Brave Search:** https://api.search.brave.com — 2,000 free queries/month

Keys are stored in-memory only and never persisted to localStorage or sent anywhere except the respective API.

## Run Locally

Just open `index.html` in a browser. No build step, no server.

## Deploy

Push to GitHub and enable GitHub Pages on the main branch. That's it.

## Tech

Vanilla JS, CSS, HTML. No frameworks, no backend, no dependencies.
```

- [ ] **Step 2: Final polish — add loading states and empty state messages**

Add to the start button handler (already done in Task 7). Add empty state for match board when no swipes exist:

```js
// In renderMatchScreen, check for swipes
const allSwipes = Object.values(App.state.swipes).flatMap(s => Object.keys(s));
if (allSwipes.length === 0) {
  document.getElementById('everyone-zone').innerHTML = `
    <div style="padding:20px;text-align:center;">
      <div style="font-size:48px;">🏙️</div>
      <p>No swipes yet! Go back and swipe through some activities first.</p>
    </div>`;
  return;
}
```

- [ ] **Step 3: Verify — full end-to-end test**

Test all three modes: Kaohsiung (no keys), AI (Claude key), Global (Brave key). Test mobile in Chrome DevTools device mode. Test copy, restart, localStorage persistence.

- [ ] **Step 4: Deploy to GitHub Pages**

```bash
git add README.md index.html style.css main.js
git commit -m "docs: README and final polish"
# Push to GitHub and enable Pages in repo settings
```

---

## Verification Checklist

After all tasks complete, verify end-to-end:

1. **Kaohsiung mode — no API keys:** Open index.html → Start Swiping → Swipe 10+ cards across 2+ personas → Match board shows overlaps → Build itinerary → Days have grandma meters → Share copies text → Restart works
2. **AI mode — Claude key:** Select AI mode → Paste key → Start → LLM activities appear → Swipe → AI itinerary → Share
3. **Global mode — Brave key:** Select Global → Enter "Tokyo" → Paste Brave key → Start → Web activities appear → Swipe → Match → Itinerary
4. **Global mode — no Brave key:** Select Global → Enter "Paris" → No key → Manual entry modal → Paste 5 lines → Swipe → Match → Itinerary
5. **Constraints:** Swipe right on Shoushan (high walking, no rest) as Grandma → Check that it auto-rejects or shows score -Infinity
6. **localStorage:** Refresh page mid-swipe → state restores to same screen + same progress
7. **Mobile:** Chrome DevTools → iPhone 14 view → all screens usable, cards swipe via touch, itinerary scrolls horizontally
8. **GitHub Pages:** Push to GitHub → enable Pages → open live URL on phone → full flow works

