const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const path = require('path');
const os = require('os');
const yts = require('yt-search');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// --- Static files ---
app.use(express.static(path.join(__dirname, 'public')));

// --- Routes ---
app.get('/player', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'player.html'));
});

app.get('/remote', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'remote.html'));
});

app.get('/', (_req, res) => {
  res.redirect('/remote');
});

// --- YouTube Search API ---
app.get('/api/search', async (req, res) => {
  const query = req.query.q;
  if (!query || query.trim().length === 0) {
    return res.json({ videos: [] });
  }

  try {
    const results = await yts(query);
    const videos = results.videos.slice(0, 12).map((v) => ({
      id: v.videoId,
      title: v.title,
      thumbnail: v.thumbnail || `https://img.youtube.com/vi/${v.videoId}/mqdefault.jpg`,
      duration: v.timestamp,
      channel: v.author?.name || '',
      views: v.views ? formatViews(v.views) : '',
    }));
    res.json({ videos });
  } catch (err) {
    console.error('Search error:', err.message);
    res.status(500).json({ videos: [], error: 'Search failed' });
  }
});

function formatViews(num) {
  if (num >= 1_000_000_000) return (num / 1_000_000_000).toFixed(1) + 'B';
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + 'M';
  if (num >= 1_000) return (num / 1_000).toFixed(1) + 'K';
  return String(num);
}

// --- WebSocket Hub ---
const players = new Set();
const remotes = new Set();

wss.on('connection', (ws) => {
  ws.isAlive = true;
  ws.role = null;

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }

    switch (msg.type) {
      case 'register':
        ws.role = msg.role;
        if (msg.role === 'player') {
          players.add(ws);
          console.log(`▶ Player connected (${players.size} total)`);
        } else if (msg.role === 'remote') {
          remotes.add(ws);
          console.log(`🎮 Remote connected (${remotes.size} total)`);
          // Send latest state to the newly connected remote
          if (latestState) {
            ws.send(JSON.stringify(latestState));
          }
        }
        break;

      case 'command':
        // Forward command from remote → all players
        console.log(`📡 Command: ${msg.action}${msg.value ? ' → ' + msg.value : ''} (→ ${players.size} players)`);
        for (const player of players) {
          if (player.readyState === 1) {
            player.send(JSON.stringify(msg));
          }
        }
        break;

      case 'state':
        // Cache latest state for new remotes
        latestState = msg;
        // Broadcast player state → all remotes
        for (const remote of remotes) {
          if (remote.readyState === 1) {
            remote.send(JSON.stringify(msg));
          }
        }
        break;
    }
  });

  ws.on('close', () => {
    if (ws.role === 'player') {
      players.delete(ws);
      console.log(`▶ Player disconnected (${players.size} remaining)`);
    } else if (ws.role === 'remote') {
      remotes.delete(ws);
      console.log(`🎮 Remote disconnected (${remotes.size} remaining)`);
    }
  });

  ws.on('error', (err) => {
    console.error('WebSocket error:', err.message);
  });
});

let latestState = null;

// --- Heartbeat to detect stale connections ---
const heartbeat = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (!ws.isAlive) {
      ws.terminate();
      return;
    }
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

wss.on('close', () => clearInterval(heartbeat));

wss.on('connection', (ws) => {
  ws.on('pong', () => { ws.isAlive = true; });
});

// --- Start server ---
const PORT = process.env.PORT || 3000;

server.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║     🎬  YouTube Remote Control  🎮          ║');
  console.log('╠══════════════════════════════════════════════╣');
  console.log(`║  Local:   http://localhost:${PORT}/player      ║`);

  // Print LAN addresses
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        console.log(`║  Network: http://${net.address}:${PORT}/remote`);
      }
    }
  }

  console.log('╠══════════════════════════════════════════════╣');
  console.log('║  Open /player on your laptop                ║');
  console.log('║  Open /remote on your phone                 ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log('');
});
