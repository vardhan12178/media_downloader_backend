const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

const app = express();

app.use(cors({
  origin: ['http://localhost:3000', 'https://instant-video-downloader.vercel.app'],
  methods: 'GET,POST',
  allowedHeaders: 'Content-Type, Authorization'
}));

app.use(express.json());

app.options('*', cors());

app.post('/api/download', (req, res) => {
  const videoUrl = req.body.url;

  if (!videoUrl) {
    return res.status(400).json({ error: 'No URL provided' });
  }

  const timestamp = Date.now();
  const outputFileName = `video_${timestamp}.mp4`;
  const outputFilePath = path.join(__dirname, 'downloads', outputFileName);

  const command = `yt-dlp "${videoUrl}" -f "bestvideo[ext=mp4]+bestaudio[ext=m4a]" --merge-output-format mp4 -o "${outputFilePath}"`;

  exec(command, (error, stdout, stderr) => {
    if (error) {
      return res.status(500).json({ error: 'Failed to download video' });
    }

    fs.access(outputFilePath, fs.constants.F_OK, (err) => {
      if (err) {
        return res.status(404).json({ error: 'Downloaded file not found' });
      }

      res.download(outputFilePath, outputFileName, (downloadError) => {
        if (downloadError) {
          return res.status(500).json({ error: 'Failed to send the video file' });
        }

        fs.unlink(outputFilePath, (unlinkError) => {
          if (unlinkError) {
            console.error(`Error deleting file: ${unlinkError.message}`);
          }
        });
      });
    });
  });
});

app.use('/downloads', express.static(path.join(__dirname, 'downloads')));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
