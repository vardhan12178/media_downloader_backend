const express = require('express');
const { spawn } = require('child_process');
const cors = require('cors');
const path = require('path');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const fs = require('fs');
const https = require('https');
require('dotenv').config();

const app = express();

app.use(express.json());
app.use(cors({
  origin: ['http://localhost:3000', 'https://instant-video-downloader.vercel.app'],
}));
app.use(compression());

const limiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 100,
});
app.use(limiter);


const ytDlpPath = path.join(__dirname, 'yt-dlp');


function downloadYtDlp() {
  const file = fs.createWriteStream(ytDlpPath);
  https.get('https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp', (response) => {
    response.pipe(file);
    file.on('finish', () => {
      fs.chmodSync(ytDlpPath, '755'); 
    });
  });
}


if (!fs.existsSync(ytDlpPath)) {
  downloadYtDlp();
}

app.post('/api/download', (req, res) => {
  const { platform, url } = req.body;

  if (!url || !platform) {
    return res.status(400).json({ error: 'Missing platform or URL' });
  }

  let args;
  const fileName = 'media.mp4';

  switch (platform) {
    case 'youtube':
      args = ['-f', 'bestvideo+bestaudio/best', url, '-o', '-'];
      break;
    case 'instagram':
      if (url.includes('/reel/') || url.includes('/stories/')) {
        args = ['-f', 'best', url, '-o', '-'];
      } else if (url.includes('/p/')) {
        args = ['-f', 'best', url, '-o', '-'];
      } else {
        return res.status(400).json({ error: 'Invalid Instagram URL format' });
      }
      break;
    case 'twitter':
      args = ['-f', 'best', url, '-o', '-'];
      break;
    default:
      return res.status(400).json({ error: 'Unsupported platform' });
  }

  const process = spawn(ytDlpPath, args);

  res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
  res.setHeader('Content-Type', 'video/mp4');

  process.stdout.pipe(res);

  process.stderr.on('data', (data) => {
    console.error('Error:', data.toString());
  });

  process.on('close', (code) => {
    if (code !== 0) {
      console.error('Download process exited with code', code);
      res.status(500).json({ error: 'Error downloading media' });
    }
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
