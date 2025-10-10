# CLI Bridge

Control VSCode from terminal.

## Core Features

**1. Execute JavaScript in VSCode**
```bash
vscode eval "return this.vscode.window.activeTextEditor?.document.fileName"
```

Access full VSCode API. `require()` supported.

**2. HTML → VSCode Panel**
```bash
vscode webview conversation
```

Any HTML file becomes a VSCode panel. Auto-reloads on change.

**3. Config Registry (Hammerspoon-like)**
```bash
vscode registerConfig statusbar ~/configs/statusbar.ts
vscode listConfigs
vscode unregisterConfig statusbar
```

Register TypeScript configs. Auto-reload on file change.

## Setup

```bash
bun run reinstall
```

## Webview Structure

```
src/interface/web/
  myview/
    index.html       # Required
    manifest.json    # Optional - watch files
    data.json        # Optional - auto-sync
```

**manifest.json** (optional):
```json
{
  "name": "My View",
  "version": "1.0.0",
  "watch": ["state.json", "metrics.json"]
}
```

No manifest → no file watching.

## Configuration

Settings → "CLI Bridge: Webview Path"
Default: `src/interface/web`

## What You Can Build

- Dashboards with live data
- Algorithm visualizations
- Custom admin panels
- Any web UI inside VSCode

Auto-reload. No build step.

## Commands

```bash
vscode status                        # Extension info
vscode eval "code"                   # Execute JavaScript
vscode webview name                  # Open HTML panel
vscode restartExtension              # Restart extension
vscode registerConfig name path      # Register config
vscode unregisterConfig name         # Unregister config
vscode listConfigs                   # List all configs
```

## Config System

**Pattern:** Hammerspoon-like config registry

```typescript
// statusbar.ts
export function activate(params: {
	vscode: typeof import('vscode')
	context: any
	startTime: number
}) {
	const statusBar = params.vscode.window.createStatusBarItem(...)
	statusBar.show()

	return {
		dispose: () => statusBar.dispose()
	}
}
```

**Usage:**
```bash
vscode registerConfig statusbar ~/configs/statusbar.ts
```

File changes → Auto reload. No extension restart.

---

Full VSCode API + HTML = Build anything.
