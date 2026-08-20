/**
 * Mobile-First UI Manager Module for CSV to YT Playlist
 */

window.UIManager = {
    currentStep: 1,

    init() {
        this.bindGlobalEvents();
    },

    bindGlobalEvents() {
        document.getElementById('step-nav-1')?.addEventListener('click', () => this.switchStep(1));
        document.getElementById('step-nav-2')?.addEventListener('click', () => this.switchStep(2));
        document.getElementById('step-nav-3')?.addEventListener('click', () => this.switchStep(3));

        // Preview Modal Close Events
        document.getElementById('btn-close-preview-modal')?.addEventListener('click', () => this.closePreviewModal());
        document.getElementById('modal-video-preview')?.addEventListener('click', (e) => {
            if (e.target.id === 'modal-video-preview') this.closePreviewModal();
        });
    },

    switchStep(stepNumber) {
        this.currentStep = stepNumber;

        [1, 2, 3].forEach(num => {
            const navItem = document.getElementById(`step-nav-${num}`);
            const section = document.getElementById(`section-step-${num}`);
            
            if (num === stepNumber) {
                navItem?.classList.add('active');
                section?.classList.remove('hidden');
                section?.classList.add('active');
            } else {
                navItem?.classList.remove('active');
                section?.classList.add('hidden');
                section?.classList.remove('active');
            }
        });

        window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    renderFileList(files, onRemove) {
        const container = document.getElementById('file-list-container');
        const list = document.getElementById('file-list');

        if (!files || files.length === 0) {
            container.classList.add('hidden');
            list.innerHTML = '';
            return;
        }

        container.classList.remove('hidden');
        list.innerHTML = '';

        files.forEach((file, index) => {
            const chip = document.createElement('div');
            chip.className = 'file-chip';
            chip.innerHTML = `
                <span><i class="fa-solid fa-file-csv icon-red"></i> <strong>${this.escapeHtml(file.name)}</strong></span>
                <i class="fa-solid fa-xmark file-chip-remove" style="cursor:pointer;" title="Remove"></i>
            `;

            chip.querySelector('.file-chip-remove').addEventListener('click', () => onRemove(index));
            list.appendChild(chip);
        });
    },

    renderColumnSelectors(headers, detected) {
        const mapTrackSelect = document.getElementById('map-track');
        const mapArtistSelect = document.getElementById('map-artist');

        const buildOptions = (selectedVal, allowNone = false) => {
            let html = allowNone ? `<option value="">-- None --</option>` : '';
            headers.forEach(h => {
                const isSelected = (h === selectedVal) ? 'selected' : '';
                html += `<option value="${this.escapeHtml(h)}" ${isSelected}>${this.escapeHtml(h)}</option>`;
            });
            return html;
        };

        if (mapTrackSelect) mapTrackSelect.innerHTML = buildOptions(detected.trackCol);
        if (mapArtistSelect) mapArtistSelect.innerHTML = buildOptions(detected.artistCol, true);
    },

    /**
     * Render track cards with Song Verification Badges & Video Preview buttons
     */
    renderTrackCards(tracks, onSwapMatch, onPreview) {
        const container = document.getElementById('track-cards-list');
        const countSpan = document.getElementById('total-songs-count');
        
        if (countSpan) countSpan.innerText = tracks.length;
        this.updateVerificationStats(tracks);

        if (!container) return;

        if (!tracks || tracks.length === 0) {
            container.innerHTML = `<div class="text-center text-muted" style="padding:1rem;">No songs loaded.</div>`;
            return;
        }

        container.innerHTML = '';

        tracks.forEach((track) => {
            const card = document.createElement('div');
            const hasVideoMatch = track.youtubeMatch && track.youtubeMatch.videoId && track.youtubeMatch.videoId.length === 11;
            
            card.className = `track-card-item ${hasVideoMatch ? '' : 'unmatched-card'}`;

            const thumb = hasVideoMatch ? track.youtubeMatch.thumbnail : 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=100&auto=format&fit=crop&q=60';
            const displayTitle = track.trackName;
            const displayArtist = track.artistName || 'Unknown Artist';

            let verificationHtml = '';
            if (hasVideoMatch && track.youtubeMatch.verification) {
                const v = track.youtubeMatch.verification;
                verificationHtml = `<span class="badge-pill ${v.badgeClass}" title="${this.escapeHtml(v.reason)}">${this.escapeHtml(v.badgeText)}</span>`;
            } else if (track.status === 'searching') {
                verificationHtml = `<span class="badge-pill badge-searching"><i class="fa-solid fa-spinner fa-spin"></i> Searching...</span>`;
            } else {
                verificationHtml = `<span class="badge-pill badge-missing" title="No direct YouTube video found. Click Swap to search.">❌ No Video Match</span>`;
            }

            const videoTitleSub = hasVideoMatch ? `<div class="track-yt-title"><i class="fa-brands fa-youtube icon-red"></i> ${this.escapeHtml(track.youtubeMatch.title)}</div>` : '';

            card.innerHTML = `
                <div class="track-card-left">
                    <div class="thumb-wrapper">
                        <img src="${thumb}" class="track-thumb-img" alt="Thumb">
                        ${hasVideoMatch ? `<button class="thumb-play-overlay btn-preview-video" title="Preview Video"><i class="fa-solid fa-play"></i></button>` : ''}
                    </div>
                    <div class="track-card-details">
                        <div class="track-card-title">${this.escapeHtml(displayTitle)}</div>
                        <div class="track-card-artist">${this.escapeHtml(displayArtist)}</div>
                        ${videoTitleSub}
                        <div class="verification-badge-wrapper">${verificationHtml}</div>
                    </div>
                </div>
                <div class="track-card-actions">
                    ${hasVideoMatch ? `
                        <button class="btn btn-icon btn-sm btn-preview-video" title="Preview Video">
                            <i class="fa-solid fa-circle-play"></i>
                        </button>
                    ` : ''}
                    <button class="btn btn-icon btn-sm btn-swap-match" title="Swap / Search Video">
                        <i class="fa-solid fa-magnifying-glass"></i>
                    </button>
                </div>
            `;

            if (hasVideoMatch && onPreview) {
                card.querySelectorAll('.btn-preview-video').forEach(btn => {
                    btn.addEventListener('click', () => onPreview(track.youtubeMatch));
                });
            }

            card.querySelector('.btn-swap-match')?.addEventListener('click', () => onSwapMatch(track));
            container.appendChild(card);
        });
    },

    /**
     * Update verification summary metrics in Step 2
     */
    updateVerificationStats(tracks) {
        const statsBox = document.getElementById('verification-stats-summary');
        if (!statsBox) return;

        let verifiedCount = 0;
        let reviewCount = 0;
        let missingCount = 0;

        tracks.forEach(t => {
            if (t.youtubeMatch && t.youtubeMatch.videoId && t.youtubeMatch.verification) {
                const score = t.youtubeMatch.verification.score;
                if (score >= 90) verifiedCount++;
                else if (score >= 50) reviewCount++;
                else missingCount++;
            } else {
                missingCount++;
            }
        });

        statsBox.innerHTML = `
            <div class="stat-pill stat-verified" title="Exact Title & Artist Matches">
                <span>🟢 Verified:</span> <strong>${verifiedCount}</strong>
            </div>
            <div class="stat-pill stat-review" title="Matches requiring quick review">
                <span>🟡 Review:</span> <strong>${reviewCount}</strong>
            </div>
            <div class="stat-pill stat-missing" title="Tracks with no direct YouTube video">
                <span>❌ Missing:</span> <strong>${missingCount}</strong>
            </div>
        `;
    },

    /**
     * Render swap results with verification badges and preview buttons
     */
    renderSwapResults(items, onSelect, onPreview) {
        const grid = document.getElementById('swap-results-container');
        if (!grid) return;

        if (!items || items.length === 0) {
            grid.innerHTML = `<div class="text-center text-muted" style="grid-column:1/-1; padding:1.5rem;">No playable YouTube videos found. Try custom query or paste a direct video link above.</div>`;
            return;
        }

        grid.innerHTML = '';
        items.forEach(item => {
            const card = document.createElement('div');
            card.className = 'swap-card';
            
            const v = item.verification;
            const badgeHtml = v ? `<span class="badge-pill ${v.badgeClass}">${this.escapeHtml(v.badgeText)}</span>` : '';

            card.innerHTML = `
                <div class="swap-thumb-wrapper">
                    <img src="${item.thumbnail}" alt="Thumbnail">
                    <button class="swap-play-btn btn-swap-preview" title="Preview Video"><i class="fa-solid fa-play"></i></button>
                </div>
                <div class="swap-card-info">
                    <div class="swap-card-title">${this.escapeHtml(item.title)}</div>
                    <div class="swap-card-channel"><i class="fa-brands fa-youtube"></i> ${this.escapeHtml(item.channelTitle)}</div>
                    <div style="margin-top:0.35rem;">${badgeHtml}</div>
                    <button class="btn btn-sm btn-primary btn-block btn-select-swap" style="margin-top:0.5rem;">Select Video</button>
                </div>
            `;

            card.querySelector('.btn-select-swap')?.addEventListener('click', () => onSelect(item));
            card.querySelector('.btn-swap-preview')?.addEventListener('click', (e) => {
                e.stopPropagation();
                if (onPreview) onPreview(item);
            });

            grid.appendChild(card);
        });
    },

    /**
     * Open Embedded YouTube Player Preview Modal
     */
    openPreviewModal(video) {
        if (!video || !video.videoId) return;

        const modal = document.getElementById('modal-video-preview');
        const iframe = document.getElementById('preview-iframe');
        const titleLabel = document.getElementById('preview-video-title');

        if (titleLabel) titleLabel.innerText = video.title || 'Video Preview';
        if (iframe) iframe.src = `https://www.youtube-nocookie.com/embed/${video.videoId}?autoplay=1`;
        if (modal) modal.classList.remove('hidden');
    },

    closePreviewModal() {
        const modal = document.getElementById('modal-video-preview');
        const iframe = document.getElementById('preview-iframe');

        if (iframe) iframe.src = '';
        if (modal) modal.classList.add('hidden');
    },

    /**
     * Update Progress Bar UI
     */
    updateProgress(current, total, label = 'Matching songs...') {
        const container = document.getElementById('mobile-progress-container');
        const fill = document.getElementById('progress-bar-fill');
        const countText = document.getElementById('progress-count-text');
        const labelText = document.getElementById('progress-status-label');

        if (!container) return;

        if (total === 0) {
            container.classList.add('hidden');
            return;
        }

        container.classList.remove('hidden');
        const pct = Math.round((current / total) * 100);

        if (fill) fill.style.width = `${pct}%`;
        if (countText) countText.innerText = `${current} / ${total} (${pct}%)`;
        if (labelText) labelText.innerHTML = `<i class="fa-solid fa-spinner fa-spin icon-red"></i> ${this.escapeHtml(label)}`;

        if (current >= total) {
            setTimeout(() => {
                container.classList.add('hidden');
            }, 1000);
        }
    },

    escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
};

