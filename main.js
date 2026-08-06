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

  // === Match Board Rendering ===
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
    if (!this._everyoneBound) {
      this._everyoneBound = true;
      everyoneZone.addEventListener('click', () => {
        const overlaps = Matcher.getOverlaps();
        const activities = overlaps.everyone.map(id =>
          App.state.activities.find(a => a.id === id)).filter(Boolean);
        App.showActivityList('Everyone ❤️', activities);
      });
    }

    // Overlap strips — pairwise
    const stripsContainer = document.getElementById('overlap-strips');

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
            <span>${liker?.emoji || '👤'} likes</span>
            <span class="vs">vs</span>
            <span>${passer?.emoji || '👤'} passed</span>
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
});
