import React, { useState, useEffect } from 'react';
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { RadioGroup, RadioGroupItem } from "../components/ui/radio-group";
import { Search, Package, Upload, Check, AlertCircle, Settings, Shield, Key, Building, User } from "lucide-react";

interface PackageResult {
  name: string;
  id: string;
  version: string;
  source: 'winget' | 'chocolatey';
  description?: string;
  publisher?: string;
}

interface DeploymentConfig {
  appId: string;
  displayName: string;
  description: string;
  publisher: string;
  version: string;
  installCommand: string;
  uninstallCommand: string;
  detectionRules: string;
  requirements: string;
  assignmentGroups: string[];
  installAsSystem: boolean;
  silentInstall: boolean;
  autoUpdate: boolean;
}

interface MgGraphCredentials {
  clientId: string;
  clientSecret: string;
  tenantId: string;
}

const mockPackages: PackageResult[] = [
  {
    name: "Adobe Acrobat Reader (64-bit)",
    id: "Adobe.Acrobat.Reader.64-bit",
    version: "25.01.20787",
    source: "winget",
    description: "View, sign, and annotate PDFs",
    publisher: "Adobe"
  },
  {
    name: "Adobe Acrobat Reader",
    id: "adobereader",
    version: "25.01.20787",
    source: "chocolatey",
    description: "PDF reader from Adobe",
    publisher: "Adobe"
  },
  {
    name: "Visual Studio Code",
    id: "Microsoft.VisualStudioCode",
    version: "1.95.3",
    source: "winget",
    description: "Code editing. Redefined.",
    publisher: "Microsoft"
  },
  {
    name: "VS Code",
    id: "vscode",
    version: "1.95.3",
    source: "chocolatey",
    description: "Free source-code editor",
    publisher: "Microsoft"
  },
  {
    name: "Google Chrome",
    id: "Google.Chrome",
    version: "131.0.6778.108",
    source: "winget",
    description: "Fast, secure, and smart browser",
    publisher: "Google"
  },
  {
    name: "googlechrome",
    id: "googlechrome",
    version: "131.0.6778.108",
    source: "chocolatey",
    description: "Web browser from Google",
    publisher: "Google"
  }
];

