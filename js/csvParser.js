/**
 * CSV Parser Module for CSV to YT Playlist Pro
 * Pure client-side parsing using PapaParse and header detection logic
 */

window.CSVParser = {
    // Sample tracks for instant demo testing
    sampleCSV: `Track Name,Artist Name(s),Album Name
Bohemian Rhapsody,Queen,A Night at the Opera
Hotel California,Eagles,Hotel California
Blinding Lights,The Weeknd,After Hours
Stayin' Alive,Bee Gees,Saturday Night Fever
As It Was,Harry Styles,Harry's House`,

    /**
     * Parse raw CSV text string
     * @param {string} csvText 
     * @returns {Object} { headers: Array, data: Array }
     */
    parseText(csvText) {
        return new Promise((resolve, reject) => {
            if (!csvText || !csvText.trim()) {
                return reject(new Error('CSV text is empty.'));
            }

            Papa.parse(csvText.trim(), {
                header: true,
                skipEmptyLines: true,
                dynamicTyping: false,
                complete: (results) => {
                    if (results.errors && results.errors.length > 0 && results.data.length === 0) {
                        return reject(new Error(results.errors[0].message));
                    }

                    const headers = results.meta.fields || [];
                    const data = results.data;
                    resolve({ headers, data });
                },
                error: (err) => {
                    reject(err);
                }
            });
        });
    },

    /**
     * Parse File object
     * @param {File} file 
     * @returns {Object} { fileName: string, headers: Array, data: Array }
     */
    parseFile(file) {
        return new Promise((resolve, reject) => {
            Papa.parse(file, {
                header: true,
                skipEmptyLines: true,
                dynamicTyping: false,
                complete: (results) => {
                    const headers = results.meta.fields || [];
                    const data = results.data;
                    resolve({
                        fileName: file.name,
                        headers,
                        data
                    });
                },
                error: (err) => {
                    reject(err);
                }
            });
        });
    },

    /**
     * Clean and parse raw input text or YouTube search / video URLs
     */
    cleanSearchUrl(rawText) {
        if (!rawText) return { cleanTitle: '', artist: '', isUrl: false, directVideoId: null };

        const str = String(rawText).trim();

        // Check for direct YouTube video URL or ID
        const videoIdMatch = str.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
        if (videoIdMatch && videoIdMatch[1]) {
            return {
                cleanTitle: str,
                artist: '',
                isUrl: true,
                directVideoId: videoIdMatch[1]
            };
        }

        // Check for YouTube search result URL (e.g. results?search_query=...)
        if (str.includes('youtube.com/results') || str.includes('search_query=')) {
            try {
                const urlObj = new URL(str.startsWith('http') ? str : `https://${str}`);
                const queryParam = urlObj.searchParams.get('search_query');
                if (queryParam) {
                    const decoded = decodeURIComponent(queryParam).replace(/\+/g, ' ');
                    return {
                        cleanTitle: decoded,
                        artist: '',
                        isUrl: true,
                        directVideoId: null
                    };
                }
            } catch (e) {
                const qMatch = str.match(/search_query=([^&]+)/);
                if (qMatch && qMatch[1]) {
                    const decoded = decodeURIComponent(qMatch[1]).replace(/\+/g, ' ');
                    return {
                        cleanTitle: decoded,
                        artist: '',
                        isUrl: true,
                        directVideoId: null
                    };
                }
            }
        }

        return {
            cleanTitle: str,
            artist: '',
            isUrl: false,
            directVideoId: null
        };
    },

    /**
     * Guess best matching column names for Track, Artist, and Album
     * @param {Array<string>} headers 
     * @returns {Object} { trackCol, artistCol, albumCol }
     */
    detectColumns(headers) {
        if (!headers || headers.length === 0) {
            return { trackCol: '', artistCol: '', albumCol: '' };
        }

        const lowerHeaders = headers.map(h => ({ original: h, lower: h.toLowerCase().trim() }));

        // Track title candidates
        const trackCandidates = [
            'track name', 'trackname', 'track_name', 'track', 
            'song name', 'song title', 'song', 'title', 'name', 'url', 'link'
        ];

        // Artist candidates
        const artistCandidates = [
            'artist name(s)', 'artist name', 'artist name(s)', 'artist(s)', 
            'artist_name', 'artist', 'artists', 'performer'
        ];

        // Album candidates
        const albumCandidates = [
            'album name', 'album_name', 'album title', 'album', 'record'
        ];

        let trackCol = lowerHeaders.find(h => trackCandidates.includes(h.lower))?.original;
        let artistCol = lowerHeaders.find(h => artistCandidates.includes(h.lower))?.original;
        let albumCol = lowerHeaders.find(h => albumCandidates.includes(h.lower))?.original;

        // Fallbacks if exact match not found
        if (!trackCol) {
            trackCol = lowerHeaders.find(h => h.lower.includes('track') || h.lower.includes('title') || h.lower.includes('song') || h.lower.includes('url'))?.original || headers[0];
        }
        if (!artistCol) {
            artistCol = lowerHeaders.find(h => h.lower.includes('artist') || h.lower.includes('singer'))?.original || (headers[1] || '');
        }

        return {
            trackCol: trackCol || headers[0],
            artistCol: artistCol || '',
            albumCol: albumCol || ''
        };
    },

    /**
     * Normalize parsed CSV rows into standard Track items
     * Automatically parses & converts YouTube search URLs into clean search queries!
     */
    normalizeTracks(rows, columnMap, fileName = 'CSV') {
        const tracks = [];

        rows.forEach((row, index) => {
            let rawTrack = (row[columnMap.trackCol] || '').trim();
            let rawArtist = (row[columnMap.artistCol] || '').trim();
            const albumName = columnMap.albumCol ? (row[columnMap.albumCol] || '').trim() : '';

            if (rawTrack) {
                const parsedUrl = this.cleanSearchUrl(rawTrack);
                let trackName = parsedUrl.cleanTitle || rawTrack;
                let artistName = rawArtist;

                let youtubeMatch = null;
                let status = 'pending';

                if (parsedUrl.directVideoId) {
                    status = 'matched';
                    youtubeMatch = {
                        videoId: parsedUrl.directVideoId,
                        title: trackName,
                        channelTitle: artistName || 'YouTube',
                        thumbnail: `https://i.ytimg.com/vi/${parsedUrl.directVideoId}/hqdefault.jpg`,
                        url: `https://www.youtube.com/watch?v=${parsedUrl.directVideoId}`,
                        verification: {
                            score: 100,
                            status: 'verified',
                            badgeClass: 'badge-verified',
                            badgeText: '🟢 100% Direct Link Verified',
                            reason: 'Direct YouTube video link provided.'
                        }
                    };
                }

                tracks.push({
                    id: `track-${Date.now()}-${index}`,
                    index: index + 1,
                    trackName,
                    artistName,
                    albumName,
                    fileName,
                    searchQuery: parsedUrl.directVideoId ? parsedUrl.directVideoId : (artistName ? `${trackName} ${artistName}` : trackName),
                    status: status,
                    youtubeMatch: youtubeMatch,
                    errorMsg: null
                });
            }
        });

        return tracks;
    }
};

