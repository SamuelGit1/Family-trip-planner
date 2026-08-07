// main.js — App state, screen navigation, event bindings

const App = {
  state: {
    mode: 'kaohsiung',         // 'kaohsiung' | 'ai' | 'global'
    destination: 'Kaohsiung',   // city name (global mode)
    apiKey: null,              // Claude API key (in-memory only, never persisted)
    braveKey: null,            // Brave Search API key (in-memory only)
    currentScreen: 'setup',
    currentPersona: 'adult',
    personas: [],              // loaded from activities.js
    activities: [],            // loaded from activities.js or API
    swipes: { adult: {}, child: {}, elderly: {}, you: {} },  // { activityId: 'like' | 'pass' }
    itinerary: [],             // N arrays of activity IDs
    tripDays: 7,               // configurable trip length (2–14)
    loading: false
  },

  navigate(screenName) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const target = document.getElementById(`screen-${screenName}`);
    if (target) target.classList.add('active');
    if (screenName === 'swipe' && this.renderSwipeScreen) this.renderSwipeScreen();
    if (screenName === 'match' && this.renderMatchScreen) this.renderMatchScreen();
    if (screenName === 'itinerary' && this.renderItineraryScreen) this.renderItineraryScreen();
    if (screenName === 'share' && this.renderShareScreen) this.renderShareScreen();
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
      currentPersona: this.state.currentPersona,
      tripDays: this.state.tripDays,
      customPersonas: PERSONAS.slice()  // persist persona config
    };
    localStorage.setItem('trip-planner-state', JSON.stringify(toSave));
  },

  loadFromStorage() {
    const saved = localStorage.getItem('trip-planner-state');
    if (saved) {
      const parsed = JSON.parse(saved);
      Object.assign(this.state, parsed);
      // Restore custom personas if saved
      if (parsed.customPersonas) {
        // Replace PERSONAS array in-place
        PERSONAS.length = 0;
        PERSONAS.push(...parsed.customPersonas);
        this.state.personas = PERSONAS;
      }
    }
  },

  /** Create empty swipes for all current personas */
  initSwipes() {
    const swipes = {};
    for (const p of PERSONAS) {
      swipes[p.id] = this.state.swipes[p.id] || {};
    }
    return swipes;
  },

  /** Create zero currentIndex for all current personas */
  initCurrentIndex() {
    const idx = {};
    for (const p of PERSONAS) {
      idx[p.id] = 0;
    }
    return idx;
  },

  /** Sync swipes and currentIndex after persona changes */
  syncPersonaData() {
    // Add entries for new personas, keep existing for retained ones
    const newSwipes = {};
    const newIndex = {};
    for (const p of PERSONAS) {
      newSwipes[p.id] = this.state.swipes[p.id] || {};
      newIndex[p.id] = (this.swipeDeck && this.swipeDeck.currentIndex && this.swipeDeck.currentIndex[p.id]) || 0;
    }
    this.state.swipes = newSwipes;
    if (this.swipeDeck) this.swipeDeck.currentIndex = newIndex;
  },

  renderSetupScreen() {
    // Persona cards with edit/remove buttons
    const cardsContainer = document.getElementById('persona-cards');
    cardsContainer.innerHTML = this.state.personas.map((p, i) => `
      <div class="persona-card" style="background:${p.color}">
        <span class="p-emoji">${p.emoji}</span>
        <span class="p-name">${p.name}</span>
        <span class="p-detail">${p.constraints.restRequired ? '🪑 Needs rest' : ''} ${p.constraints.maxWalking === 'low' ? '🐢 Slow pace' : ''} ${p.constraints.maxWalking === 'high' ? '🏃 Active' : ''}</span>
        <div class="p-actions">
          <button class="p-btn edit-persona" data-index="${i}" title="Edit">✎</button>
          ${this.state.personas.length > 1 ? `<button class="p-btn remove-persona" data-index="${i}" title="Remove">✕</button>` : ''}
        </div>
      </div>
    `).join('');

    // Edit persona handler
    cardsContainer.querySelectorAll('.edit-persona').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.index);
        this.openPersonaEditor(idx);
      });
    });

    // Remove persona handler
    cardsContainer.querySelectorAll('.remove-persona').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.index);
        if (this.state.personas.length <= 1) return;
        const removed = this.state.personas[idx];
        // Remove from PERSONAS global
        PERSONAS.splice(idx, 1);
        this.state.personas = PERSONAS;
        // Sync swipes
        if (this.state.swipes[removed.id]) delete this.state.swipes[removed.id];
        if (this.swipeDeck && this.swipeDeck.currentIndex && this.swipeDeck.currentIndex[removed.id]) {
          delete this.swipeDeck.currentIndex[removed.id];
        }
        if (this.state.currentPersona === removed.id) {
          this.state.currentPersona = PERSONAS[0]?.id || 'adult';
        }
        this.saveToStorage();
        this.renderSetupScreen();
      });
    });

    // Add persona button
    const addBtn = document.getElementById('btn-add-persona');
    if (addBtn) {
      const newAddBtn = addBtn.cloneNode(true);
      addBtn.parentNode.replaceChild(newAddBtn, addBtn);
      newAddBtn.addEventListener('click', () => this.openPersonaEditor(-1));
    }

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

    // Trip duration slider
    const daysSlider = document.getElementById('input-days');
    const daysLabel = document.getElementById('days-label');
    if (daysSlider) {
      daysSlider.value = this.state.tripDays;
      daysLabel.textContent = `${this.state.tripDays} days`;
      daysSlider.addEventListener('input', () => {
        this.state.tripDays = parseInt(daysSlider.value);
        daysLabel.textContent = `${this.state.tripDays} days`;
      });
    }
  },

  renderModeInputs() {
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
  },

  ALL_TAGS: ['shopping', 'views', 'food', 'cultural', 'nature', 'indoor', 'kid-friendly', 'interactive', 'dinosaur'],

  /** Open persona editor modal. Pass index to edit, or -1 to create new. */
  openPersonaEditor(index) {
    const overlay = document.getElementById('persona-editor-overlay');
    const isNew = index < 0;
    const persona = isNew ? {
      id: 'traveler' + (PERSONAS.length + 1),
      name: '',
      emoji: '🧑',
      color: '#3498DB',
      tagWeights: {},
      constraints: { maxWalking: 'medium', restRequired: false, maxDuration: 'half-day' }
    } : PERSONAS[index];

    document.getElementById('persona-editor-title').textContent = isNew ? 'Add Traveler' : 'Edit Traveler';
    document.getElementById('pe-id').value = isNew ? '' : persona.id;
    document.getElementById('pe-name').value = persona.name;
    document.getElementById('pe-emoji').value = persona.emoji;
    document.getElementById('pe-color').value = persona.color;
    document.getElementById('pe-walking').value = persona.constraints.maxWalking;
    document.getElementById('pe-duration').value = persona.constraints.maxDuration;
    document.getElementById('pe-rest').checked = persona.constraints.restRequired;

    // Render tag chips
    const tagsContainer = document.getElementById('pe-tags');
    const selectedTags = new Set(Object.keys(persona.tagWeights));
    tagsContainer.innerHTML = this.ALL_TAGS.map(tag => {
      const sel = selectedTags.has(tag);
      return `<span class="tag-chip${sel ? ' selected' : ''}" data-tag="${tag}">${tag}</span>`;
    }).join('');
    tagsContainer.querySelectorAll('.tag-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        chip.classList.toggle('selected');
      });
    });

    overlay.style.display = 'flex';

    // Save handler (one-time bind via clone)
    const saveBtn = document.getElementById('btn-pe-save');
    const cancelBtn = document.getElementById('btn-pe-cancel');
    const newSaveBtn = saveBtn.cloneNode(true);
    const newCancelBtn = cancelBtn.cloneNode(true);
    saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
    cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);

    newSaveBtn.addEventListener('click', () => {
      const name = document.getElementById('pe-name').value.trim();
      if (!name) { alert('Please enter a name.'); return; }

      const constraints = {
        maxWalking: document.getElementById('pe-walking').value,
        maxDuration: document.getElementById('pe-duration').value,
        restRequired: document.getElementById('pe-rest').checked
      };

      // Gather selected tag weights
      const tagWeights = {};
      const selectedChips = tagsContainer.querySelectorAll('.tag-chip.selected');
      if (!selectedChips.length) { alert('Please select at least one interest tag.'); return; }
      selectedChips.forEach(chip => {
        const tag = chip.dataset.tag;
        // Default weight 2 for primary interests, 1 else — simple heuristic
        tagWeights[tag] = selectedChips.length <= 3 ? 2 : 1;
      });

      const personaData = {
        id: isNew ? ('traveler' + Date.now()) : document.getElementById('pe-id').value,
        name: name,
        emoji: document.getElementById('pe-emoji').value || '🧑',
        color: document.getElementById('pe-color').value,
        tagWeights: tagWeights,
        constraints: constraints
      };

      if (isNew) {
        // Ensure unique ID
        if (PERSONAS.some(p => p.id === personaData.id)) {
          personaData.id = 'traveler' + Date.now() + Math.random().toString(36).slice(2, 6);
        }
        PERSONAS.push(personaData);
      } else {
        // Edit existing
        const oldId = PERSONAS[index].id;
        PERSONAS[index] = personaData;
        // If ID changed, migrate swipes
        if (oldId !== personaData.id) {
          if (this.state.swipes[oldId]) {
            this.state.swipes[personaData.id] = this.state.swipes[oldId];
            delete this.state.swipes[oldId];
          }
          if (this.swipeDeck && this.swipeDeck.currentIndex && this.swipeDeck.currentIndex[oldId] !== undefined) {
            this.swipeDeck.currentIndex[personaData.id] = this.swipeDeck.currentIndex[oldId];
            delete this.swipeDeck.currentIndex[oldId];
          }
          if (this.state.currentPersona === oldId) {
            this.state.currentPersona = personaData.id;
          }
        }
      }

      this.state.personas = PERSONAS;
      this.syncPersonaData();
      this.saveToStorage();
      overlay.style.display = 'none';
      this.renderSetupScreen();
    });

    newCancelBtn.addEventListener('click', () => {
      overlay.style.display = 'none';
    });

    // Close on overlay click
    overlay.onclick = (e) => {
      if (e.target === overlay) overlay.style.display = 'none';
    };
  },

  renderShareScreen() {
    const days = this.state.itinerary;
    if (!days.length) {
      document.getElementById('share-text').textContent = 'No itinerary yet. Go back and build one!';
      return;
    }

    let text = `🏙️ Family Trip to ${this.state.destination} — ${this.state.tripDays} Day Itinerary\n`;
    text += '═'.repeat(40) + '\n\n';

    for (let i = 0; i < days.length; i++) {
      const activities = days[i].map(id => this.state.activities.find(a => a.id === id)).filter(Boolean);
      const stats = Itinerary.getDayStats(days[i]);
      const transitLabel = stats.transportHours > 0 ? ` · 🚇${stats.transportHours.toFixed(1)}h transit` : '';
      text += `📅 Day ${i + 1}  [${stats.elderlyOk ? '🟢 Elderly OK' : '🔴 Heavy walking'}] [${stats.totalHours.toFixed(1)}h total${transitLabel}]\n`;
      text += '─'.repeat(30) + '\n';
      if (!activities.length) {
        text += '  (Rest day / free time)\n';
      } else {
        activities.forEach((a, j) => {
          text += `  ${j + 1}. ${a.emoji} ${a.name} — ${a.location} (${a.duration})\n`;
          // Show transport to next activity
          if (j < activities.length - 1) {
            const leg = stats.transportLegs[j];
            if (leg && leg.minutes > 0) {
              text += `     🚇 ~${leg.minutes}min transit\n`;
            }
          }
        });
      }
      text += '\n';
    }

    const happiness = Itinerary.getHappinessScore(days);
    text += '═'.repeat(40) + '\n';
    text += `❤️ Family Happiness Score: ${happiness}%\n`;
    text += `Generated by Family Trip Planner — swipe, match, travel!\n`;

    document.getElementById('share-text').textContent = text;
  },

  // AI Mode: Claude API integration for activity generation
  async fetchAIActivities() {
    const apiKey = this.state.apiKey;
    if (!apiKey) throw new Error('No API key provided');

    const personaDescriptions = this.state.personas.map(p =>
      `${p.name}: likes ${Object.entries(p.tagWeights).filter(([k, v]) => v > 1).map(([k]) => k).join(', ')}, max walking ${p.constraints.maxWalking}`
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

Important: include several low-walking activities with rest spots for elderly travelers, and interactive activities for children.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`API error: ${response.status} — ${errorText}`);
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || '';
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
  },

  // AI Mode: Claude API integration for itinerary generation / re-ranking
  async fetchAIItinerary() {
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

Build a ${this.state.tripDays}-day itinerary respecting:
- Elderly: slow pace, needs rest spots, max 2 walking activities per day
- Child: short activities preferred, loves interactive and fun things — at least one engaging activity per day
- Adult: enjoys views and shopping
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
        model: 'claude-sonnet-5',
        max_tokens: 2048,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) return;

    const data = await response.json();
    const text = data.content?.[0]?.text || '';
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
  },

  // Global Mode: Brave Search API integration + manual entry fallback
  async fetchGlobalActivities() {
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
  },

  showManualEntry(destination) {
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
  }
};