export default function PackageManager() {
  const [currentStep, setCurrentStep] = useState<'search' | 'select' | 'configure' | 'deploy' | 'success'>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<PackageResult[]>([]);
  const [selectedPackage, setSelectedPackage] = useState<PackageResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);
  const [deploymentProgress, setDeploymentProgress] = useState(0);
  const [deploymentLogs, setDeploymentLogs] = useState<string[]>([]);
  const [showMgGraphConfig, setShowMgGraphConfig] = useState(false);
  const [mgGraphCredentials, setMgGraphCredentials] = useState<MgGraphCredentials>({
    clientId: '',
    clientSecret: '',
    tenantId: ''
  });
  const [credentialsSaved, setCredentialsSaved] = useState(false);

  const [deploymentConfig, setDeploymentConfig] = useState<DeploymentConfig>({
    appId: '',
    displayName: '',
    description: '',
    publisher: '',
    version: '',
    installCommand: '',
    uninstallCommand: '',
    detectionRules: '',
    requirements: '',
    assignmentGroups: [],
    installAsSystem: true,
    silentInstall: true,
    autoUpdate: false
  });

  useEffect(() => {
    // Charger les credentials depuis localStorage
    const savedCredentials = localStorage.getItem('mgGraphCredentials');
    if (savedCredentials) {
      const credentials = JSON.parse(savedCredentials);
      setMgGraphCredentials(credentials);
      setCredentialsSaved(true);
    }
  }, []);

  const handleSearch = () => {
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    setDeploymentLogs([`Recherche de "${searchQuery}"...`]);
    
    setTimeout(() => {
      const filtered = mockPackages.filter(pkg => 
        pkg.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        pkg.id.toLowerCase().includes(searchQuery.toLowerCase())
      );
      
      // Trier pour mettre Winget en premier
      const sorted = filtered.sort((a, b) => {
        if (a.source === 'winget' && b.source !== 'winget') return -1;
        if (a.source !== 'winget' && b.source === 'winget') return 1;
        return 0;
      });
      
      setSearchResults(sorted);
      setIsSearching(false);
      setDeploymentLogs(prev => [...prev, `Trouvé ${sorted.length} package(s)`]);
    }, 1000);
  };

  const handlePackageSelect = (pkg: PackageResult) => {
    setSelectedPackage(pkg);
    setDeploymentConfig(prev => ({
      ...prev,
      appId: pkg.id,
      displayName: pkg.name,
      publisher: pkg.publisher || '',
      version: pkg.version,
      description: pkg.description || '',
      installCommand: pkg.source === 'winget' 
        ? `winget install --id ${pkg.id} --accept-package-agreements --accept-source-agreements`
        : `choco install ${pkg.id} -y`,
      uninstallCommand: pkg.source === 'winget'
        ? `winget uninstall --id ${pkg.id}`
        : `choco uninstall ${pkg.id} -y`
    }));
    setCurrentStep('configure');
  };

  const saveMgGraphCredentials = () => {
    if (!mgGraphCredentials.clientId || !mgGraphCredentials.clientSecret || !mgGraphCredentials.tenantId) {
      setDeploymentLogs(prev => [...prev, '❌ Veuillez remplir tous les champs Microsoft Graph']);
      return;
    }

    localStorage.setItem('mgGraphCredentials', JSON.stringify(mgGraphCredentials));
    setCredentialsSaved(true);
    setShowMgGraphConfig(false);
    setDeploymentLogs(prev => [...prev, '✅ Identifiants Microsoft Graph sauvegardés']);
  };

  const handleDeploy = async () => {
    if (!credentialsSaved) {
      setShowMgGraphConfig(true);
      setDeploymentLogs(prev => [...prev, '⚠️ Configuration Microsoft Graph requise']);
      return;
    }

    setIsDeploying(true);
    setDeploymentProgress(0);
    setDeploymentLogs([
      '🚀 Démarrage du déploiement...',
      `📦 Package: ${selectedPackage?.name}`,
      `🆔 ID: ${selectedPackage?.id}`,
      `🔧 Source: ${selectedPackage?.source}`,
      ''
    ]);

    const steps = [
      { message: '🔐 Connexion à Microsoft Graph...', duration: 1500 },
      { message: '📋 Création du package .intunewin...', duration: 2000 },
      { message: '📝 Génération du script PowerShell...', duration: 1000 },
      { message: '⬆️ Upload du package vers Intune...', duration: 2500 },
      { message: '🔍 Configuration des règles de détection...', duration: 1500 },
      { message: '👥 Configuration des groupes cibles...', duration: 1500 },
      { message: '📤 Déploiement vers les groupes...', duration: 2000 },
      { message: '✅ Déploiement terminé avec succès !', duration: 1000 }
    ];

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      await new Promise(resolve => setTimeout(resolve, step.duration));
      setDeploymentProgress(((i + 1) / steps.length) * 100);
      setDeploymentLogs(prev => [...prev, step.message]);
    }

    setIsDeploying(false);
    setCurrentStep('success');
  };

  const generatePowerShellScript = () => {
    if (!selectedPackage) return '';
    
    return `# ============================================================
# Winget-Install Intune Win32 App – TEMPLATE
# Log: C:\\ProgramData\\Autopilot-Setup
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
$AppID = '${selectedPackage.id}'

# Exécution du script WAU avec bypass
try {
    Start-Process -FilePath "$env:WINDIR\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" \\
        -ArgumentList @(
            '-ExecutionPolicy', 'Bypass',
            '-NoProfile',
            '-File', "`"$WUAScript`"",
            '-AppIDs', "`"$AppID`"",
            '-LogPath', "`"$LogFolder`""
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

exit 0`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Package className="h-8 w-8 text-blue-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Package Manager for Intune</h1>
                <p className="text-gray-600">Déployez facilement des applications avec Winget et Chocolatey</p>
              </div>
            </div>
            <Button 
              variant="outline" 
              onClick={() => setShowMgGraphConfig(true)}
              className="flex items-center space-x-2"
            >
              <Key className="h-4 w-4" />
              <span>Microsoft Graph</span>
              {credentialsSaved ? <Check className="h-4 w-4 text-green-600" /> : <AlertCircle className="h-4 w-4 text-orange-600" />}
            </Button>
          </div>
        </div>

        {/* Progress Steps */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between">
            {[
              { step: 'search', label: 'Recherche', icon: Search },
              { step: 'select', label: 'Sélection', icon: Package },
              { step: 'configure', label: 'Configuration', icon: Settings },
              { step: 'deploy', label: 'Déploiement', icon: Upload },
              { step: 'success', label: 'Terminé', icon: Check }
            ].map(({ step, label, icon: Icon }) => {
              const isActive = currentStep === step;
              const isCompleted = ['success'].includes(currentStep) || 
                (currentStep === 'deploy' && ['search', 'select', 'configure'].includes(step)) ||
                (currentStep === 'configure' && ['search', 'select'].includes(step)) ||
                (currentStep === 'select' && step === 'search');
              
              return (
                <div key={step} className="flex items-center">
                  <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                    isActive ? 'border-blue-600 bg-blue-600 text-white' :
                    isCompleted ? 'border-green-600 bg-green-600 text-white' :
                    'border-gray-300 bg-white text-gray-400'
                  }`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className={`ml-2 text-sm font-medium ${
                    isActive ? 'text-blue-600' :
                    isCompleted ? 'text-green-600' :
                    'text-gray-400'
                  }`}>
                    {label}
                  </span>
                  {step !== 'success' && (
                    <div className={`w-16 h-1 mx-4 ${
                      isCompleted ? 'bg-green-600' : 'bg-gray-300'
                    }`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Microsoft Graph Configuration Modal */}
        {showMgGraphConfig && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <Card className="w-full max-w-2xl">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Shield className="h-5 w-5" />
                  <span>Configuration Microsoft Graph</span>
                </CardTitle>
                <CardDescription>
                  Entrez vos identifiants pour vous connecter à Microsoft Graph et déployer sur Intune
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="tenantId">Tenant ID</Label>
                  <Input
                    id="tenantId"
                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                    value={mgGraphCredentials.tenantId}
                    onChange={(e) => setMgGraphCredentials(prev => ({ ...prev, tenantId: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="clientId">Client ID</Label>
                  <Input
                    id="clientId"
                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                    value={mgGraphCredentials.clientId}
                    onChange={(e) => setMgGraphCredentials(prev => ({ ...prev, clientId: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="clientSecret">Client Secret</Label>
                  <Input
                    id="clientSecret"
                    type="password"
                    placeholder="Votre client secret"
                    value={mgGraphCredentials.clientSecret}
                    onChange={(e) => setMgGraphCredentials(prev => ({ ...prev, clientSecret: e.target.value }))}
                  />
                </div>
                <div className="bg-blue-50 p-4 rounded-lg">
                  <p className="text-sm text-blue-800">
                    <strong>💡 Où trouver ces informations ?</strong><br />
                    1. Allez sur <a href="https://portal.azure.com" target="_blank" className="underline">Azure Portal</a><br />
                    2. Azure Active Directory → App registrations<br />
                    3. Créez une nouvelle application ou utilisez une existante<br />
                    4. Copiez le Tenant ID et Application (client) ID<br />
                    5. Générez un nouveau Client Secret
                  </p>
                </div>
              </CardContent>
              <div className="flex justify-end space-x-2 p-6">
                <Button variant="outline" onClick={() => setShowMgGraphConfig(false)}>
                  Annuler
                </Button>
                <Button onClick={saveMgGraphCredentials}>
                  Sauvegarder
                </Button>
              </div>
            </Card>
          </div>
        )}

        {/* Main Content */}
        {currentStep === 'search' && (
          <Card>
            <CardHeader>
              <CardTitle>Rechercher un package</CardTitle>
              <CardDescription>
                Recherchez des applications depuis Winget et Chocolatey
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex space-x-2">
                <Input
                  placeholder="Tapez le nom d'une application (ex: Adobe Reader, VS Code, Chrome)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  className="flex-1"
                />
                <Button onClick={handleSearch} disabled={isSearching}>
                  <Search className="h-4 w-4 mr-2" />
                  {isSearching ? 'Recherche...' : 'Rechercher'}
                </Button>
              </div>
              
              {searchResults.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-lg font-semibold mb-4">Résultats ({searchResults.length})</h3>
                  <div className="space-y-3">
                    {searchResults.map((pkg, index) => (
                      <div
                        key={index}
                        className="border rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                        onClick={() => handlePackageSelect(pkg)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2">
                              <h4 className="font-medium">{pkg.name}</h4>
                              <span className={`px-2 py-1 text-xs rounded-full ${
                                pkg.source === 'winget' 
                                  ? 'bg-blue-100 text-blue-800' 
                                  : 'bg-orange-100 text-orange-800'
                              }`}>
                                {pkg.source.toUpperCase()}
                              </span>
                            </div>
                            <p className="text-sm text-gray-600 mt-1">ID: {pkg.id}</p>
                            <p className="text-sm text-gray-500">Version: {pkg.version}</p>
                            {pkg.description && (
                              <p className="text-sm text-gray-500 mt-1">{pkg.description}</p>
                            )}
                          </div>
                          <Button variant="outline" size="sm">
                            Sélectionner
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {currentStep === 'configure' && selectedPackage && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Configuration du déploiement</CardTitle>
                <CardDescription>
                  Personnalisez les options de déploiement pour {selectedPackage.name}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Nom de l'application</Label>
                  <Input
                    value={deploymentConfig.displayName}
                    onChange={(e) => setDeploymentConfig(prev => ({ ...prev, displayName: e.target.value }))}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Éditeur</Label>
                  <Input
                    value={deploymentConfig.publisher}
                    onChange={(e) => setDeploymentConfig(prev => ({ ...prev, publisher: e.target.value }))}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Description</Label>
                  <textarea
                    className="w-full p-2 border rounded-md"
                    rows={3}
                    value={deploymentConfig.description}
                    onChange={(e) => setDeploymentConfig(prev => ({ ...prev, description: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Groupes cibles</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner les groupes" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all-users">Tous les utilisateurs</SelectItem>
                      <SelectItem value="all-devices">Tous les appareils</SelectItem>
                      <SelectItem value="test-group">Groupe de test</SelectItem>
                      <SelectItem value="pilot-group">Groupe pilote</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-3">
                  <Label>Options de déploiement</Label>
                  <div className="space-y-2">
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={deploymentConfig.installAsSystem}
                        onChange={(e) => setDeploymentConfig(prev => ({ ...prev, installAsSystem: e.target.checked }))}
                      />
                      <span className="text-sm">Installer en tant que système</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={deploymentConfig.silentInstall}
                        onChange={(e) => setDeploymentConfig(prev => ({ ...prev, silentInstall: e.target.checked }))}
                      />
                      <span className="text-sm">Installation silencieuse</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={deploymentConfig.autoUpdate}
                        onChange={(e) => setDeploymentConfig(prev => ({ ...prev, autoUpdate: e.target.checked }))}
                      />
                      <span className="text-sm">Mises à jour automatiques</span>
                    </label>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Script PowerShell généré</CardTitle>
                <CardDescription>
                  Script d'installation pour Intune
                </CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="bg-gray-900 text-green-400 p-4 rounded-md text-xs overflow-x-auto">
                  {generatePowerShellScript()}
                </pre>
              </CardContent>
            </Card>
          </div>
        )}

        {currentStep === 'deploy' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Résumé du déploiement</CardTitle>
                <CardDescription>
                  Vérifiez les informations avant le déploiement
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <Label>Application</Label>
                    <p className="font-medium">{deploymentConfig.displayName}</p>
                  </div>
                  <div>
                    <Label>Package ID</Label>
                    <p className="font-mono text-sm">{deploymentConfig.appId}</p>
                  </div>
                  <div>
                    <Label>Source</Label>
                    <p className="font-medium">{selectedPackage?.source}</p>
                  </div>
                  <div>
                    <Label>Version</Label>
                    <p className="font-medium">{deploymentConfig.version}</p>
                  </div>
                  <div>
                    <Label>Commande d'installation</Label>
                    <p className="font-mono text-sm bg-gray-100 p-2 rounded">
                      {deploymentConfig.installCommand}
                    </p>
                  </div>
                </div>
                
                <div className="mt-6 flex space-x-2">
                  <Button variant="outline" onClick={() => setCurrentStep('configure')}>
                    Retour
                  </Button>
                  <Button 
                    onClick={handleDeploy} 
                    disabled={isDeploying}
                    className="flex-1"
                  >
                    {isDeploying ? 'Déploiement en cours...' : 'Déployer sur Intune'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Logs de déploiement</CardTitle>
                <CardDescription>
                  Suivez la progression en temps réel
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="bg-gray-900 text-green-400 p-4 rounded-md h-64 overflow-y-auto font-mono text-sm">
                  {deploymentLogs.map((log, index) => (
                    <div key={index}>{log}</div>
                  ))}
                </div>
                {isDeploying && (
                  <div className="mt-4">
                    <div className="flex justify-between text-sm mb-1">
                      <span>Progression</span>
                      <span>{Math.round(deploymentProgress)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${deploymentProgress}%` }}
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {currentStep === 'success' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2 text-green-600">
                <Check className="h-6 w-6" />
                <span>Déploiement réussi !</span>
              </CardTitle>
              <CardDescription>
                L'application a été déployée avec succès sur Intune
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="bg-green-50 p-4 rounded-lg">
                  <h3 className="font-medium text-green-900 mb-2">✅ Opérations terminées</h3>
                  <ul className="text-sm text-green-800 space-y-1">
                    <li>• Package créé et uploadé</li>
                    <li>• Script PowerShell généré</li>
                    <li>• Règles de détection configurées</li>
                    <li>• Déploiement vers les groupes effectué</li>
                  </ul>
                </div>
                
                <div className="flex space-x-2">
                  <Button variant="outline" onClick={() => {
                    setCurrentStep('search');
                    setSearchQuery('');
                    setSearchResults([]);
                    setSelectedPackage(null);
                    setDeploymentLogs([]);
                  }}>
                    Nouveau déploiement
                  </Button>
                  <Button onClick={() => window.open('https://endpoint.microsoft.com', '_blank')}>
                    Voir dans Intune
                  </Button>
                </div>
              </CardContent>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}