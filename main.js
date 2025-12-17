const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    title: 'Package Manager for Intune'
  });

  mainWindow.loadFile('index.html');
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Fonctions pour parser les sorties
function parseWingetOutput(output) {
  const lines = output.split('\n');
  const packages = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.includes('---') || line.includes('Name')) continue;
    
    const parts = line.split(/\s{2,}/);
    if (parts.length >= 3) {
      const name = parts[0].trim();
      const id = parts[1].trim();
      const version = parts[2].trim();
      
      if (name && id && version) {
        packages.push({
          name,
          id,
          version,
          source: 'winget',
          description: `Package ${name}`,
          publisher: id.split('.')[0]
        });
      }
    }
  }
  
  return packages;
}

function parseChocoOutput(output) {
  const lines = output.split('\n');
  const packages = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('Chocolatey')) continue;
    
    const match = line.match(/^(.+?)\s+(\d+\.\d+\.\d+)/);
    if (match) {
      const name = match[1].trim();
      const version = match[2].trim();
      const id = name.toLowerCase().replace(/\s+/g, '.');
      
      packages.push({
        name,
        id,
        version,
        source: 'chocolatey',
        description: `Package ${name}`,
        publisher: name.split(' ')[0]
      });
    }
  }
  
  return packages;
}

// IPC handlers
ipcMain.handle('search-winget', async (event, query) => {
  return new Promise((resolve, reject) => {
    const command = `winget search "${query}" --accept-source-agreements`;
    exec(command, { timeout: 30000 }, (error, stdout, stderr) => {
      if (error) {
        reject(error.message);
        return;
      }
      resolve(parseWingetOutput(stdout));
    });
  });
});

ipcMain.handle('search-chocolatey', async (event, query) => {
  return new Promise((resolve, reject) => {
    const command = `choco search "${query}" --limit-output`;
    exec(command, { timeout: 30000 }, (error, stdout, stderr) => {
      if (error) {
        reject(error.message);
        return;
      }
      resolve(parseChocoOutput(stdout));
    });
  });
});

ipcMain.handle('deploy-to-intune', async (event, config, script) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({ success: true });
    }, 2000);
  });
});

ipcMain.handle('save-script', async (event, script, filename) => {
  try {
    const filePath = path.join(__dirname, filename);
    fs.writeFileSync(filePath, script);
    return { success: true, filePath };
  } catch (error) {
    return { success: false, error: error.message };
  }
});