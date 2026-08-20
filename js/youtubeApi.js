/**
 * YouTube API Client-Side Module for CSV to YT Playlist Pro
 * Persistent OAuth Tokens via localStorage + Official Google API Search
 */

window.YouTubeAPI = {
    DEFAULT_CLIENT_ID: '673637025192-vs4ng236a5g9ck4d1e7uln9fljck1hf0.apps.googleusercontent.com',
    STORAGE_OAUTH_CLIENT_ID: 'yt_playlist_oauth_client_id',
    STORAGE_ACCESS_TOKEN: 'yt_playlist_access_token',
    STORAGE_TOKEN_EXPIRY: 'yt_playlist_token_expiry',
    
    accessToken: null,
    tokenClient: null,

    /**
     * Initialize & restore saved login token from localStorage
     */
    init() {
        const savedClientId = localStorage.getItem(this.STORAGE_OAUTH_CLIENT_ID) || this.DEFAULT_CLIENT_ID;
        const savedToken = localStorage.getItem(this.STORAGE_ACCESS_TOKEN);
        const savedExpiry = localStorage.getItem(this.STORAGE_TOKEN_EXPIRY);

        // Check if saved OAuth token is still valid
        if (savedToken && savedExpiry && Date.now() < parseInt(savedExpiry, 10)) {
            this.accessToken = savedToken;
        } else {
            // Token expired or missing
            this.accessToken = null;
            localStorage.removeItem(this.STORAGE_ACCESS_TOKEN);
            localStorage.removeItem(this.STORAGE_TOKEN_EXPIRY);
        }

        return {
            clientId: savedClientId,
            isAuthenticated: !!this.accessToken
        };
    },

    saveClientId(clientId) {
        if (clientId !== undefined) {
            localStorage.setItem(this.STORAGE_OAUTH_CLIENT_ID, clientId.trim());
        }
    },

    getClientId() {
        return localStorage.getItem(this.STORAGE_OAUTH_CLIENT_ID) || this.DEFAULT_CLIENT_ID;
    },

    /**
     * Request Google OAuth 2.0 Token & save to localStorage
     */
    requestOAuthToken(clientId, callback) {
        const activeClientId = (clientId || this.getClientId()).trim();
        if (!activeClientId) {
            alert('Google OAuth Client ID is missing.');
            return;
        }

        if (!window.google || !window.google.accounts || !window.google.accounts.oauth2) {
            alert('Google Identity Services SDK is loading. Please try again in 5 seconds.');
            return;
        }

        try {
            this.tokenClient = google.accounts.oauth2.initTokenClient({
                client_id: activeClientId,
                scope: 'https://www.googleapis.com/auth/youtube https://www.googleapis.com/auth/youtube.force-ssl',
                callback: (response) => {
                    if (response.error) {
                        console.error('OAuth Error:', response);
                        callback(false, response.error);
                        return;
                    }

                    this.accessToken = response.access_token;
                    const expiresInSeconds = response.expires_in || 3600;
                    const expiryTime = Date.now() + (expiresInSeconds * 1000);

                    // Save token to localStorage for persistent login across page reloads!
                    localStorage.setItem(this.STORAGE_ACCESS_TOKEN, this.accessToken);
                    localStorage.setItem(this.STORAGE_TOKEN_EXPIRY, expiryTime.toString());

                    callback(true, this.accessToken);
                }
            });

            this.tokenClient.requestAccessToken();
        } catch (err) {
            console.error('Failed to launch OAuth Token Client:', err);
            callback(false, err.message);
        }
    },

    /**
     * Log Out & Clear stored token
     */
    logout() {
        this.accessToken = null;
        localStorage.removeItem(this.STORAGE_ACCESS_TOKEN);
        localStorage.removeItem(this.STORAGE_TOKEN_EXPIRY);
    },

    /**
     * Search Videos using Official Google YouTube Data API v3 (Prioritized)
     */
    async searchVideos(query, maxResults = 5) {
        // 1. If user is authenticated, use Official YouTube Data API (100% accurate!)
        if (this.accessToken) {
            try {
                const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&q=${encodeURIComponent(query)}&maxResults=${maxResults}`;
                const res = await fetch(url, {
                    headers: { 'Authorization': `Bearer ${this.accessToken}` }
                });

                if (res.ok) {
                    const data = await res.json();
                    if (data.items && data.items.length > 0) {
                        return data.items.map(item => ({
                            videoId: item.id.videoId,
                            title: item.snippet.title,
                            channelTitle: item.snippet.channelTitle,
                            thumbnail: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.default?.url || `https://i.ytimg.com/vi/${item.id.videoId}/hqdefault.jpg`,
                            url: `https://www.youtube.com/watch?v=${item.id.videoId}`
                        }));
                    }
                }
            } catch (e) {
                console.warn('Official OAuth Search error, trying fallback:', e);
            }
        }

        // 2. Scrape Real YouTube Video IDs via CORS Proxy
        try {
            const scraped = await this.scrapeRealYouTubeVideos(query, maxResults);
            if (scraped && scraped.length > 0) return scraped;
        } catch (e) {
            console.warn('Scraper error:', e);
        }

        // 3. iTunes Track Search Fallback
        return await this.searchItunesFallback(query);
    },

    async scrapeRealYouTubeVideos(query, maxResults = 5) {
        const targetUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
        const corsProxies = [
            `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`,
            `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`
        ];

        for (const proxyUrl of corsProxies) {
            try {
                const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(3500) });
                if (!res.ok) continue;
                const html = await res.text();

                const matches = [];
                const videoIdRegex = /"videoId":"([a-zA-Z0-9_-]{11})"/g;
                let match;
                const seen = new Set();

                while ((match = videoIdRegex.exec(html)) !== null && matches.length < maxResults) {
                    const vId = match[1];
                    if (!seen.has(vId)) {
                        seen.add(vId);
                        matches.push({
                            videoId: vId,
                            title: query,
                            channelTitle: 'YouTube',
                            thumbnail: `https://i.ytimg.com/vi/${vId}/hqdefault.jpg`,
                            url: `https://www.youtube.com/watch?v=${vId}`
                        });
                    }
                }

                if (matches.length > 0) return matches;
            } catch (err) {
                console.warn(`Proxy ${proxyUrl} failed:`, err);
            }
        }

        return null;
    },

    async searchItunesFallback(query) {
        try {
            const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=3`;
            const res = await fetch(url);
            if (res.ok) {
                const data = await res.json();
                if (data.results && data.results.length > 0) {
                    return data.results.map(r => ({
                        videoId: '',
                        title: `${r.trackName} - ${r.artistName}`,
                        channelTitle: r.artistName,
                        thumbnail: r.artworkUrl100 || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=100&auto=format&fit=crop&q=60',
                        url: `https://www.youtube.com/results?search_query=${encodeURIComponent(r.trackName + ' ' + r.artistName)}`
                    }));
                }
            }
        } catch (e) {
            console.warn('iTunes API fallback failed:', e);
        }

        return [{
            videoId: '',
            title: `${query} (Search on YouTube)`,
            channelTitle: 'YouTube',
            thumbnail: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=100&auto=format&fit=crop&q=60',
            url: `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`
        }];
    },

    async createPlaylistInAccount(title, privacy = 'unlisted') {
        if (!this.accessToken) {
            throw new Error('Google OAuth Sign-In is required to create playlists in your account.');
        }

        const url = 'https://www.googleapis.com/youtube/v3/playlists?part=snippet,status';
        const body = {
            snippet: {
                title: title || 'CSV Imported Playlist',
                description: 'Created with CSV to YT Playlist Pro'
            },
            status: {
                privacyStatus: privacy
            }
        };

        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error?.message || `HTTP ${res.status} Error`);
        }

        const data = await res.json();
        return data.id;
    },

    async addVideoToPlaylist(playlistId, videoId) {
        if (!this.accessToken) {
            throw new Error('Google OAuth Sign-In required.');
        }

        const url = 'https://www.googleapis.com/youtube/v3/playlistItems?part=snippet';
        const body = {
            snippet: {
                playlistId: playlistId,
                resourceId: {
                    kind: 'youtube#video',
                    videoId: videoId
                }
            }
        };

        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error?.message || `HTTP ${res.status} Error`);
        }

        return await res.json();
    }
};
