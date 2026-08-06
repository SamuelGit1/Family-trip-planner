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
