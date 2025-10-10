#!/usr/bin/env bash
# Publish CLI Bridge extension to OpenVSX

set -e

# Check OVSX_PAT
if [ -z "$OVSX_PAT" ]; then
    echo "Error: OVSX_PAT environment variable not set"
    echo "Get token from: https://open-vsx.org/user-settings/tokens"
    exit 1
fi

# Get version from package.json
VERSION=$(cat package.json | grep version | head -1 | awk -F: '{ print $2 }' | sed 's/[",]//g' | tr -d '[[:space:]]')

echo "Publishing CLI Bridge v${VERSION}..."

# Build
echo "Building..."
bunx tsc -p ./

# Package
echo "Packaging..."
bunx vsce package

# Publish
echo "Publishing to OpenVSX..."
ovsx publish cli-bridge-${VERSION}.vsix -p $OVSX_PAT

echo "✓ Published cli-bridge v${VERSION} to OpenVSX"
echo "View at: https://open-vsx.org/extension/yemreak/cli-bridge"
