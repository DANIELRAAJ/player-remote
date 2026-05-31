# YouTube Remote Control 🎬🎮

A real-time YouTube remote control app. Play videos on one screen and control playback from any other device.

## Features

- **Player view** (`/player`) — Embeds YouTube video, responds to remote commands
- **Remote view** (`/remote`) — Mobile-friendly controls: play, pause, seek, volume, load videos
- **Real-time sync** via WebSockets
- **Multi-remote** — Multiple phones can control the same player
- **Auto-reconnect** — Handles WiFi drops gracefully

## Deploy to Render (Free)

1. Push this repo to GitHub
2. Go to [render.com](https://render.com) → New → **Web Service**
3. Connect your GitHub repo
4. Render auto-detects settings from `render.yaml`
5. Click **Deploy**

## Run Locally

```bash
npm install
npm start
```

Open `http://localhost:3000/player` on your laptop and `http://<your-ip>:3000/remote` on your phone.
