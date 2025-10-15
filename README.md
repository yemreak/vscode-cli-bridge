# VSCode CLI

Control VSCode from terminal. Built for AI agents.

## Installation

```bash
npm install -g @yemreak/vscode-cli
```

Or with Bun:
```bash
bun install -g @yemreak/vscode-cli
```

## Requirements

**ClarityOS Bridge v0.1.0+**: Install from [OpenVSX](https://open-vsx.org/extension/yemreak/clarityos-bridge)

```bash
code --install-extension yemreak.clarityos-bridge
```

ClarityOS Bridge runs a TCP server (port 9485) that this CLI connects to.

## For Your AI Agent

Tell your AI assistant to use these commands to control VSCode:

```bash
# Get help
vscode --help

# Execute code in VSCode context
vscode eval "return vscode.window.activeTextEditor?.document.fileName"

# Get system status
vscode status

# Read output logs
vscode output 50

# Open webview
vscode webview conversation

# Get diagnostics
vscode diagnostics

# Rename symbol
vscode rename oldName newName

# Register config
vscode registerConfig statusbar ~/config.ts
```

## Available Commands

| Command | Description |
|---------|-------------|
| `vscode eval <code>` | Execute JavaScript with VSCode API access |
| `vscode status` | System status (terminals, editor, workspace) |
| `vscode output [lines]` | Read output panel logs |
| `vscode diagnostics` | Get all diagnostics (errors, warnings) |
| `vscode rename <old> <new>` | Rename symbol across project |
| `vscode webview <name>` | Open HTML panel |
| `vscode registerConfig <name> <path>` | Register dynamic config |
| `vscode unregisterConfig <name>` | Unregister config |
| `vscode listConfigs` | List registered configs |
| `vscode subscribe <url>` | Subscribe to events (webhook) |
| `vscode unsubscribe <url>` | Unsubscribe from events |
| `vscode listSubscribers` | List subscribers |
| `vscode restartExtension` | Restart extension host |

## Why?

Enables AI agents to:
- Execute code in VSCode context
- Read editor state and diagnostics
- Control editor from terminal
- Open and manage panels
- Access full VSCode API

## How It Works

```
Terminal → vscode CLI → TCP (port 9485) → ClarityOS Bridge → VSCode API
```

1. ClarityOS Bridge runs TCP server
2. CLI sends JSON-RPC requests
3. Extension executes in VSCode context
4. Results returned to terminal

## Examples

**Get active file**:
```bash
vscode eval "return vscode.window.activeTextEditor?.document.fileName"
```

**Execute with logging**:
```bash
vscode eval "console.log('test'); return 'done'"
```

**Check diagnostics**:
```bash
vscode diagnostics
```

**Read output**:
```bash
vscode output 100
```

## License

Apache-2.0