// Wait for DOM + engine files to load
document.addEventListener('DOMContentLoaded', () => {
  App.loadFromStorage();
  // Initialize personas and activities from engine/activities.js
  if (typeof ACTIVITIES !== 'undefined') App.state.activities = ACTIVITIES;
  if (typeof PERSONAS !== 'undefined') App.state.personas = PERSONAS;
  // Sync swipes/currentIndex with current personas (handles fresh starts + restored custom personas)
  App.syncPersonaData();
  // Safety: if restoring to a data-dependent screen with no data, go to setup
  const dataScreens = ['match', 'itinerary', 'share'];
  const hasSwipes = Object.values(App.state.swipes).some(s => Object.keys(s).length > 0);
  if (dataScreens.includes(App.state.currentScreen) && !hasSwipes) {
    App.state.currentScreen = 'setup';
  }

  // === Swipe Deck State ===
  App.swipeDeck = {
    currentIndex: App.initCurrentIndex(),
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

  // Wire "Build Itinerary" button — AI mode gets LLM-generated itinerary
  document.getElementById('btn-build-itinerary').addEventListener('click', async () => {
    if (App.state.mode === 'ai' && App.state.apiKey) {
      document.getElementById('btn-build-itinerary').innerHTML = '<span class="spinner"></span> AI is planning...';
      try {
        await App.fetchAIItinerary();
      } catch (err) {
        console.error('AI itinerary failed, falling back to scheduler:', err);
      }
    }
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

  // Wire "Back to Swiping" button on match screen
  const backBtn = document.getElementById('btn-back-to-swiping');
  if (backBtn) {
    backBtn.addEventListener('click', (e) => {
      e.preventDefault();
      App.state.currentPersona = App.state.currentPersona || 'adult';
      App.navigate('swipe');
    });
  }

  App.renderItineraryScreen = function() {
    const titleEl = document.getElementById('itinerary-title');
    if (titleEl) titleEl.textContent = `📅 ${this.state.tripDays}-Day Itinerary`;

    let days;
    if (this.state.mode === 'ai' && this.state.itinerary.length) {
      // Use AI-generated itinerary directly; don't overwrite with scheduler
      days = this.state.itinerary;
    } else {
      const overlaps = Matcher.getOverlaps();
      const allLiked = new Set();
      for (const p of PERSONAS) {
        Matcher.getLikes(p.id).forEach(id => allLiked.add(id));
      }
      days = Itinerary.schedule([...allLiked], this.state.tripDays);
      App.state.itinerary = days;
    }

    const container = document.getElementById('day-columns');
    container.innerHTML = days.map((dayIds, i) => {
      const stats = Itinerary.getDayStats(dayIds);
      const activities = dayIds.map(id => App.state.activities.find(a => a.id === id)).filter(Boolean);
      const meterClass = stats.totalWalking <= 2 ? 'ok' : stats.totalWalking <= 3 ? 'warn' : 'bad';
      const meterWidth = Math.min(100, (stats.totalWalking / 4) * 100);

      // Build activity list with transport legs between
      const activityItems = [];
      activities.forEach((a, idx) => {
        activityItems.push(`
          <div class="slot-activity" draggable="true" data-activity-id="${a.id}" data-from-day="${i}">
            <span>${a.emoji}</span> ${a.name}
            <span style="font-size:10px;color:var(--text-muted);margin-left:auto;">${a.duration}</span>
            <button class="btn-remove-activity" data-activity-id="${a.id}" data-from-day="${i}" title="Remove from itinerary"
              style="background:none;border:none;cursor:pointer;font-size:14px;padding:0 2px;color:var(--text-muted);line-height:1;margin-left:2px;">✕</button>
          </div>`);
        // Transport leg between this activity and the next
        if (idx < activities.length - 1) {
          const leg = stats.transportLegs[idx];
          if (leg && leg.minutes > 0) {
            activityItems.push(`
              <div style="font-size:10px;color:var(--text-muted);text-align:center;padding:2px 0;border-top:1px dashed #e0e0e0;">
                🚇 ~${leg.minutes}min
              </div>`);
          }
        }
      });

      return `
        <div class="day-column" data-day="${i}">
          <h3>Day ${i + 1}</h3>
          <div class="grandma-meter">
            <div class="fill ${meterClass}" style="width:${meterWidth}%"></div>
          </div>
          <div style="font-size:11px;color:var(--text-muted);text-align:center;margin-bottom:4px;">
            ${stats.elderlyOk ? '🟢' : stats.totalWalking > 3 ? '🔴' : '🟡'} Elderly · ${stats.totalHours.toFixed(1)}h
            ${stats.transportHours > 0 ? `<br><span style="font-size:10px;">(🚇 ${stats.transportHours.toFixed(1)}h transit)</span>` : ''}
          </div>
          <div class="day-slot" data-day="${i}">
            ${activityItems.join('')}
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
      <div style="font-size:24px;font-weight:700;color:${happiness >= 60 ? 'var(--child)' : happiness >= 30 ? '#f1c40f' : 'var(--danger)'}">${happiness}%</div>
      <div class="gauge"><div class="gauge-fill" style="width:${happiness}%"></div></div>
    `;

    // Drag and drop between days
    this.bindItineraryDragDrop();

    // Remove-activity buttons — cancel drag + handle click
    const self = this;
    document.querySelectorAll('.btn-remove-activity').forEach(btn => {
      btn.addEventListener('dragstart', (e) => {
        e.preventDefault();
        e.stopPropagation();
      });
      btn.addEventListener('mousedown', (e) => {
        e.stopPropagation();
      });
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const id = btn.dataset.activityId;
        const day = parseInt(btn.dataset.fromDay);
        self.state.itinerary[day] = self.state.itinerary[day].filter(x => x !== id);
        self.saveToStorage();
        self.renderItineraryScreen();
      });
    });
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
          alert('⚠️ Adding this activity would overload the Elderly traveler! Try a different day.');
        }
        App.saveToStorage();
        App.renderItineraryScreen();
      });
    });
  };

  // Wire "Share" button from itinerary screen
  document.getElementById('btn-share').addEventListener('click', () => {
    App.navigate('share');
  });

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

    // Preload location coordinates for all activities (free geocoding → cache)
    try {
      const context = App.state.mode === 'global'
        ? App.state.destination
        : 'Kaohsiung, Taiwan';
      document.getElementById('btn-start').innerHTML = '<span class="spinner"></span> Mapping locations...';
      await Geocoder.preload(App.state.activities, context);
    } catch (err) {
      console.warn('Geocoding preload failed:', err);
      // Non-fatal: transport times will use 15-min fallback
    }

    App.state.loading = false;
    document.getElementById('btn-start').innerHTML = 'Start Swiping →';
    document.getElementById('btn-start').disabled = false;
    App.navigate('swipe');
    App.renderSwipeScreen();
  });

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
      App.state.swipes = App.initSwipes();
      App.state.itinerary = [];
      App.state.currentPersona = PERSONAS[0]?.id || 'adult';
      App.swipeDeck.currentIndex = App.initCurrentIndex();
      App.saveToStorage();
      App.navigate('setup');
      App.renderSetupScreen();
    }
  });

  // Initial screen render — must run AFTER all render functions are defined
  App.navigate(App.state.currentScreen || 'setup');
  if (App.state.currentScreen === 'setup') App.renderSetupScreen();
});