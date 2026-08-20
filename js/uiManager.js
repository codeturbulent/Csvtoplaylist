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

    renderTrackCards(tracks, onSwapMatch) {
        const container = document.getElementById('track-cards-list');
        const countSpan = document.getElementById('total-songs-count');
        
        if (countSpan) countSpan.innerText = tracks.length;
        if (!container) return;

        if (!tracks || tracks.length === 0) {
            container.innerHTML = `<div class="text-center text-muted" style="padding:1rem;">No songs loaded.</div>`;
            return;
        }

        container.innerHTML = '';

        tracks.forEach((track) => {
            const card = document.createElement('div');
            card.className = 'track-card-item';

            const thumb = track.youtubeMatch ? track.youtubeMatch.thumbnail : 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=100&auto=format&fit=crop&q=60';
            const displayTitle = track.youtubeMatch ? track.youtubeMatch.title : track.trackName;
            const displayArtist = track.artistName || (track.youtubeMatch ? track.youtubeMatch.channelTitle : '');

            card.innerHTML = `
                <div class="track-card-left">
                    <img src="${thumb}" class="track-thumb-img" alt="Thumb">
                    <div class="track-card-details">
                        <div class="track-card-title">${this.escapeHtml(displayTitle)}</div>
                        <div class="track-card-artist">${this.escapeHtml(displayArtist)}</div>
                    </div>
                </div>
                <button class="btn btn-icon btn-sm btn-swap-match" title="Swap Video">
                    <i class="fa-solid fa-retweet"></i>
                </button>
            `;

            card.querySelector('.btn-swap-match')?.addEventListener('click', () => onSwapMatch(track));
            container.appendChild(card);
        });
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
