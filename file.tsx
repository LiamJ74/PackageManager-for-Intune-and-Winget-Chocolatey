import React, { useState } from 'react';

interface PackageResult {
  name: string;
  id: string;
  version: string;
  source: 'winget' | 'chocolatey';
  description: string;
  publisher?: string;
}

interface ConsoleMessage {
  timestamp: string;
  type: 'info' | 'success' | 'error';
  message: string;
}

declare global {
  interface Window {
    electronAPI: {
      searchPackages: (query: string, source: string) => Promise<PackageResult[]>;
      deployToIntune: (packageInfo: PackageResult, config: any) => Promise<any>;
      saveScript: (script: string, filename: string) => Promise<any>;
      platform: string;
    };
  }
}

export default function App() {
  const [currentStep, setCurrentStep] = useState<'search' | 'configure' | 'deploy' | 'success'>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<PackageResult[]>([]);
  const [selectedPackage, setSelectedPackage] = useState<PackageResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [consoleOutput, setConsoleOutput] = useState<ConsoleMessage[]>([
    { timestamp: new Date().toLocaleTimeString(), type: 'info', message: 'Application démarrée...' }
  ]);
  const [searchSource, setSearchSource] = useState<'both' | 'winget' | 'chocolatey'>('both');
  const [generatedScript, setGeneratedScript] = useState('');

  const addConsoleMessage = (message: string, type: 'info' | 'success' | 'error' = 'info') => {
    const newMessage: ConsoleMessage = {
      timestamp: new Date().toLocaleTimeString(),
      type,
      message
    };
    setConsoleOutput(prev => [...prev, newMessage]);
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    setCurrentStep('search');
    setConsoleOutput([]);
    addConsoleMessage(`Recherche de: "${searchQuery}"`);

    try {
      if (window.electronAPI) {
        const results = await window.electronAPI.searchPackages(searchQuery, searchSource);
        
        // Trier: Winget en premier
        results.sort((a, b) => {
          if (a.source === 'winget' && b.source !== 'winget') return -1;
          if (a.source !== 'winget' && b.source === 'winget') return 1;
          return 0;
        });
        
        setSearchResults(results);
        addConsoleMessage(`Trouvé ${results.length} packages`, 'success');
      } else {
        // Fallback pour développement web
        const mockResults: PackageResult[] = [
          {
            name: 'Adobe Acrobat Reader (64-bit)',
            id: 'Adobe.Acrobat.Reader.64-bit',
            version: '25.01',
            source: 'winget',
            description: 'PDF reader from Adobe',
            publisher: 'Adobe'
          },
          {
            name: 'Visual Studio Code',
            id: 'Microsoft.VisualStudioCode',
            version: '1.85.0',
            source: 'winget',
            description: 'Code editor from Microsoft',
            publisher: 'Microsoft'
          }
        ].filter(pkg => 
          pkg.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          pkg.id.toLowerCase().includes(searchQuery.toLowerCase())
        );
        
        setSearchResults(mockResults);
        addConsoleMessage(`Trouvé ${mockResults.length} packages (mode démo)`, 'success');
      }
    } catch (error) {
      addConsoleMessage(`Erreur lors de la recherche: ${error}`, 'error');
    }
    
    setIsSearching(false);
  };

  const handleSelectPackage = (pkg: PackageResult) => {
    setSelectedPackage(pkg);
    setCurrentStep('configure');
    generateScript(pkg);
    addConsoleMessage(`Package sélectionné: ${pkg.name} (${pkg.source})`);
  };

  const generateScript = (pkg: PackageResult) => {
    const template = pkg.source === 'winget' ? 
`# ============================================================
# Winget-Install Intune Win32 App – TEMPLATE
# Package: ${pkg.name}
# ID: ${pkg.id}
# Version: ${pkg.version}
# ============================================================

# Crée le dossier de log si inexistant
$LogFolder = "C:\\ProgramData\\Autopilot-Setup"
if (-not (Test-Path -Path $LogFolder)) {
    New-Item -ItemType Directory -Path $LogFolder -Force | Out-Null
}

# Définit le chemin du script WAU
$WUAScript = "C:\\Program Files\\Winget-Autoupdate-aaS\\Winget-AutoUpdate\\Winget-Install.ps1"

# Vérifie que le script existe
if (-not (Test-Path $WUAScript)) {
    Write-Output "ERROR: Winget-Install.ps1 not found at $WUAScript"
    exit 1
}

# AppID à installer
$AppID = '${pkg.id}'

# Exécution du script WAU avec bypass
try {
    Start-Process -FilePath "$env:WINDIR\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -ArgumentList @(
        "-ExecutionPolicy", "Bypass",
        "-NoProfile",
        "-File", $WUAScript,
        "-AppIDs", $AppID,
        "-LogPath", $LogFolder
    ) -Wait -PassThru | Out-Null

    if ($LASTEXITCODE -ne 0) {
        Write-Output "ERROR: Winget-Install.ps1 returned exit code $LASTEXITCODE"
        exit $LASTEXITCODE
    }
}
catch {
    Write-Output "ERROR: Exception caught - $_"
    exit 1
}

exit 0` :
`# ============================================================
# Chocolatey-Install Intune Win32 App – TEMPLATE
# Package: ${pkg.name}
# ID: ${pkg.id}
# Version: ${pkg.version}
# ============================================================

# Crée le dossier de log si inexistant
$LogFolder = "C:\\ProgramData\\Autopilot-Setup"
if (-not (Test-Path -Path $LogFolder)) {
    New-Item -ItemType Directory -Path $LogFolder -Force | Out-Null
}

# Chemin de Chocolatey
$ChocoPath = "C:\\ProgramData\\chocolatey\\choco.exe"

# Vérifie que Chocolatey est installé
if (-not (Test-Path $ChocoPath)) {
    Write-Output "ERROR: Chocolatey not found at $ChocoPath"
    exit 1
}

# Package ID à installer
$PackageID = '${pkg.id}'

# Exécution de l'installation Chocolatey
try {
    Start-Process -FilePath "$env:WINDIR\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -ArgumentList @(
        "-ExecutionPolicy", "Bypass",
        "-NoProfile",
        "-Command", "& $ChocoPath install $PackageID -y --log-file='$LogFolder\\choco-install.log'"
    ) -Wait -PassThru | Out-Null

    if ($LASTEXITCODE -ne 0) {
        Write-Output "ERROR: Chocolatey installation failed with exit code $LASTEXITCODE"
        exit $LASTEXITCODE
    }
}
catch {
    Write-Output "ERROR: Exception caught - $_"
    exit 1
}

exit 0`;
    
    setGeneratedScript(template);
  };

  const handleDeploy = async () => {
    if (!selectedPackage) return;
    
    setCurrentStep('deploy');
    addConsoleMessage('Début du déploiement sur Intune...');
    
    try {
      const config = {
        silent: true,
        autoUpdate: true,
        requirements: 'Windows 10 1809+'
      };
      
      if (window.electronAPI) {
        const result = await window.electronAPI.deployToIntune(selectedPackage, config);
        if (result.success) {
          addConsoleMessage('Déploiement réussi sur Intune!', 'success');
          setCurrentStep('success');
        } else {
          addConsoleMessage(`Échec du déploiement: ${result.message}`, 'error');
          setCurrentStep('configure');
        }
      } else {
        // Simulation pour développement web
        await new Promise(resolve => setTimeout(resolve, 2000));
        addConsoleMessage('Déploiement simulé réussi!', 'success');
        setCurrentStep('success');
      }
    } catch (error) {
      addConsoleMessage(`Erreur lors du déploiement: ${error}`, 'error');
      setCurrentStep('configure');
    }
  };

  const handleSaveScript = async () => {
    if (!generatedScript || !selectedPackage) return;
    
    try {
      const filename = `${selectedPackage.id}_install.ps1`;
      if (window.electronAPI) {
        const result = await window.electronAPI.saveScript(generatedScript, filename);
        if (result.success) {
          addConsoleMessage(`Script sauvegardé: ${result.path}`, 'success');
        }
      } else {
        addConsoleMessage(`Script prêt à être sauvegardé: ${filename}`, 'info');
      }
    } catch (error) {
      addConsoleMessage(`Erreur lors de la sauvegarde: ${error}`, 'error');
    }
  };

  const handleConnect = () => {
    setIsConnected(true);
    addConsoleMessage('Connexion à Intune établie', 'success');
  };

  const reset = () => {
    setSearchQuery('');
    setSearchResults([]);
    setSelectedPackage(null);
    setCurrentStep('search');
    setGeneratedScript('');
    setConsoleOutput([{ timestamp: new Date().toLocaleTimeString(), type: 'info', message: 'Prêt...' }]);
  };

  const clearConsole = () => {
    setConsoleOutput([{ timestamp: new Date().toLocaleTimeString(), type: 'info', message: 'Console effacée...' }]);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      {/* Header */}
      <header className="bg-slate-800 border-b border-slate-700 h-16 flex items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center text-white font-bold">
            P
          </div>
          <div className="text-xl font-semibold">Package Manager for Intune</div>
          <div className="bg-green-500 text-white px-2 py-1 rounded text-xs">Electron App</div>
        </div>
        <div>
          {isConnected ? (
            <div className="flex items-center gap-2 text-green-500">
              <span>✓</span>
              <span>Connecté à Intune</span>
            </div>
          ) : (
            <button 
              onClick={handleConnect}
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Se connecter à Intune
            </button>
          )}
        </div>
      </header>

      <div className="flex h-[calc(100vh-4rem)]">
        {/* Main Content */}
        <main className="flex-1 p-8 overflow-y-auto max-w-6xl mx-auto">
          {currentStep === 'search' && (
            <div className="space-y-6">
              {/* Search Card */}
              <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
                <div className="flex items-center gap-2 mb-2">
                  <span>🔍</span>
                  <h2 className="text-xl font-semibold">Rechercher un package</h2>
                </div>
                <p className="text-slate-400 mb-6">Recherchez des applications avec Winget et Chocolatey</p>
                <div className="flex gap-3">
                  <input
                    type="text"
                    placeholder="Tapez le nom d'une application (ex: Acrobat Reader, VS Code...)"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                    className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-slate-100 placeholder-slate-400 focus:outline-none focus:border-blue-500"
                  />
                  <select 
                    value={searchSource}
                    onChange={(e) => setSearchSource(e.target.value as any)}
                    className="bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-slate-100 focus:outline-none focus:border-blue-500"
                  >
                    <option value="both">Les deux</option>
                    <option value="winget">Winget</option>
                    <option value="chocolatey">Chocolatey</option>
                  </select>
                  <button 
                    onClick={handleSearch}
                    disabled={!searchQuery.trim() || isSearching}
                    className="bg-blue-500 hover:bg-blue-600 disabled:bg-slate-600 disabled:cursor-not-allowed text-white px-6 py-3 rounded-lg transition-colors"
                  >
                    {isSearching ? '⏳' : '🔍'}
                  </button>
                </div>
              </div>

              {/* Results */}
              {searchResults.length > 0 && (
                <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
                  <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                    <span>📦</span>
                    Résultats de recherche
                  </h3>
                  <div className="space-y-3">
                    {searchResults.map((pkg, index) => (
                      <div 
                        key={index}
                        onClick={() => handleSelectPackage(pkg)}
                        className={`border rounded-lg p-4 cursor-pointer transition-all hover:translate-y-[-2px] hover:shadow-lg ${
                          pkg.source === 'winget' 
                            ? 'border-blue-500 bg-blue-950 hover:bg-blue-900' 
                            : 'border-orange-500 bg-orange-950 hover:bg-orange-900'
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="font-semibold mb-1">{pkg.name}</div>
                            <div className="text-slate-400 text-sm mb-2">{pkg.description}</div>
                            <div className="flex gap-4 text-sm text-slate-400">
                              <span>ID: <code className="bg-slate-700 px-2 py-1 rounded">{pkg.id}</code></span>
                              <span>Version: {pkg.version}</span>
                              {pkg.publisher && <span>Éditeur: {pkg.publisher}</span>}
                            </div>
                          </div>
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            pkg.source === 'winget' ? 'bg-blue-500 text-white' : 'bg-orange-500 text-white'
                          }`}>
                            {pkg.source}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {currentStep === 'configure' && selectedPackage && (
            <div className="grid grid-cols-2 gap-6">
              {/* Package Summary */}
              <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
                <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <span>📦</span>
                  Résumé du package
                </h3>
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-slate-700 border-2 border-dashed border-slate-600 rounded-xl"></div>
                    <div>
                      <div className="font-semibold text-lg">{selectedPackage.name}</div>
                      <div className="text-slate-400">{selectedPackage.description}</div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-slate-400">ID du package:</span>
                      <code className="bg-slate-700 px-2 py-1 rounded">{selectedPackage.id}</code>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Version:</span>
                      <span className="font-medium">{selectedPackage.version}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Source:</span>
                      <span className={`font-medium ${selectedPackage.source === 'winget' ? 'text-blue-400' : 'text-orange-400'}`}>
                        {selectedPackage.source}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Deployment Configuration */}
              <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
                <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <span>⚙️</span>
                  Configuration du déploiement
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block mb-2 font-medium">Groupes cibles</label>
                    <select className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-slate-100 focus:outline-none focus:border-blue-500">
                      <option>Sélectionner les groupes</option>
                      <option value="all-users">Tous les utilisateurs</option>
                      <option value="it-dept">Département IT</option>
                      <option value="sales">Équipe commerciale</option>
                      <option value="dev">Développeurs</option>
                    </select>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <label className="font-medium">Installation silencieuse</label>
                    <input type="checkbox" defaultChecked className="w-4 h-4" />
                  </div>
                  <div className="flex justify-between items-center">
                    <label className="font-medium">Mises à jour automatiques</label>
                    <input type="checkbox" defaultChecked className="w-4 h-4" />
                  </div>

                  <div>
                    <label className="block mb-2 font-medium">Configuration requise</label>
                    <textarea 
                      rows={3}
                      className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-slate-100 focus:outline-none focus:border-blue-500 font-mono text-sm"
                      defaultValue="Windows 10 1809+"
                    />
                  </div>

                  <button 
                    onClick={handleDeploy}
                    className="w-full bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg flex items-center justify-center gap-2 transition-colors"
                  >
                    <span>▶️</span>
                    Déployer sur Intune
                  </button>
                </div>
              </div>

              {/* Generated Script */}
              <div className="col-span-2 bg-slate-800 border border-slate-700 rounded-xl p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xl font-semibold flex items-center gap-2">
                    <span>💻</span>
                    Script d'installation généré
                  </h3>
                  <button 
                    onClick={handleSaveScript}
                    className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm transition-colors"
                  >
                    💾 Sauvegarder
                  </button>
                </div>
                <textarea 
                  readOnly
                  rows={20}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-slate-100 font-mono text-sm"
                  value={generatedScript}
                />
              </div>
            </div>
          )}

          {currentStep === 'deploy' && (
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-12">
              <div className="text-center space-y-6">
                <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                <div className="text-2xl font-semibold">Déploiement en cours...</div>
                <div className="text-slate-400">
                  Création de l'application dans Intune et upload des fichiers
                </div>
              </div>
            </div>
          )}

          {currentStep === 'success' && selectedPackage && (
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-12">
              <div className="text-center space-y-8">
                <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto">
                  <span className="text-white text-2xl">✓</span>
                </div>
                <div>
                  <div className="text-3xl font-bold mb-2">Déploiement réussi!</div>
                  <div className="text-slate-400">
                    L'application a été ajoutée à Intune avec succès
                  </div>
                </div>
                <div className="bg-slate-700 rounded-xl p-6 max-w-md mx-auto text-left">
                  <div className="font-semibold mb-3">Détails du déploiement:</div>
                  <div className="space-y-1 text-sm">
                    <div>Application: {selectedPackage.name}</div>
                    <div>ID: {selectedPackage.id}</div>
                    <div>Version: {selectedPackage.version}</div>
                    <div>Source: {selectedPackage.source}</div>
                  </div>
                </div>
                <button 
                  onClick={reset}
                  className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg flex items-center gap-2 mx-auto transition-colors"
                >
                  <span>📦</span>
                  Déployer une autre application
                </button>
              </div>
            </div>
          )}
        </main>

        {/* Console */}
        <div className="w-96 bg-slate-900 border-l border-slate-700 p-4 flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2 font-semibold">
              <span>💻</span>
              Console
            </div>
            <button 
              onClick={clearConsole}
              className="bg-slate-700 hover:bg-slate-600 text-white px-3 py-1 rounded text-sm transition-colors"
            >
              Effacer
            </button>
          </div>
          <div className="flex-1 bg-slate-950 rounded-lg p-3 font-mono text-xs overflow-y-auto">
            {consoleOutput.map((msg, index) => (
              <div 
                key={index} 
                className={`mb-1 break-all ${
                  msg.type === 'error' ? 'text-red-400' : 
                  msg.type === 'success' ? 'text-green-400' : 
                  'text-slate-300'
                }`}
              >
                {msg.timestamp} [{msg.type.toUpperCase()}] {msg.message}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}