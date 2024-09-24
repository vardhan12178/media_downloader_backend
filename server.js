const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

const app = express();

app.use(cors({
  origin: ['http://localhost:3000', 'https://instant-video-downloader.vercel.app/'],
  methods: 'GET,POST',
  allowedHeaders: 'Content-Type, Authorization'
}));

app.use(express.json());

const downloadVideo = (videoUrl, outputFilePath, retries, delay) => {
  return new Promise((resolve, reject) => {
    const command = `yt-dlp "${videoUrl}" -f "bestvideo[ext=mp4]+bestaudio[ext=m4a]" --merge-output-format mp4 -o "${outputFilePath}"`;

    exec(command, (error, stdout, stderr) => {
      if (error) {
        // Check if the error is an HTTP 429 error
        if (stderr.includes("HTTP Error 429")) {
          if (retries > 0) {
            console.log(`Received 429 error. Retrying in ${delay / 1000} seconds...`);
            setTimeout(() => {
              downloadVideo(videoUrl, outputFilePath, retries - 1, delay).then(resolve).catch(reject);
            }, delay);
          } else {
            reject({ error: 'Failed to download video', details: stderr });
          }
        } else {
          reject({ error: 'Failed to download video', details: stderr });
        }
      } else {
        resolve();
      }
    });
  });
};

app.post('/api/download', async (req, res) => {
  const videoUrl = req.body.url;

  if (!videoUrl) {
    return res.status(400).json({ error: 'No URL provided' });
  }

  const timestamp = Date.now();
  const outputFileName = `video_${timestamp}.mp4`;
  const outputFilePath = path.join(__dirname, 'downloads', outputFileName);

  try {
    await downloadVideo(videoUrl, outputFilePath, 3, 10000); // 3 retries, 10 seconds delay

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
            console.error('Failed to delete the file:', unlinkError);
          }
        });
      });
    });
  } catch (error) {
    return res.status(500).json(error);
  }
});

app.use('/downloads', express.static(path.join(__dirname, 'downloads')));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
