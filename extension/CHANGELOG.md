# Changelog

## Current State (v0.1.5)

**Config Registry System (Hammerspoon-like)**
- Register/unregister TypeScript configs
- Hot reload on file change
- Persistent registry (.vscode/.cli-bridge-configs.json)
- No extension restart needed

**Status Bar**
- Shows CLI Bridge active status
- Uptime in tooltip (updates every 30s)

**CLI Commands**
```bash
vscode registerConfig name path    # Register config
vscode unregisterConfig name       # Unregister config
vscode listConfigs                 # List all configs
vscode status                      # Extension status
vscode eval "code"                 # Execute JavaScript
vscode webview name                # Open webview
vscode restartExtension            # Restart extension
```

**Generic Webview System**
- Any HTML file → VSCode panel
- Auto-reload on HTML/data changes
- manifest.json support for custom watch files
- Configurable default path (settings)

**CLI Commands**
```bash
vscode status              # Extension status
vscode eval "code"         # Execute JavaScript (require supported)
vscode webview name        # Open webview
vscode restartExtension    # Restart extension host (for development)
```

**Webview Structure**
```
src/interface/web/
  myview/
    index.html       # Required
    manifest.json    # Optional (watch files config)
    data.json        # Optional (any data file)
    styles/          # Optional (user's structure)
    scripts/         # Optional (user's structure)
```

Watch files via manifest.json only. No fallback.

**Features**
- HTML auto-reload on file change
- Data file watcher (FileSystemWatcher)
- Multiple watch files via manifest.json
- Custom path support (relative/absolute)
- Browser extension pattern (manifest.json)
- No emojis in UI
- Fresh scan on every open (no cache)

---

## Version History

### v0.1.6 (2025-10-06)
- Hot reload: CSS ve JS değişikliklerinde webview otomatik yenileniyor
- HTML path support: `vscode webview components/index.html` çalışıyor
- localResourceRoots: parent path eklendi (sibling component imports için)
- setupAssetWatchers(): **/*.css ve **/*.js watchers eklendi
- reloadWebview(): console.log debug mesajları
- Path detection: .html uzantılı path'ler için parent directory viewPath

### v0.1.5 (2025-10-05)
- Config registry system (Hammerspoon pattern)
- registerConfig/unregisterConfig/listConfigs commands
- Hot reload configs on file change
- Status bar with uptime tooltip
- Removed hooks.ts (config-based now)

### v0.1.4 (2025-10-04)
- require() support in eval
- Fresh folder scan (no cache)
- Removed emojis from UI
- Input box with available views placeholder

### v0.1.3 (2025-10-04)
- manifest.json support for custom watch files
- HTML auto-reload
- Configurable default path (settings: cli-bridge.webviewPath)
- Multiple file watcher support
- openView → webview (VSCode terminology)
- Output panel silent on startup

### v0.1.2 (2025-10-03)
- Generic webview infrastructure
- views/ pattern → any HTML + data.json
- FileWatcher for auto-sync
- data.json optional
- Custom path detection (relative, absolute, slash-based)

### v0.1.1 (2025-10-03)
- Initial webview support
- Basic eval command
- Status command
- Extension restart command

### v0.1.0 (2025-10-02)
- JSON-RPC bridge (port 9485)
- Terminal control
- Basic VSCode API access
