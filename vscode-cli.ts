#!/usr/bin/env bun
/**
 * VSCode CLI - Control VSCode from terminal
 *
 * Requires: CLI Bridge extension (yemreak.cli-bridge)
 * Install: https://open-vsx.org/extension/yemreak/cli-bridge
 */

import * as net from 'net'

// Types
type JsonRpcRequest = { method: string; params: any }
type JsonRpcResponse = { ok: boolean; result?: any; error?: string }

const [command, ...args] = process.argv.slice(2)
const PORT = 9485

// Help
if (!command || command === '--help' || command === '-h') {
	console.log(`Usage: vscode <command> [OPTIONS]

COMMANDS:
  # Check errors in code:
  vscode diagnostics
  → [{"file":"src/main.ts","line":42,"severity":"Error",...}]

  # Rename symbol across project:
  vscode rename oldName newName
  → {"renamed":true,"files":2}

  # Check editor status:
  vscode status
  → {"active":"file.ts","workspace":"/path",...}

  # Execute code in VSCode context:
  vscode eval "return vscode.window.activeTextEditor?.document.fileName"
  → "/Users/user/project/file.ts"

  # Restart extension:
  vscode restartExtension

  # Open webview:
  vscode webview conversation

REQUIREMENTS:
  - CLI Bridge extension must be installed
  - Install: https://open-vsx.org/extension/yemreak/cli-bridge
  - Port: ${PORT} (default)`)
	process.exit(2)
}

// Communication
function sendRequest(request: JsonRpcRequest): Promise<JsonRpcResponse> {
	return new Promise((resolve, reject) => {
		const client = net.createConnection({ port: PORT }, () => {
			client.write(JSON.stringify(request))
		})

		let buffer = ''
		client.on('data', data => { buffer += data.toString() })
		client.on('end', () => {
			try { resolve(JSON.parse(buffer)) }
			catch (e) { reject(new Error('Invalid JSON response')) }
		})
		client.on('error', reject)
	})
}

// Commands
const AVAILABLE_METHODS = ['status', 'eval', 'restartExtension', 'webview', 'registerConfig', 'unregisterConfig', 'listConfigs', 'subscribe', 'unsubscribe', 'listSubscribers']

// Diagnostics (wrapper)
if (command === 'diagnostics') {
	const code = `
		const allDiagnostics = vscode.languages.getDiagnostics()
		return allDiagnostics.flatMap(([uri, diagnostics]) => {
			return diagnostics.map(diagnostic => ({
				file: uri.path,
				line: diagnostic.range.start.line + 1,
				column: diagnostic.range.start.character + 1,
				severity: ['Error', 'Warning', 'Information', 'Hint'][diagnostic.severity] || 'Unknown',
				message: diagnostic.message
			}))
		})
	`
	const result = await sendRequest({ method: 'eval', params: { code } })
	console.log(result.ok ? JSON.stringify(result.result, null, 2) : `Error: ${result.error}`)
	process.exit(result.ok ? 0 : 1)
}

// Rename (wrapper)
if (command === 'rename') {
	if (!args[0] || !args[1]) throw new Error('Usage: vscode rename <old-name> <new-name>')

	const [oldName, newName] = args
	const code = `
		const files = await vscode.workspace.findFiles('**/*.{ts,tsx,js,jsx}', '**/node_modules/**');
		let foundUri = null;
		let foundPosition = null;

		for (const uri of files) {
			const document = await vscode.workspace.openTextDocument(uri);
			const text = document.getText();
			const regex = new RegExp('\\\\b${oldName}\\\\b', 'g');
			let match;

			while ((match = regex.exec(text)) !== null) {
				const position = document.positionAt(match.index);
				const definitions = await vscode.commands.executeCommand(
					'vscode.executeDefinitionProvider',
					uri,
					position
				);

				if (definitions && definitions.length > 0) {
					const def = definitions[0];
					if (def.uri.path === uri.path && def.range.contains(position)) {
						foundUri = uri;
						foundPosition = position;
						break;
					}
				}
			}
			if (foundUri) break;
		}

		if (!foundUri) return { error: 'Symbol not found', oldName: '${oldName}' };

		const edits = await vscode.commands.executeCommand(
			'vscode.executeDocumentRenameProvider',
			foundUri,
			foundPosition,
			'${newName}'
		);

		if (!edits) return { error: 'No edits' };

		const result = await vscode.workspace.applyEdit(edits);
		await vscode.workspace.saveAll();

		return { renamed: true, from: '${oldName}', to: '${newName}', applied: result, files: edits.size };
	`

	const result = await sendRequest({ method: 'eval', params: { code } })
	console.log(result.ok ? JSON.stringify(result.result, null, 2) : `Error: ${result.error}`)
	process.exit(result.ok ? 0 : 1)
}

// Build request
if (!AVAILABLE_METHODS.includes(command)) {
	throw new Error(`Unknown command: ${command}\nAvailable: ${AVAILABLE_METHODS.join(', ')}, diagnostics, rename`)
}

function buildRequest(method: string, args: string[]): JsonRpcRequest {
	switch (method) {
		case 'status': return { method: 'status', params: {} }
		case 'eval': return { method: 'eval', params: { code: args[0]! } }
		case 'restartExtension': return { method: 'restartExtension', params: {} }
		case 'webview': return { method: 'webview', params: { viewName: args[0]!, title: args[1], customPath: args[2] } }
		case 'registerConfig': return { method: 'registerConfig', params: { name: args[0]!, filePath: args[1]! } }
		case 'unregisterConfig': return { method: 'unregisterConfig', params: { name: args[0]! } }
		case 'listConfigs': return { method: 'listConfigs', params: {} }
		case 'subscribe': return { method: 'subscribe', params: { url: args[0]! } }
		case 'unsubscribe': return { method: 'unsubscribe', params: { url: args[0]! } }
		case 'listSubscribers': return { method: 'listSubscribers', params: {} }
		default: throw new Error(`Unhandled: ${method}`)
	}
}

const request = buildRequest(command, args)
const result = await sendRequest(request)
console.log(result.ok ? JSON.stringify(result.result, null, 2) : `Error: ${result.error}`)
process.exit(result.ok ? 0 : 1)
