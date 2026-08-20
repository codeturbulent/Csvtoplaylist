/**
 * Streamlined Mobile Controller for CSV to YT Playlist Pro
 * Persistent Login + Google OAuth 2.0 Direct Account Playlist Creation
 */

(function () {
    const state = {
        files: [],
        parsedRows: [],
        headers: [],
        columnMap: { trackCol: '', artistCol: '' },
        tracks: [],
        activeSwapTrack: null
    };

    document.addEventListener('DOMContentLoaded', () => {
        UIManager.init();

        // 1. Initialize & restore persistent login session from localStorage
        const authStatus = YouTubeAPI.init();
        const clientIdInput = document.getElementById('cfg-client-id');
        if (clientIdInput && authStatus.clientId) {
            clientIdInput.value = authStatus.clientId;
        }

        // 2. Update UI if user is already logged in
        updateAuthUI(authStatus.isAuthenticated);

        bindFileUploadEvents();
        bindMappingEvents();
        bindOAuthEvents();
        bindExecutionEvents();
        bindExportEvents();
    });

    function updateAuthUI(isAuthenticated) {
        const statusDisplay = document.getElementById('oauth-status-display');
        const statusHeader = document.getElementById('oauth-status-header');
        const btnLoginHeader = document.getElementById('btn-oauth-header');

        if (isAuthenticated) {
            if (statusDisplay) statusDisplay.innerHTML = 'Status: <strong style="color:#00e676;">Signed In with Google</strong>';
            if (statusHeader) statusHeader.innerText = 'Connected';
            if (btnLoginHeader) {
                btnLoginHeader.className = 'btn btn-sm btn-secondary';
                btnLoginHeader.innerHTML = '<i class="fa-solid fa-circle-check" style="color:#00e676;"></i> Connected';
            }
        } else {
            if (statusDisplay) statusDisplay.innerHTML = 'Status: <strong>Not Signed In</strong>';
            if (statusHeader) statusHeader.innerText = 'Sign In with Google';
            if (btnLoginHeader) {
                btnLoginHeader.className = 'btn btn-sm btn-primary';
                btnLoginHeader.innerHTML = '<i class="fa-brands fa-google"></i> Sign In with Google';
            }
        }
    }

    /* ==========================================================================
       1. UPLOAD & PARSING
       ========================================================================== */
    function bindFileUploadEvents() {
        const dropzone = document.getElementById('dropzone');
        const fileInput = document.getElementById('csv-file-input');
        const btnLoadDemo = document.getElementById('btn-load-demo');
        const btnParseText = document.getElementById('btn-parse-text');
        const csvTextInput = document.getElementById('csv-text-input');

        if (dropzone && fileInput) {
            dropzone.addEventListener('click', () => fileInput.click());

            fileInput.addEventListener('change', (e) => {
                if (e.target.files && e.target.files.length > 0) {
                    handleSelectedFiles(Array.from(e.target.files));
                }
            });
        }

        if (btnLoadDemo) {
            btnLoadDemo.addEventListener('click', async () => {
                const demoText = CSVParser.sampleCSV;
                try {
                    const result = await CSVParser.parseText(demoText);
                    state.files = [{ name: 'demo_playlist.csv', size: demoText.length }];
                    state.headers = result.headers;
                    state.parsedRows = result.data.map(r => ({ ...r, _fileName: 'demo_playlist.csv' }));

                    UIManager.renderFileList(state.files, removeFile);
                    processHeadersAndProceed();
                } catch (err) {
                    alert('Error loading demo: ' + err.message);
                }
            });
        }

        if (btnParseText && csvTextInput) {
            btnParseText.addEventListener('click', async () => {
                const text = csvTextInput.value.trim();
                if (!text) {
                    alert('Please paste song titles into the text box.');
                    return;
                }

                try {
                    const result = await CSVParser.parseText(text);
                    state.files = [{ name: 'pasted_text.csv', size: text.length }];
                    state.headers = result.headers;
                    state.parsedRows = result.data.map(r => ({ ...r, _fileName: 'pasted_text.csv' }));

                    UIManager.renderFileList(state.files, removeFile);
                    processHeadersAndProceed();
                } catch (err) {
                    alert('CSV parsing error: ' + err.message);
                }
            });
        }
    }

    async function handleSelectedFiles(filesList) {
        state.files = filesList;
        state.parsedRows = [];
        state.headers = [];

        UIManager.renderFileList(state.files, removeFile);

        for (const file of filesList) {
            try {
                const res = await CSVParser.parseFile(file);
                if (res.headers && res.headers.length > 0) {
                    res.headers.forEach(h => {
                        if (!state.headers.includes(h)) state.headers.push(h);
                    });
                }
                const rowsWithFile = res.data.map(r => ({ ...r, _fileName: file.name }));
                state.parsedRows.push(...rowsWithFile);
            } catch (err) {
                console.error(`Error reading ${file.name}:`, err);
            }
        }

        if (state.parsedRows.length > 0) {
            processHeadersAndProceed();
        }
    }

    function removeFile(index) {
        state.files.splice(index, 1);
        if (state.files.length === 0) {
            state.parsedRows = [];
            state.headers = [];
            UIManager.renderFileList([], null);
        } else {
            handleSelectedFiles(state.files);
        }
    }

    function processHeadersAndProceed() {
        const detected = CSVParser.detectColumns(state.headers);
        state.columnMap = detected;
        UIManager.renderColumnSelectors(state.headers, detected);

        state.tracks = CSVParser.normalizeTracks(state.parsedRows, detected);
        UIManager.renderTrackCards(state.tracks, openSwapModal);

        UIManager.switchStep(2);
    }

    /* ==========================================================================
       2. MAPPING & MATCH SEARCH
       ========================================================================== */
    function bindMappingEvents() {
        const mapTrackSelect = document.getElementById('map-track');
        const mapArtistSelect = document.getElementById('map-artist');
        const btnStartSearch = document.getElementById('btn-start-search');
        const filterInput = document.getElementById('filter-tracks');

        const updateTrackMapping = () => {
            state.columnMap.trackCol = mapTrackSelect.value;
            state.columnMap.artistCol = mapArtistSelect.value;

            state.tracks = CSVParser.normalizeTracks(state.parsedRows, state.columnMap);
            UIManager.renderTrackCards(state.tracks, openSwapModal);
        };

        mapTrackSelect?.addEventListener('change', updateTrackMapping);
        mapArtistSelect?.addEventListener('change', updateTrackMapping);

        filterInput?.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase().trim();
            const filtered = state.tracks.filter(t => 
                t.trackName.toLowerCase().includes(query) ||
                t.artistName.toLowerCase().includes(query)
            );
            UIManager.renderTrackCards(filtered, openSwapModal);
        });

        btnStartSearch?.addEventListener('click', async () => {
            if (state.tracks.length === 0) return alert('No songs loaded.');

            btnStartSearch.disabled = true;
            await executeTrackSearchBatch();
            btnStartSearch.disabled = false;

            UIManager.switchStep(3);
        });
    }

    async function executeTrackSearchBatch() {
        const total = state.tracks.length;

        for (let i = 0; i < total; i++) {
            const track = state.tracks[i];
            track.status = 'searching';
            
            UIManager.updateProgress(i + 1, total, `Searching YouTube for "${track.trackName}"...`);
            UIManager.renderTrackCards(state.tracks, openSwapModal);

            try {
                const results = await YouTubeAPI.searchVideos(track.searchQuery, 3);
                if (results && results.length > 0) {
                    track.status = 'matched';
                    track.youtubeMatch = results[0];
                    track.allMatches = results;
                } else {
                    track.status = 'error';
                }
            } catch (err) {
                track.status = 'error';
            }

            UIManager.renderTrackCards(state.tracks, openSwapModal);
            await new Promise(res => setTimeout(res, 200));
        }

        UIManager.updateProgress(total, total, 'Completed!');
    }

    /* ==========================================================================
       3. OAUTH GOOGLE SIGN-IN BINDINGS
       ========================================================================== */
    function bindOAuthEvents() {
        const btnLogin = document.getElementById('btn-gsi-login');
        const btnHeaderOAuth = document.getElementById('btn-oauth-header');
        const clientIdInput = document.getElementById('cfg-client-id');
        const linkGuide = document.getElementById('link-how-to-get-client-id');
        const modalGuide = document.getElementById('modal-client-guide');
        const btnCloseGuide = document.getElementById('btn-close-guide-modal');

        const doGoogleLogin = () => {
            const clientId = clientIdInput?.value.trim();
            if (!clientId) {
                alert('Please enter your Google OAuth Client ID first.');
                return;
            }

            YouTubeAPI.saveClientId(clientId);

            YouTubeAPI.requestOAuthToken(clientId, (success, tokenOrErr) => {
                if (success) {
                    updateAuthUI(true);
                    alert('Successfully connected to Google!');
                } else {
                    alert('Google Sign-In Error: ' + tokenOrErr);
                }
            });
        };

        btnLogin?.addEventListener('click', doGoogleLogin);
        btnHeaderOAuth?.addEventListener('click', doGoogleLogin);

        linkGuide?.addEventListener('click', (e) => {
            e.preventDefault();
            modalGuide?.classList.remove('hidden');
        });

        btnCloseGuide?.addEventListener('click', () => {
            modalGuide?.classList.add('hidden');
        });
    }

    /* ==========================================================================
       4. GOOGLE OAUTH DIRECT PLAYLIST CREATION (STEP 3)
       ========================================================================== */
    function bindExecutionEvents() {
        const btnCreate = document.getElementById('btn-create-account-playlist');
        const progressContainer = document.getElementById('create-progress-container');
        const fillBar = document.getElementById('create-bar-fill');
        const statusLabel = document.getElementById('create-status-label');
        const countText = document.getElementById('create-count-text');
        const resultSuccessBox = document.getElementById('result-success-box');
        const resultText = document.getElementById('result-success-text');
        const openLinkBtn = document.getElementById('link-open-yt-playlist');

        btnCreate?.addEventListener('click', async () => {
            if (!YouTubeAPI.accessToken) {
                const proceed = confirm('Google OAuth Sign-In is required to create playlists in your account.\n\nSign in with Google now?');
                if (proceed) {
                    document.getElementById('btn-gsi-login')?.click();
                }
                return;
            }

            const matchedTracks = state.tracks.filter(t => t.youtubeMatch && t.youtubeMatch.videoId);
            if (matchedTracks.length === 0) {
                alert('No matched YouTube videos available to create playlist.');
                return;
            }

            const title = document.getElementById('playlist-name-input')?.value.trim() || 'My CSV Playlist';
            const privacy = document.getElementById('playlist-privacy-select')?.value || 'unlisted';

            btnCreate.disabled = true;
            progressContainer?.classList.remove('hidden');

            try {
                if (statusLabel) statusLabel.innerHTML = `<i class="fa-solid fa-spinner fa-spin icon-red"></i> Creating playlist "${title}"...`;
                
                const playlistId = await YouTubeAPI.createPlaylistInAccount(title, privacy);
                const playlistUrl = `https://www.youtube.com/playlist?list=${playlistId}`;

                let successCount = 0;
                const total = matchedTracks.length;

                for (let i = 0; i < total; i++) {
                    const track = matchedTracks[i];
                    const pct = Math.round(((i + 1) / total) * 100);

                    if (fillBar) fillBar.style.width = `${pct}%`;
                    if (countText) countText.innerText = `${i + 1} / ${total} (${pct}%)`;
                    if (statusLabel) statusLabel.innerHTML = `<i class="fa-solid fa-spinner fa-spin icon-red"></i> Adding "${track.youtubeMatch.title}"...`;

                    try {
                        await YouTubeAPI.addVideoToPlaylist(playlistId, track.youtubeMatch.videoId);
                        successCount++;
                    } catch (e) {
                        console.warn(`Failed to add song ${track.youtubeMatch.title}:`, e);
                    }

                    await new Promise(res => setTimeout(res, 500));
                }

                progressContainer?.classList.add('hidden');
                resultSuccessBox?.classList.remove('hidden');
                if (resultText) resultText.innerText = `Added ${successCount} out of ${total} songs to your YouTube Account!`;
                if (openLinkBtn) openLinkBtn.href = playlistUrl;

                window.open(playlistUrl, '_blank');

            } catch (err) {
                alert('Failed to create playlist: ' + err.message);
            } finally {
                btnCreate.disabled = false;
            }
        });
    }

    /* ==========================================================================
       5. EXPORT OPTIONS
       ========================================================================== */
    function bindExportEvents() {
        document.getElementById('btn-export-m3u')?.addEventListener('click', () => {
            const matchedTracks = state.tracks.filter(t => t.youtubeMatch);
            if (matchedTracks.length === 0) return alert('No matched videos available.');

            let m3uContent = '#EXTM3U\n';
            matchedTracks.forEach(t => {
                m3uContent += `#EXTINF:-1,${t.artistName ? t.artistName + ' - ' : ''}${t.trackName}\n`;
                m3uContent += `${t.youtubeMatch.url}\n`;
            });

            downloadFile(m3uContent, 'playlist.m3u', 'audio/x-mpegurl');
        });

        document.getElementById('btn-copy-urls')?.addEventListener('click', () => {
            const urls = state.tracks
                .filter(t => t.youtubeMatch)
                .map(t => t.youtubeMatch.url)
                .join('\n');

            if (!urls) return alert('No matched video links available.');

            navigator.clipboard.writeText(urls).then(() => {
                alert('Copied matched YouTube URLs to clipboard!');
            }).catch(err => alert('Failed to copy: ' + err.message));
        });
    }

    function downloadFile(content, fileName, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    /* ==========================================================================
       6. SWAP MODAL
       ========================================================================== */
    function openSwapModal(track) {
        state.activeSwapTrack = track;
        const modal = document.getElementById('modal-swap-match');
        const input = document.getElementById('swap-search-input');

        if (input) input.value = track.searchQuery;
        if (modal) modal.classList.remove('hidden');

        renderSwapResults(track.allMatches || []);
    }

    function renderSwapResults(items) {
        const grid = document.getElementById('swap-results-container');
        if (!grid) return;

        if (!items || items.length === 0) {
            grid.innerHTML = `<div class="text-center text-muted">No video results found.</div>`;
            return;
        }

        grid.innerHTML = '';
        items.forEach(item => {
            const card = document.createElement('div');
            card.className = 'swap-card';
            card.innerHTML = `
                <img src="${item.thumbnail}" alt="Thumbnail">
                <div class="swap-card-info">
                    <div class="swap-card-title">${UIManager.escapeHtml(item.title)}</div>
                </div>
            `;

            card.addEventListener('click', () => {
                if (state.activeSwapTrack) {
                    state.activeSwapTrack.youtubeMatch = item;
                    state.activeSwapTrack.status = 'matched';
                    UIManager.renderTrackCards(state.tracks, openSwapModal);
                }
                document.getElementById('modal-swap-match')?.classList.add('hidden');
            });

            grid.appendChild(card);
        });
    }

    document.getElementById('btn-close-swap-modal')?.addEventListener('click', () => {
        document.getElementById('modal-swap-match')?.classList.add('hidden');
    });

    document.getElementById('btn-execute-swap-search')?.addEventListener('click', async () => {
        const query = document.getElementById('swap-search-input')?.value.trim();
        if (!query) return;
        
        try {
            const results = await YouTubeAPI.searchVideos(query, 6);
            renderSwapResults(results);
        } catch (err) {
            alert('Search failed: ' + err.message);
        }
    });
})();
