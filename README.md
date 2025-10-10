# VSCode CLI Bridge

Control VSCode from terminal - inline eval, diagnostics, rename, and more.

## Features

- **Inline Eval**: Execute JavaScript/TypeScript code directly in VSCode context
- **Diagnostics**: Get errors/warnings from your codebase
- **Rename**: Refactor symbols across your project
- **Status**: Check editor state
- **Fast Feedback**: No extension reload needed - instant test loop

## Quick Start

### 1. Install Extension

Install the CLI Bridge extension from OpenVSX:

```bash
# Install from OpenVSX
code --install-extension yemreak.cli-bridge

# Or from VSIX file
code --install-extension cli-bridge-*.vsix
```

### 2. Install CLI Tool

```bash
# Using npm (recommended)
npm install -g vscode-cli-bridge

# Or clone and link
git clone https://github.com/yemreak/vscode-cli-bridge
cd vscode-cli-bridge
chmod +x vscode-cli.ts
ln -sf $(pwd)/vscode-cli.ts ~/.local/bin/vscode-cli
```

### 3. Use It

```bash
# Check diagnostics
vscode-cli diagnostics

# Rename symbol
vscode-cli rename oldName newName

# Execute code
vscode-cli eval "return vscode.window.activeTextEditor?.document.fileName"

# Check status
vscode-cli status
```

## Use Cases

### AI-Powered Development

AI agents can debug extensions without reload:

```bash
# AI writes code, tests immediately
vscode-cli eval "$(cat <<'EOF'
const statusBar = vscode.window.createStatusBarItem()
statusBar.text = "Next: waiting for request"
statusBar.show()
EOF
)"
```

**Pattern**: Write → Eval → Test → Fix → Repeat (fast feedback loop)

### Multi-Agent Workflows

Track multiple agents in status bar:

```bash
# Agent 1 - left lane
vscode-cli eval "const sb1 = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left); sb1.text = 'Agent 1: coding'; sb1.show()"

# Agent 2 - right lane
vscode-cli eval "const sb2 = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right); sb2.text = 'Agent 2: testing'; sb2.show()"
```

### Quick Refactoring

Rename symbols without manual search:

```bash
vscode-cli rename askClaude askClaudeCode
# → {"renamed":true,"files":15}
```

## Architecture

```
Terminal (CLI)  →  TCP (port 9485)  →  VSCode Extension
     ↓                                        ↓
JSON-RPC Request                       Eval in VSCode API
     ↓                                        ↓
JSON Response    ←                      Result/Error
```

**Pattern**: CLI Bridge - platform control via eval interface

Same pattern works for:
- Chrome: `chrome-cdp eval`
- Hammerspoon: `hammerspoon eval`
- MacOS automation

## Commands

| Command | Description | Example |
|---------|-------------|---------|
| `vscode-cli eval <code>` | Execute code in VSCode | `vscode-cli eval "return vscode.version"` |
| `vscode-cli diagnostics` | Get all errors/warnings | `vscode-cli diagnostics` |
| `vscode-cli rename <old> <new>` | Rename symbol | `vscode-cli rename oldName newName` |
| `vscode-cli status` | Check editor state | `vscode-cli status` |
| `vscode-cli restartExtension` | Restart CLI Bridge | `vscode-cli restartExtension` |

## Examples

### Status Bar Control

```bash
vscode-cli eval "$(cat <<'EOF'
const statusBar = vscode.window.createStatusBarItem()
statusBar.text = "🔥 Custom Status"
statusBar.show()
EOF
)"
```

### Open Terminal

```bash
vscode-cli eval "$(cat <<'EOF'
const terminal = vscode.window.createTerminal('AI Terminal')
terminal.show()
terminal.sendText('echo "Hello from AI"')
EOF
)"
```

### Get Active File

```bash
vscode-cli eval "return vscode.window.activeTextEditor?.document.fileName"
# → "/Users/user/project/file.ts"
```

## Development

Extension development is faster with inline eval:

**Traditional**: Code → Package → Install → Test → Uninstall → Repeat (slow)

**With CLI Bridge**: Code → Eval → Test → Fix (fast)

```bash
# Write code
cat > test.ts <<'EOF'
const statusBar = vscode.window.createStatusBarItem()
statusBar.text = "Testing..."
statusBar.show()
EOF

# Test immediately
vscode-cli eval "$(cat test.ts)"

# Fix and retry (no reload needed)
```

## Requirements

- Bun runtime
- VSCode or Cursor
- CLI Bridge extension

## License

Apache-2.0
