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
     * Extract 11-char YouTube Video ID from URL or string
     */
    extractVideoId(input) {
        if (!input) return null;
        const str = String(input).trim();
        if (/^[a-zA-Z0-9_-]{11}$/.test(str)) return str;
        const reg = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
        const match = str.match(reg);
        return match ? match[1] : null;
    },

    /**
     * Calculate Song Verification & Accuracy Score (0% - 100%)
     */
    verifySongMatch(trackName, artistName, videoTitle, channelTitle = '') {
        if (!videoTitle || !trackName) {
            return {
                score: 0,
                status: 'unverified',
                badgeClass: 'badge-missing',
                badgeText: '❌ Unverified',
                reason: 'Missing title or video metadata'
            };
        }

        const cleanStr = (s) => (s || '')
            .toLowerCase()
            .replace(/[\(\)\[\]\{\}\-_,.\/\\|:;'"]/g, ' ')
            .replace(/\b(official|music|video|audio|lyrics|hd|4k|remastered|topic|full|hq|explicit|mv|vevo)\b/g, '')
            .replace(/\s+/g, ' ')
            .trim();

        const cleanTrack = cleanStr(trackName);
        const cleanArtist = cleanStr(artistName);
        const cleanVidTitle = cleanStr(videoTitle);
        const cleanVidChannel = cleanStr(channelTitle);

        let titleScore = 0;
        let artistScore = 0;

        // Title Matching Logic
        if (cleanVidTitle.includes(cleanTrack) || cleanTrack.includes(cleanVidTitle)) {
            titleScore = 1.0;
        } else {
            const trackWords = cleanTrack.split(' ').filter(w => w.length > 1);
            if (trackWords.length > 0) {
                const matchedWords = trackWords.filter(w => cleanVidTitle.includes(w));
                titleScore = matchedWords.length / trackWords.length;
            }
        }

        // Artist Matching Logic
        if (cleanArtist) {
            if (cleanVidTitle.includes(cleanArtist) || cleanVidChannel.includes(cleanArtist)) {
                artistScore = 1.0;
            } else {
                const artistWords = cleanArtist.split(' ').filter(w => w.length > 2);
                if (artistWords.length > 0) {
                    const matchedArtistWords = artistWords.filter(w => cleanVidTitle.includes(w) || cleanVidChannel.includes(w));
                    artistScore = matchedArtistWords.length / artistWords.length;
                } else if (cleanVidChannel.length > 0) {
                    artistScore = 0.5;
                }
            }
        } else {
            artistScore = 1.0; // No artist specified in CSV
        }

        // Penalty for live/cover/reaction if original track doesn't specify it
        let penalty = 0;
        const noiseKeywords = ['cover', 'live', 'reaction', 'karaoke', 'remix', 'instrumental', '10 hours'];
        noiseKeywords.forEach(kw => {
            if (cleanVidTitle.includes(kw) && !cleanTrack.includes(kw)) {
                penalty += 0.15;
            }
        });

        let overallScore = 0;
        if (cleanArtist) {
            overallScore = Math.round((titleScore * 0.65 + artistScore * 0.35 - penalty) * 100);
        } else {
            overallScore = Math.round((titleScore - penalty) * 100);
        }

        overallScore = Math.max(0, Math.min(100, overallScore));

        let status = 'low';
        let badgeClass = 'badge-low';
        let badgeText = `🔴 ${overallScore}% Low Confidence`;
        let reason = `Track title or artist match is low. Video: "${videoTitle}"`;

        if (overallScore >= 90) {
            status = 'verified';
            badgeClass = 'badge-verified';
            badgeText = `🟢 ${overallScore}% Verified`;
            reason = 'Exact match: Song title and artist verified in YouTube video.';
        } else if (overallScore >= 70) {
            status = 'high';
            badgeClass = 'badge-high';
            badgeText = `🟡 ${overallScore}% Good Match`;
            reason = 'High match confidence: Title matches, artist verified.';
        } else if (overallScore >= 50) {
            status = 'moderate';
            badgeClass = 'badge-moderate';
            badgeText = `🟠 ${overallScore}% Review Needed`;
            reason = 'Moderate match: Title matches, check if exact artist/version.';
        }

        return {
            score: overallScore,
            status,
            badgeClass,
            badgeText,
            reason
        };
    },

    /**
     * Search YouTube Videos with Strict Video Match Filtering & Verification Scoring
     * Strictly EXCLUDES generic YouTube search links (results?search_query=...)
     */
    async searchVideos(query, maxResults = 5, trackName = '', artistName = '') {
        const directVideoId = this.extractVideoId(query);
        if (directVideoId) {
            const directVideo = {
                videoId: directVideoId,
                title: trackName || query,
                channelTitle: artistName || 'YouTube',
                thumbnail: `https://i.ytimg.com/vi/${directVideoId}/hqdefault.jpg`,
                url: `https://www.youtube.com/watch?v=${directVideoId}`
            };
            directVideo.verification = this.verifySongMatch(trackName || query, artistName, directVideo.title, directVideo.channelTitle);
            directVideo.verification.score = 100;
            directVideo.verification.status = 'verified';
            directVideo.verification.badgeClass = 'badge-verified';
            directVideo.verification.badgeText = '🟢 100% Direct Link Verified';
            return [directVideo];
        }

        let candidates = [];

        // 1. Official YouTube Data API (if authenticated with Google OAuth)
        if (this.accessToken) {
            try {
                const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&q=${encodeURIComponent(query)}&maxResults=${maxResults}`;
                const res = await fetch(url, {
                    headers: { 'Authorization': `Bearer ${this.accessToken}` }
                });

                if (res.ok) {
                    const data = await res.json();
                    if (data.items && data.items.length > 0) {
                        candidates = data.items.map(item => ({
                            videoId: item.id.videoId,
                            title: item.snippet.title,
                            channelTitle: item.snippet.channelTitle,
                            thumbnail: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.default?.url || `https://i.ytimg.com/vi/${item.id.videoId}/hqdefault.jpg`,
                            url: `https://www.youtube.com/watch?v=${item.id.videoId}`
                        }));
                    }
                }
            } catch (e) {
                console.warn('Official OAuth Search failed, trying scrapers:', e);
            }
        }

        // 2. Scrape Real YouTube Videos via CORS Proxies with JSON Metadata Extraction
        if (candidates.length === 0) {
            try {
                const scraped = await this.scrapeRealYouTubeVideos(query, maxResults);
                if (scraped && scraped.length > 0) candidates = scraped;
            } catch (e) {
                console.warn('Scraper error:', e);
            }
        }

        // 3. Fallback to Invidious & Public Video Search APIs
        if (candidates.length === 0) {
            try {
                const invidiousCandidates = await this.searchInvidiousPublicApi(query, maxResults);
                if (invidiousCandidates && invidiousCandidates.length > 0) candidates = invidiousCandidates;
            } catch (e) {
                console.warn('Invidious fallback error:', e);
            }
        }

        // Filter OUT any invalid video IDs or search links (no search_query links allowed as video matches!)
        const validVideos = candidates.filter(v => v.videoId && /^[a-zA-Z0-9_-]{11}$/.test(v.videoId));

        // Compute verification score for each candidate video
        const targetTrack = trackName || query;
        validVideos.forEach(v => {
            v.verification = this.verifySongMatch(targetTrack, artistName, v.title, v.channelTitle);
        });

        // Sort descending by verification score
        validVideos.sort((a, b) => b.verification.score - a.verification.score);

        return validVideos;
    },

    async scrapeRealYouTubeVideos(query, maxResults = 5) {
        const targetUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
        const corsProxies = [
            `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`,
            `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`
        ];

        for (const proxyUrl of corsProxies) {
            try {
                const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(4000) });
                if (!res.ok) continue;
                const html = await res.text();

                const parsed = this.parseYouTubeScrapedHtml(html, query, maxResults);
                if (parsed && parsed.length > 0) return parsed;
            } catch (err) {
                console.warn(`Proxy ${proxyUrl} failed:`, err);
            }
        }

        return [];
    },

    parseYouTubeScrapedHtml(html, query, maxResults = 5) {
        const matches = [];
        const seen = new Set();
        const videoIdRegex = /"videoId":"([a-zA-Z0-9_-]{11})"/g;
        let match;

        while ((match = videoIdRegex.exec(html)) !== null && matches.length < maxResults) {
            const vId = match[1];
            if (!seen.has(vId)) {
                seen.add(vId);

                const index = match.index;
                const snippet = html.substring(index, index + 1500);

                let title = query;
                const titleMatch = snippet.match(/"title":\s*\{\s*"runs":\s*\[\s*\{\s*"text":\s*"([^"]+)"/);
                if (titleMatch && titleMatch[1]) {
                    title = titleMatch[1].replace(/\\u0026/g, '&');
                }

                let channelTitle = 'YouTube';
                const channelMatch = snippet.match(/"ownerText":\s*\{\s*"runs":\s*\[\s*\{\s*"text":\s*"([^"]+)"/);
                if (channelMatch && channelMatch[1]) {
                    channelTitle = channelMatch[1].replace(/\\u0026/g, '&');
                }

                matches.push({
                    videoId: vId,
                    title: title,
                    channelTitle: channelTitle,
                    thumbnail: `https://i.ytimg.com/vi/${vId}/hqdefault.jpg`,
                    url: `https://www.youtube.com/watch?v=${vId}`
                });
            }
        }

        return matches;
    },

    async searchInvidiousPublicApi(query, maxResults = 5) {
        const instances = [
            'https://inv.tux.pizza',
            'https://vid.puffyan.us',
            'https://invidious.drgns.space'
        ];

        for (const baseUrl of instances) {
            try {
                const url = `${baseUrl}/api/v1/search?q=${encodeURIComponent(query)}&type=video`;
                const res = await fetch(url, { signal: AbortSignal.timeout(3500) });
                if (!res.ok) continue;
                const data = await res.json();

                if (Array.isArray(data) && data.length > 0) {
                    return data.slice(0, maxResults).map(item => ({
                        videoId: item.videoId,
                        title: item.title,
                        channelTitle: item.author || 'YouTube',
                        thumbnail: item.videoThumbnails?.find(t => t.quality === 'high')?.url || `https://i.ytimg.com/vi/${item.videoId}/hqdefault.jpg`,
                        url: `https://www.youtube.com/watch?v=${item.videoId}`
                    }));
                }
            } catch (e) {
                console.warn(`Invidious instance ${baseUrl} failed:`, e);
            }
        }

        return [];
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

        if (!videoId || videoId.length !== 11) {
            throw new Error('Invalid YouTube Video ID provided.');
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

