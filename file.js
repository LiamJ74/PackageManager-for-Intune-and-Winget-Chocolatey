const express = require('express');
const path = require('path');
const { exec } = require('child_process');

const app = express();
const port = 3000;

app.use(express.static('dist'));
app.use(express.json());

// API pour rechercher des packages
app.post('/api/search', (req, res) => {
  const { searchTerm } = req.body;
  exec(`winget search "${searchTerm}"`, (error, stdout, stderr) => {
    if (error) {
      res.status(500).json({ error: error.message });
    } else {
      res.json({ result: stdout });
    }
  });
});

// API pour installer des packages
app.post('/api/install', (req, res) => {
  const { packageId } = req.body;
  exec(`winget install "${packageId}" --accept-package-agreements --accept-source-agreements`, (error, stdout, stderr) => {
    if (error) {
      res.status(500).json({ error: error.message });
    } else {
      res.json({ result: stdout });
    }
  });
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
  // Ouvre le navigateur automatiquement
  const { exec } = require('child_process');
  exec(`start http://localhost:${port}`);
});