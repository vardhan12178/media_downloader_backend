const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
require('dotenv').config(); // Load environment variables from .env file

const app = express();

app.use(cors({
    origin: ['http://localhost:3000', 'https://instant-video-downloader.vercel.app'],
    methods: 'GET,POST',
    allowedHeaders: 'Content-Type, Authorization'
}));
  
app.use(express.json());

const downloadVideo = (videoUrl, outputFilePath, retries, delay) => {
  return new Promise((resolve, reject) => {
    const command = `yt-dlp "${videoUrl}" -f "bestvideo[ext=mp4]+bestaudio[ext=m4a]" --merge-output-format mp4 -o "${outputFilePath}"`;

    exec(command, (error, stdout, stderr) => {
      if (error) {
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
  const captchaToken = req.body.captchaToken;

  if (!videoUrl || !captchaToken) {
    return res.status(400).json({ error: 'No URL or CAPTCHA token provided' });
  }

  // Verify CAPTCHA token
  const secretKey = process.env.RECAPTCHA_SECRET_KEY; // Use environment variable
  const verificationUrl = `https://www.google.com/recaptcha/api/siteverify?secret=${secretKey}&response=${captchaToken}`;

  try {
    const response = await axios.post(verificationUrl);
    const { success } = response.data;

    if (!success) {
      return res.status(403).json({ error: 'CAPTCHA verification failed' });
    }

    const timestamp = Date.now();
    const outputFileName = `video_${timestamp}.mp4`;
    const outputFilePath = path.join(__dirname, 'downloads', outputFileName);

    await downloadVideo(videoUrl, outputFilePath, 3, 10000); // 3 retries, 10 seconds delay

    fs.access(outputFilePath, fs.constants.F_OK, (err) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Failed to access the downloaded file' });
      }

      res.download(outputFilePath, outputFileName, (err) => {
        if (err) {
          console.error(err);
          return res.status(500).json({ error: 'Failed to download the video' });
        }

        // Optionally delete the file after download
        fs.unlink(outputFilePath, (err) => {
          if (err) console.error('Failed to delete file:', err);
        });
      });
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'An error occurred during processing' });
  }
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
