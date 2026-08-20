/**
 * YouTube API Client-Side Module for CSV to YT Playlist Pro
 * Embedded Google OAuth 2.0 Client ID for 1-Click Sign-In
 */

window.YouTubeAPI = {
    DEFAULT_CLIENT_ID: '673637025192-vs4ng236a5g9ck4d1e7uln9fljck1hf0.apps.googleusercontent.com',
    STORAGE_OAUTH_CLIENT_ID: 'yt_playlist_oauth_client_id',
    accessToken: null,
    tokenClient: null,

    init() {
        const saved = localStorage.getItem(this.STORAGE_OAUTH_CLIENT_ID);
        return {
            clientId: saved || this.DEFAULT_CLIENT_ID
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
     * Request Google OAuth 2.0 Token via Google Identity Services Popup
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
     * Create REAL YouTube Playlist in User's Google Account Library
     */
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

    /**
     * Add Video Item to User's YouTube Playlist
     */
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
    },

    /**
     * Search Real YouTube Videos for a query
     */
    async searchVideos(query, maxResults = 5) {
        try {
            const realResults = await this.scrapeRealYouTubeVideos(query, maxResults);
            if (realResults && realResults.length > 0) {
                return realResults;
            }
        } catch (e) {
            console.warn('Scraper fallback error:', e);
        }

        return await this.searchPublicMirrors(query, maxResults);
    },

    async scrapeRealYouTubeVideos(query, maxResults = 5) {
        const targetUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
        const corsProxies = [
            `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`,
            `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`
        ];

        for (const proxyUrl of corsProxies) {
            try {
                const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(4000) });
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

    async searchPublicMirrors(query, maxResults = 5) {
        const mirrors = [
            `https://pipedapi.kavin.rocks/search?q=${encodeURIComponent(query)}&filter=videos`,
            `https://yt.lemnoslife.com/noKey/search?q=${encodeURIComponent(query)}`
        ];

        for (const url of mirrors) {
            try {
                const res = await fetch(url, { signal: AbortSignal.timeout(3500) });
                if (res.ok) {
                    const data = await res.json();
                    const items = Array.isArray(data) ? data : (data.items || []);
                    if (items.length > 0) {
                        return items.slice(0, maxResults).map(item => {
                            const vId = item.id?.videoId || item.id || item.videoId;
                            return {
                                videoId: vId,
                                title: item.title || item.snippet?.title || query,
                                channelTitle: item.uploaderName || item.author || 'YouTube',
                                thumbnail: `https://i.ytimg.com/vi/${vId}/hqdefault.jpg`,
                                url: `https://www.youtube.com/watch?v=${vId}`
                            };
                        }).filter(item => item.videoId && item.videoId.length === 11);
                    }
                }
            } catch (err) {
                console.warn('Mirror failed:', err);
            }
        }

        return [];
    }
};
