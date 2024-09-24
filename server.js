const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

const app = express();

// CORS configuration
app.use(cors({
  origin: ['http://localhost:3000', 'https://instant-video-downloader.vercel.app'], // No trailing slash
  methods: 'GET,POST',
  allowedHeaders: 'Content-Type, Authorization'
}));

app.use(express.json());

// Route to handle video download
app.post('/api/download', (req, res) => {
  const videoUrl = req.body.url;

  // Check for URL in the request body
  if (!videoUrl) {
    return res.status(400).json({ error: 'No URL provided' });
  }

  const timestamp = Date.now();
  const outputFileName = `video_${timestamp}.mp4`;
  const outputFilePath = path.join(__dirname, 'downloads', outputFileName);

  // Command to download video using yt-dlp
  const command = `yt-dlp "${videoUrl}" -f "bestvideo[ext=mp4]+bestaudio[ext=m4a]" --merge-output-format mp4 -o "${outputFilePath}"`;

  exec(command, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error executing command: ${stderr}`);
      console.error(`Full error: ${JSON.stringify(error)}`);
      return res.status(500).json({ error: 'Failed to download video', details: stderr });
    }

    fs.access(outputFilePath, fs.constants.F_OK, (err) => {
      if (err) {
        return res.status(404).json({ error: 'Downloaded file not found' });
      }

      // Send the downloaded video file to the client
      res.download(outputFilePath, outputFileName, (downloadError) => {
        if (downloadError) {
          console.error(`Error sending file: ${downloadError}`);
          return res.status(500).json({ error: 'Failed to send the video file' });
        }

        // Delete the file after sending it to the client
        fs.unlink(outputFilePath, (unlinkError) => {
          if (unlinkError) {
            console.error(`Error deleting file: ${unlinkError}`);
          }
        });
      });
    });
  });
});

// Serve static files from the downloads directory
app.use('/downloads', express.static(path.join(__dirname, 'downloads')));

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
