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
    if (screenName === 'swipe') this.renderSwipeScreen();
    if (screenName === 'match') this.renderMatchScreen();
    if (screenName === 'itinerary') this.renderItineraryScreen();
    if (screenName === 'share') this.renderShareScreen();
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
});
