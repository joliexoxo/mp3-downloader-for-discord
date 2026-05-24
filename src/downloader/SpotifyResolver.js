export class SpotifyResolver {
  static REGEX = /https?:\/\/(?:open|play)\.spotify\.com\/(track|album|playlist)\/([a-zA-Z0-9]+)/;

  static isSpotifyUrl(url) {
    return this.REGEX.test(url);
  }

  static parseUrl(url) {
    const match = url.match(this.REGEX);
    if (!match) return null;
    return {
      type: match[1],
      id: match[2]
    };
  }

  static async fetchMetadata(url) {
    const parsed = this.parseUrl(url);
    if (!parsed) {
      throw new Error('Invalid Spotify URL');
    }

    const { type, id } = parsed;
    const embedUrl = `https://open.spotify.com/embed/${type}/${id}`;

    try {
      const response = await fetch(embedUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9'
        }
      });

      if (!response.ok) {
        throw new Error(`Spotify embed returned status ${response.status}`);
      }

      const html = await response.text();
      const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/);
      
      if (!match) {
        throw new Error('Failed to parse Spotify embed page. Could not find metadata script block.');
      }

      const nextData = JSON.parse(match[1]);
      const state = nextData.props?.pageProps?.state;
      
      if (!state || !state.data || !state.data.entity) {
        const pageProps = nextData.props?.pageProps;
        if (pageProps?.status === 404) {
          throw new Error('Spotify content not found (404). Please check the link.');
        }
        throw new Error('Could not find entity data in Spotify embed response');
      }

      const entity = state.data.entity;
      const title = entity.name || entity.title || 'Unknown Title';
      
      let artist = 'Unknown Artist';
      if (entity.artists && Array.isArray(entity.artists)) {
        artist = entity.artists.map(a => a.name).join(', ');
      } else if (entity.subtitle) {
        artist = entity.subtitle;
      }

      let thumbnail = null;
      if (entity.visualIdentity?.image && entity.visualIdentity.image.length > 0) {
        thumbnail = entity.visualIdentity.image[0].url;
      } else if (entity.images && entity.images.length > 0) {
        thumbnail = entity.images[0].url;
      }

      if (type === 'track') {
        return {
          type: 'track',
          title,
          artist,
          thumbnail,
          durationMs: entity.duration || 0,
          searchQuery: `ytsearch1:${artist} - ${title}`
        };
      }

      const trackList = entity.trackList || [];
      if (trackList.length === 0) {
        throw new Error(`The Spotify ${type} has no tracks.`);
      }

      const tracks = trackList.map(t => {
        let trackArtist = artist;
        if (t.subtitle) {
          trackArtist = t.subtitle;
        } else if (t.artists && Array.isArray(t.artists)) {
          trackArtist = t.artists.map(a => a.name).join(', ');
        }
        
        return {
          title: t.title || t.name || 'Unknown Track',
          artist: trackArtist,
          durationMs: t.duration || 0
        };
      });

      const firstTrack = tracks[0];

      return {
        type,
        collectionName: title,
        title: firstTrack.title,
        artist: firstTrack.artist,
        thumbnail,
        durationMs: firstTrack.durationMs,
        searchQuery: `ytsearch1:${firstTrack.artist} - ${firstTrack.title}`,
        totalTracks: tracks.length,
        tracks
      };

    } catch (error) {
      throw new Error(`Spotify Metadata Error: ${error.message}`);
    }
  }
}
