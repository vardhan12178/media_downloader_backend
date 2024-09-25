const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();

app.use(cors({
  origin: ['http://localhost:3000', 'https://instant-video-downloader.vercel.app'],
  methods: 'GET,POST',
  allowedHeaders: 'Content-Type, Authorization'
}));

app.use(express.json());

const getAvailableFormats = (videoUrl) => {
  return new Promise((resolve, reject) => {
    const command = `yt-dlp -F "${videoUrl}"`;
    
    exec(command, (error, stdout, stderr) => {
      if (error) {
        reject({ error: 'Failed to fetch available formats', details: stderr });
      } else {
        const formats = stdout.split('\n').filter(line => line.trim() !== '');
        resolve(formats);
      }
    });
  });
};

const downloadVideo = (videoUrl, outputFilePath, cookiesPath) => {
  return new Promise((resolve, reject) => {
    const command = `yt-dlp "${videoUrl}" -f "best" --cookies "${cookiesPath}" -o "${outputFilePath}"`;
    
    exec(command, (error, stdout, stderr) => {
      if (error) {
        reject({ error: 'Failed to download video', details: stderr });
      } else {
        resolve(stdout); // Return the output for logging or further processing
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
    const availableFormats = await getAvailableFormats(videoUrl);
    console.log('Available Formats:', availableFormats);

    const cookiesPath = path.join(__dirname, process.env.COOKIES_PATH || 'cookies.txt'); // Use environment variable or default
    await downloadVideo(videoUrl, outputFilePath, cookiesPath);

    fs.access(outputFilePath, fs.constants.F_OK, (err) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to access the downloaded file' });
      }

      res.download(outputFilePath, outputFileName, (err) => {
        if (err) {
          return res.status(500).json({ error: 'Failed to send the video file' });
        }

        // Delete the file after sending it to the client
        fs.unlink(outputFilePath, (err) => {
          if (err) console.error('Failed to delete file:', err);
        });
      });
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.error || 'An error occurred during processing', details: error.details || error });
  }
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
