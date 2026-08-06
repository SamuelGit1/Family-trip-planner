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
