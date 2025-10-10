# Publishing to OpenVSX

## Prerequisites

1. OpenVSX account: https://open-vsx.org/
2. Personal Access Token (PAT): https://open-vsx.org/user-settings/tokens

## Steps

### 1. Install ovsx CLI

```bash
npm install -g ovsx
# or
bun install -g ovsx
```

### 2. Get Access Token

1. Go to https://open-vsx.org/user-settings/tokens
2. Create new token (name: "CLI Bridge Publisher")
3. Copy the token

### 3. Publish Extension

```bash
# Set token as environment variable
export OVSX_PAT=<your-token>

# Navigate to extension directory
cd /Users/yemreak/Projects/vscode-cli-bridge/extension

# Build and package
bunx tsc -p ./
bunx vsce package

# Publish to OpenVSX
ovsx publish cli-bridge-0.1.6.vsix -p $OVSX_PAT
```

### 4. Verify

Visit: https://open-vsx.org/extension/yemreak/cli-bridge

## Update Process

To publish new version:

1. Update version in `package.json`
2. Update `CHANGELOG.md`
3. Build, package, publish:

```bash
bunx tsc -p ./
bunx vsce package
ovsx publish cli-bridge-<new-version>.vsix -p $OVSX_PAT
```

## Automated Script

```bash
#!/usr/bin/env bash
# publish.sh

VERSION=$(cat package.json | grep version | head -1 | awk -F: '{ print $2 }' | sed 's/[",]//g' | tr -d '[[:space:]]')

bunx tsc -p ./
bunx vsce package
ovsx publish cli-bridge-${VERSION}.vsix -p $OVSX_PAT

echo "✓ Published cli-bridge v${VERSION} to OpenVSX"
```

## First Time Setup

```bash
# Install ovsx
bun install -g ovsx

# Create PAT at https://open-vsx.org/user-settings/tokens
# Add to shell profile (~/.zshrc or ~/.bashrc)
export OVSX_PAT="your-token-here"

# Reload shell
source ~/.zshrc
```

## Install Published Extension

After publishing:

```bash
# Users can install via OpenVSX
code --install-extension yemreak.cli-bridge

# Or via CLI
ovsx get yemreak.cli-bridge
```
