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
