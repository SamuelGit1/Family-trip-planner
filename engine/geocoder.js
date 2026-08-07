// engine/geocoder.js — Free geocoding via OpenStreetMap Nominatim + Haversine distance

const Geocoder = {
  // Cache: lowercase location string → { lat, lng }
  _cache: {},

  // Nominatim endpoint (free, no API key required)
  _BASE: 'https://nominatim.openstreetmap.org',

  /**
   * Geocode a location string → { lat, lng }
   * Cached in-memory; respects Nominatim's 1 req/sec limit.
   * @param {string} location - e.g. "Cianjhen District"
   * @param {string} [context] - e.g. "Kaohsiung, Taiwan" for better accuracy
   * @returns {Promise<{lat: number, lng: number}|null>}
   */
  async geocode(location, context = '') {
    const key = location.toLowerCase().trim();
    if (this._cache[key]) return this._cache[key];

    const query = context ? `${location}, ${context}` : location;
    const url = `${this._BASE}/search?q=${encodeURIComponent(query)}&format=json&limit=1`;

    try {
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`Nominatim error: ${resp.status}`);
      const data = await resp.json();
      if (data.length > 0) {
        const coords = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
        this._cache[key] = coords;
        return coords;
      }
    } catch (err) {
      console.warn(`Geocoding failed for "${location}":`, err.message);
    }
    return null;
  },

  /**
   * Preload coordinates for all unique locations in an activity pool.
   * Call once before scheduling — populates the cache so distance
   * lookups stay synchronous afterwards.
   * @param {object[]} activities - array with .location strings
   * @param {string} [context] - city/region to append to queries
   * @returns {Promise<number>} how many locations were newly cached
   */
  async preload(activities, context = '') {
    const locations = [...new Set(
      activities.map(a => a.location).filter(Boolean)
    )];
    const uncached = locations.filter(
      loc => !this._cache[loc.toLowerCase().trim()]
    );

    let loaded = 0;
    for (let i = 0; i < uncached.length; i++) {
      const coords = await this.geocode(uncached[i], context);
      if (coords) loaded++;
      // Respect Nominatim rate limit: ~1 req/sec
      if (i < uncached.length - 1) {
        await new Promise(r => setTimeout(r, 1100));
      }
    }
    return loaded;
  },

  /**
   * Synchronous cache lookup — returns { lat, lng } or null.
   * Safe to call inside synchronous scheduling code after preload().
   */
  getCoordinates(location) {
    if (!location) return null;
    return this._cache[location.toLowerCase().trim()] || null;
  },

  /**
   * Haversine straight-line distance between two coordinates (km).
   * Pure math — no API call, no rate limit, works offline.
   */
  distance(lat1, lng1, lat2, lng2) {
    const R = 6371; // Earth's mean radius in km
    const toRad = d => d * Math.PI / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2
      + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  },

  /**
   * Estimate travel time between two locations (minutes).
   * Uses cached coordinates + Haversine distance + an average speed.
   * Falls back to 15 min if either location is unknown.
   * @param {number} [avgSpeedKmh=30] - assumed average urban travel speed
   */
  getTravelMinutes(locationA, locationB, avgSpeedKmh = 30) {
    if (!locationA || !locationB || locationA === locationB) return 0;

    const a = this.getCoordinates(locationA);
    const b = this.getCoordinates(locationB);

    if (!a || !b) return 15; // fallback for unknown locations

    const km = this.distance(a.lat, a.lng, b.lat, b.lng);
    return Math.max(1, Math.round((km / avgSpeedKmh) * 60));
  }
};
