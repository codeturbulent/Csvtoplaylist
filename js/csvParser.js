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
            'song name', 'song title', 'song', 'title', 'name'
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
            trackCol = lowerHeaders.find(h => h.lower.includes('track') || h.lower.includes('title') || h.lower.includes('song'))?.original || headers[0];
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
     * @param {Array} rows 
     * @param {Object} columnMap { trackCol, artistCol, albumCol }
     * @param {string} fileName
     * @returns {Array} List of Track objects
     */
    normalizeTracks(rows, columnMap, fileName = 'CSV') {
        const tracks = [];

        rows.forEach((row, index) => {
            const trackName = (row[columnMap.trackCol] || '').trim();
            const artistName = (row[columnMap.artistCol] || '').trim();
            const albumName = columnMap.albumCol ? (row[columnMap.albumCol] || '').trim() : '';

            if (trackName) {
                tracks.push({
                    id: `track-${Date.now()}-${index}`,
                    index: index + 1,
                    trackName,
                    artistName,
                    albumName,
                    fileName,
                    searchQuery: artistName ? `${trackName} ${artistName}` : trackName,
                    status: 'pending', // pending, searching, matched, error
                    youtubeMatch: null,
                    errorMsg: null
                });
            }
        });

        return tracks;
    }
};
