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
