// engine/itinerary.js — greedy scheduler with grandma constraints + transport time
// Transport times now use Geocoder (Nominatim + Haversine) for any location worldwide.
// Falls back to 15 min when coordinates are unavailable.

const Itinerary = {

  /** Get estimated transport time (minutes) between two activities by their locations */
  getTransportTime(locationA, locationB) {
    if (!locationA || !locationB || locationA === locationB) return 0;
    // Use cached geocoder coordinates + Haversine straight-line distance
    // Assumes ~30 km/h average urban speed (public transit + walking)
    if (typeof Geocoder !== 'undefined') {
      return Geocoder.getTravelMinutes(locationA, locationB, 30);
    }
    return 15; // fallback if geocoder isn't loaded
  },

  /** Get total transport time for a day's activities, in hours (rounded to 1 decimal) */
  getTotalTransportTime(dayActivityIds) {
    const activities = dayActivityIds.map(id =>
      App.state.activities.find(a => a.id === id)).filter(Boolean);
    let totalMin = 0;
    for (let i = 0; i < activities.length - 1; i++) {
      totalMin += this.getTransportTime(activities[i].location, activities[i + 1].location);
    }
    return Math.round(totalMin / 6) / 10; // convert minutes to hours, 1 decimal
  },

  /** Format transport leg for display */
  getTransportLabel(fromLocation, toLocation) {
    const min = this.getTransportTime(fromLocation, toLocation);
    if (min === 0) return '';
    return `🚇 ~${min}min`;
  },

  /**
   * Schedule liked activities across N days.
   * @param {string[]} likedActivityIds
   * @param {number} [numDays=7]
   * @returns {string[][]} Array of N arrays of activity IDs
   */
  schedule(likedActivityIds, numDays = 7) {
    const activityMap = {};
    for (const id of likedActivityIds) {
      const a = App.state.activities.find(a => a.id === id);
      if (a) activityMap[id] = a;
    }

    const everyone = Matcher.getOverlaps().everyone;
    const others = likedActivityIds.filter(id => !everyone.includes(id));

    // Sort everyone first, then by duration (shorter first for better distribution)
    const sorted = [...everyone, ...others].filter(id => activityMap[id]);

    const days = Array.from({ length: numDays }, () => []); // N empty arrays of activity IDs
    let dayIndex = 0;

    for (const id of sorted) {
      const activity = activityMap[id];
      // Try to place in current day; if constraints violated, try next day
      let attempts = 0;
      while (attempts < numDays) {
        const currentDay = days[dayIndex % numDays];
        if (this.canAddActivity(currentDay, activity)) {
          currentDay.push(id);
          break;
        }
        dayIndex++;
        attempts++;
      }
      // If all days fail, place in the day with fewest activities
      if (attempts >= numDays) {
        let minDay = 0;
        for (let i = 1; i < numDays; i++) {
          if (days[i].length < days[minDay].length) minDay = i;
        }
        days[minDay].push(id);
      }
      dayIndex++;
    }

    return days;
  },

  /** Check if adding this activity to a day violates constraints (including transport) */
  canAddActivity(dayActivityIds, newActivity) {
    const activities = dayActivityIds.map(id =>
      App.state.activities.find(a => a.id === id)).filter(Boolean);

    // Count walking load (existing + new)
    const walkingWeight = { low: 1, medium: 2, high: 4 };
    const totalWalking = activities.reduce((sum, a) => sum + (walkingWeight[a.walkingLevel] || 1), 0)
      + (walkingWeight[newActivity.walkingLevel] || 1);

    // Grandma constraint: total walking ≤ 4 weight points per day (slightly relaxed for transport)
    const allActivities = [...activities, newActivity];
    const mediumCount = allActivities.filter(a => a.walkingLevel === 'medium' || a.walkingLevel === 'high').length;
    if (totalWalking > 4 || mediumCount > 2) return false;

    // Duration check: activity duration + transport between activities
    const durationWeight = { '1h': 1, '2h': 2, 'half-day': 4, 'full-day': 8 };
    let totalDuration = activities.reduce((sum, a) => sum + (durationWeight[a.duration] || 1), 0)
      + (durationWeight[newActivity.duration] || 1);

    // Add transport time between existing activities
    for (let i = 0; i < activities.length - 1; i++) {
      totalDuration += this.getTransportTime(activities[i].location, activities[i + 1].location) / 60;
    }
    // Add transport from last existing to new activity (if any)
    if (activities.length > 0) {
      const lastActivity = activities[activities.length - 1];
      totalDuration += this.getTransportTime(lastActivity.location, newActivity.location) / 60;
    }

    // Max ~8 hours of activity + transport per day (grandma-friendly)
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

    // Activity hours + transport time
    const durationHours = activities.reduce((sum, a) => {
      const map = { '1h': 1, '2h': 2, 'half-day': 4, 'full-day': 8 };
      return sum + (map[a.duration] || 2);
    }, 0);
    const transportHours = this.getTotalTransportTime(dayActivityIds);

    // Transport legs between consecutive activities
    const transportLegs = [];
    for (let i = 0; i < activities.length - 1; i++) {
      transportLegs.push({
        from: activities[i].location,
        to: activities[i + 1].location,
        minutes: this.getTransportTime(activities[i].location, activities[i + 1].location)
      });
    }

    return {
      totalWalking,
      grandmaOk,
      personCoverage,
      durationHours,
      transportHours,
      totalHours: durationHours + transportHours,
      count: activities.length,
      transportLegs
    };
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
    return Math.min(100, Math.round((totalScore / (totalActivities * 20)) * 100));
  }
};
