# CSV to YouTube Playlist Pro (100% Frontend / No Backend)

A modern, responsive, client-side web application to convert track CSV files into YouTube playlists using pure JavaScript and the YouTube Data API v3 / Google OAuth 2.0.

![Client-Side Only](https://img.shields.io/badge/Backend-None%20(100%25%20Frontend)-brightgreen)
![License](https://img.shields.io/badge/License-MIT-blue)

---

## 🌟 Key Features

1. **100% Client-Side JS (Zero Backend)**:
   - All processing, CSV parsing, YouTube search, and playlist generation happen directly inside your web browser.
   - Your OAuth credentials and API Keys are stored safely in browser `localStorage` and never transmitted to any third-party server.

2. **Drag & Drop & Flexible CSV Parser**:
   - Supports single or multiple CSV files or pasted text.
   - Auto-detects columns for **Spotify Exports (Soundiiz, Exportify, TuneMyMusic)** like `Track Name`, `Artist Name(s)`, `Album Name`, `Title`, `Song`, `Artist`, etc.
   - Interactive column re-mapping dropdown UI.

3. **Interactive Track Review & Swap**:
   - Previews matched YouTube video title, channel, and thumbnail for every song.
   - "Swap Match" modal lets you re-search YouTube manually and select alternative video versions.

4. **Playlist Creation & Smart Rate-Limit Retry**:
   - Creates Private, Unlisted, or Public YouTube Playlists directly in your Google account.
   - Built-in exponential backoff retry loop for HTTP 429 rate limits (mirroring Python `ytmusicapi` rate-limit handling).
   - Real-time animated progress monitor, terminal log console, pause/resume, and cancel controls.

5. **Multi-Format Fallback Exports**:
   - **M3U Playlist File**: Download for VLC or local media players.
   - **Enriched CSV**: Download CSV populated with YouTube Video IDs and URLs.
   - **Copy Links**: One-click copy of YouTube video URLs to clipboard.
   - **Multi-Tab Opener**: Open unmatched search queries in browser tabs.

6. **Instant Demo Mode**:
   - Test the app without setting up Google API keys right away!

---

## 🚀 Quick Start Guide

### Running Locally
Simply open `index.html` in any web browser!
No server compilation, npm build, or Node.js server required.

```bash
# Optional: Serve with any static web server (e.g. Python, live-server, http-server)
python3 -m http.server 8080
# Or open directly:
# file:///data/data/com.termux/files/home/Code/csvtoytplaylist/index.html
```

---

## 🔑 Setting Up Google OAuth 2.0 (To create YouTube Playlists)

To allow the web app to create playlists on your YouTube account, you can create a free **Google OAuth 2.0 Client ID** in 2 minutes:

1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project (e.g., `CSV to YouTube`).
3. Under **APIs & Services > Library**, search for **YouTube Data API v3** and click **Enable**.
4. Under **APIs & Services > OAuth consent screen**:
   - Select **External**, fill in app name and your email, and save.
   - Under **Scopes**, add `https://www.googleapis.com/auth/youtube` and `https://www.googleapis.com/auth/youtube.force-ssl`.
5. Under **APIs & Services > Credentials > Create Credentials > OAuth client ID**:
   - Select **Web application**.
   - Add your origin URL under **Authorized JavaScript origins** (e.g. `http://localhost:8080` or `http://127.0.0.1:8080` or your GitHub Pages URL).
6. Copy the generated **Client ID** (looks like `xxxxxx.apps.googleusercontent.com`) into the app's **API Setup** modal!

---

## 📁 Project Structure

```
csvtoytplaylist/
├── index.html          # Responsive Web Application UI
├── css/
│   └── styles.css      # Dark Mode Glassmorphism CSS Design System
├── js/
│   ├── csvParser.js    # PapaParse & automatic column detection module
│   ├── youtubeApi.js   # Client-side OAuth2 & YouTube Data API v3 module
│   ├── uiManager.js    # DOM Rendering, Stepper, & Console Logger
│   └── app.js          # Core App Controller & State Manager
└── README.md           # Documentation
```

---

## 🛡️ Privacy & Security
Because this application is **100% frontend**, your CSV files, track lists, and Google authentication tokens stay completely local to your device.
# Csvtoplaylist
