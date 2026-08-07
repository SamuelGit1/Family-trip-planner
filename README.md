# 🛫 Family Trip Planner

**A mobile-first SPA where your family swipes through activities together (like Tinder) to discover overlapping preferences and build a balanced 7-day itinerary.**

🌐 **Live**: [samuelgit1.github.io/Family-trip-planner](https://samuelgit1.github.io/Family-trip-planner/)

---

## How It Works

1. **Set up** — Choose a mode (Kaohsiung, AI, or Global) and meet the four family personas.
2. **Swipe** — Each family member swipes through activities persona-by-persona. ❌ pass, ❤️ like. The app scores every activity against that persona's preferences and constraints in real time.
3. **Match** — See which activities everyone (or any pair) loves, spot conflicts, and get compromise suggestions.
4. **Build** — Drag and drop liked activities across 7 days. Each day shows walking-intensity and duration gauges, plus a Grandma-comfort indicator.
5. **Share** — Copy a formatted text itinerary to your clipboard and restart anytime.

### The Family

| Persona | Age | Loves | Needs |
|---|---|---|---|
| 👩 Mom | 50s | Views, shopping | Half-day activities |
| 👦 Brother | 5 | Dinosaurs | Short attention span, kid-friendly |
| 👵 Grandma | 80s | Views, culture | Low walking, rest spots, max 2h |
| 🧒 You | 15 | Everything | Flexible |

---

## Quick Start

**No install. No build step.** Just open `index.html` in your browser, or visit the live URL above.

```bash
# Clone and open
git clone https://github.com/samuelgit1/Family-trip-planner.git
cd Family-trip-planner
open index.html
```

State is saved to `localStorage` — pick up where you left off.

---

## Modes

### 🏙️ Kaohsiung (Default)

25 pre-loaded activities covering malls, temples, night markets, parks, museums, and a dinosaur zoo. Zero API keys required. Also pulls public events from the Taiwan Government Open Data portal (no auth needed). Perfect for trying the experience immediately.

### 🤖 AI Powered

Uses the **Claude API** to generate fresh activities for Kaohsiung and intelligently re-rank your itinerary. Activities are tailored to your family's personas on the fly.

- **Requires**: A Claude API key from [console.anthropic.com](https://console.anthropic.com)
- **Privacy**: Your key is held in-memory only — never persisted, never stored in `localStorage`, never sent anywhere except directly to `api.anthropic.com`
- **Fallback**: If no key is provided, the app falls back to the pre-loaded activity pool

### 🌍 Global Search

Search for activities in **any city in the world**. Powered by the Brave Search API, which queries the web for family-friendly attractions, kid-friendly spots, and accessible venues — then parses results into swipeable activity cards.

- **Requires** (optional): A Brave Search API key from [brave.com/search/api](https://brave.com/search/api) — free tier includes 2,000 queries/month
- **Fallback**: Leave the key blank to enter activities manually (paste 5–10 items, one per line)
- **Destination**: Type any city name (Tokyo, Paris, Bangkok, etc.)

---

## Project Structure

```
family-trip-planner/
├── index.html              # All 5 screens in a single SPA shell
├── style.css               # Mobile-first styles, card animations, drag-drop
├── main.js                 # App state, navigation, event bindings, API calls
└── engine/
    ├── activities.js       # 25 pre-loaded Kaohsiung activities + 4 persona profiles
    ├── tagMatcher.js       # Compatibility scoring per persona (constraints + tag weights)
    ├── itinerary.js        # 7-day greedy scheduler with constraint-aware drag-drop
    ├── searchFetcher.js    # Brave Search API client + manual entry parser
    └── tagMatcher.test.js  # Unit tests for the match engine
```

**Tech**: Vanilla JavaScript, CSS, HTML. No frameworks, no bundler, no `node_modules`. Deploys directly to GitHub Pages.

---

## APIs Used

| API | Scope | Auth | Notes |
|---|---|---|---|
| Taiwan Government Open Data | Public Kaohsiung events | None | Augments the pre-loaded pool |
| Claude API (`api.anthropic.com`) | Activity generation + itinerary re-ranking | User-provided key | In-memory only, never stored |
| Brave Search API (`api.search.brave.com`) | Web search for any destination | User-provided key | Free tier 2,000 req/month |

---

## Credits

Built as a final project. Swipe, match, travel!
