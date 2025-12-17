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
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, 'icon.png'),
    title: 'Package Manager for Intune'
  });

  // Charger l'application React
  mainWindow.loadFile('index.html');

  // Ouvrir les DevTools en développement
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Fonction pour parser la sortie de winget
function parseWingetOutput(output) {
  const lines = output.split('\n');
  const packages = [];
  
  // Ignorer les lignes d'en-tête
  const dataStartIndex = lines.findIndex(line => line.includes('---'));
  if (dataStartIndex === -1) return packages;
  
  for (let i = dataStartIndex + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // Parser le format de winget
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

// Fonction pour parser la sortie de chocolatey
function parseChocoOutput(output) {
  const lines = output.split('\n');
  const packages = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('Chocolatey') || line.includes('packages found')) continue;
    
    // Parser le format de chocolatey
    const match = line.match(/^(.+?)\s+(\d+\.\d+\.\d+)\s+$/);
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

// IPC Handlers
ipcMain.handle('search-winget', async (event, query) => {
  return new Promise((resolve, reject) => {
    const command = `winget search --name "${query}" --accept-source-agreements`;
    exec(command, { timeout: 30000 }, (error, stdout, stderr) => {
      if (error) {
        reject(error.message);
        return;
      }
      
      try {
        const packages = parseWingetOutput(stdout);
        resolve(packages);
      } catch (parseError) {
        reject(parseError.message);
      }
    });
  });
});

ipcMain.handle('search-chocolatey', async (event, query) => {
  return new Promise((resolve, reject) => {
    const chocoPath = 'C:\\ProgramData\\chocolatey\\choco.exe';
    const command = `"${chocoPath}" search "${query}" --limit-output`;
    
    exec(command, { timeout: 30000 }, (error, stdout, stderr) => {
      if (error) {
        reject(error.message);
        return;
      }
      
      try {
        const packages = parseChocoOutput(stdout);
        resolve(packages);
      } catch (parseError) {
        reject(parseError.message);
      }
    });
  });
});

ipcMain.handle('deploy-to-intune', async (event, config, script) => {
  // Simuler le déploiement sur Intune
  // Dans une vraie application, vous utiliseriez l'API Microsoft Graph ici
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(true);
    }, 2000);
  });
});

ipcMain.handle('show-save-dialog', async (event, defaultPath) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath,
    filters: [
      { name: 'PowerShell Scripts', extensions: ['ps1'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });
  
  if (!result.canceled && result.filePath) {
    // Sauvegarder le script
    fs.writeFileSync(result.filePath, event.sender.send('save-script', script));
  }
  
  return result.canceled ? null : result.filePath;
});

ipcMain.handle('show-open-dialog', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'PowerShell Scripts', extensions: ['ps1'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });
  
  return result.canceled ? null : result.filePaths[0];
});