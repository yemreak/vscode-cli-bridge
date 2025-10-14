#!/usr/bin/env bun

import { AVAILABLE_METHODS, buildVSCodeRequest, sendVSCodeRequest } from './src/client'

const [command, ...args] = process.argv.slice(2)

if (!command || command === '--help' || command === '-h') {
	console.log(`Usage: vscode <command> [OPTIONS]

BEHAVIOURS:
  # Code diagnostics:
  vscode diagnostics
  → [{"file":"src/main.ts","line":42,"severity":"Error",...}]
  vscode rename askClaude askClaudeCode
  → {"renamed":true,"files":2}

  # Editor status:
  vscode status
  vscode eval "return vscode.window.activeTextEditor?.document.fileName"
  → "/Users/user/project/file.ts"

  # Extension control:
  vscode restartExtension
  vscode webview conversation

  # Config management:
  vscode registerConfig statusbar ~/my-statusbar.ts
  vscode listConfigs
  vscode unregisterConfig statusbar

  # Event subscriptions:
  vscode subscribe http://localhost:8765/webhook
  vscode listSubscribers
  vscode unsubscribe http://localhost:8765/webhook

  # Output logs (read output panel):
  vscode output           # Last 50 lines
  vscode output 100       # Last 100 lines

  # Eval with console.log:
  vscode eval "console.log('test'); return 'done'"
  → logs appear in ClarityOS Bridge output panel`)
	process.exit(2)
}

// Diagnostics → eval wrapper (CLI-only command)
if (command === 'diagnostics') {
	const diagnosticsCode = `
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
	const request = buildVSCodeRequest({ method: 'eval', args: [diagnosticsCode] })

	try {
		const result = await sendVSCodeRequest({ request })

		if (result.ok) {
			console.log(JSON.stringify(result.result, null, 2))
		} else {
			console.error('Error:', result.error)
			process.exit(1)
		}
	} catch (error) {
		console.error('Error:', error)
		process.exit(1)
	}
	process.exit(0)
}

// Rename → eval wrapper (CLI-only command)
if (command === 'rename') {
	if (!args[0] || !args[1]) {
		throw new Error('Usage: vscode rename <old-name> <new-name>')
	}

	const [oldName, newName] = args

	const renameCode = `
		// Find all TypeScript/JavaScript files
		const files = await vscode.workspace.findFiles('**/*.{ts,tsx,js,jsx}', '**/node_modules/**');

		let foundUri = null;
		let foundPosition = null;

		// Text search + definition check
		for (const uri of files) {
			const document = await vscode.workspace.openTextDocument(uri);
			const text = document.getText();

			// Search for symbol name with word boundaries
			const regex = new RegExp('\\\\b${oldName}\\\\b', 'g');
			let match;

			while ((match = regex.exec(text)) !== null) {
				const position = document.positionAt(match.index);

				// Check if this is a definition (not just a reference)
				const definitions = await vscode.commands.executeCommand(
					'vscode.executeDefinitionProvider',
					uri,
					position
				);

				// Definition points to itself → this IS the definition
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

		if (!foundUri) {
			return { error: 'Symbol not found', oldName: '${oldName}' };
		}

		const position = foundPosition;

		const edits = await vscode.commands.executeCommand(
			'vscode.executeDocumentRenameProvider',
			foundUri,
			position,
			'${newName}'
		);

		if (!edits) {
			return { error: 'No edits' };
		}

		const result = await vscode.workspace.applyEdit(edits);
		await vscode.workspace.saveAll();

		return { renamed: true, from: '${oldName}', to: '${newName}', applied: result, files: edits.size };
	`

	const request = buildVSCodeRequest({ method: 'eval', args: [renameCode] })

	try {
		const result = await sendVSCodeRequest({ request })

		if (result.ok) {
			console.log(JSON.stringify(result.result, null, 2))
		} else {
			console.error('Error:', result.error)
			process.exit(1)
		}
	} catch (error) {
		console.error('Error:', error)
		process.exit(1)
	}
	process.exit(0)
}

// Map getOutput to output command
if (command === 'output') {
	const lines = args[0] ? parseInt(args[0]) : 50
	const request = buildVSCodeRequest({ method: 'getOutput', args: [lines.toString()] })

	try {
		const result = await sendVSCodeRequest({ request })

		if (result.ok) {
			const output = (result.result as any).output || []
			output.forEach((line: string) => console.log(line))
		} else {
			console.error('Error:', result.error)
			process.exit(1)
		}
	} catch (error) {
		console.error('Error:', error)
		process.exit(1)
	}
	process.exit(0)
}

if (!AVAILABLE_METHODS.includes(command as any)) {
	throw new Error(`Unknown command: ${command}\nAvailable: ${AVAILABLE_METHODS.join(', ')}, diagnostics, rename, output`)
}

if (command === 'eval' && (!args[0] || args[0] === '--help' || args[0] === 'help')) {
	console.log(`vscode eval - Execute JavaScript code in VS Code context (see 'vscode --help')`)
	process.exit(0)
}

if (command === 'webview' && !args[0]) {
	throw new Error('Webview name or path required')
}

if (command === 'registerConfig' && (!args[0] || !args[1])) {
	throw new Error('Usage: vscode registerConfig <name> <filePath>')
}

if (command === 'unregisterConfig' && !args[0]) {
	throw new Error('Usage: vscode unregisterConfig <name>')
}

if (command === 'subscribe' && !args[0]) {
	throw new Error('Usage: vscode subscribe <url>')
}

if (command === 'unsubscribe' && !args[0]) {
	throw new Error('Usage: vscode unsubscribe <url>')
}

const request = buildVSCodeRequest({ method: command, args })

try {
	const result = await sendVSCodeRequest({ request })

	if (result.ok) {
		console.log(JSON.stringify(result.result, null, 2))
	} else {
		console.error('Error:', result.error)
		process.exit(1)
	}
} catch (error) {
	console.error('Error:', error)
	process.exit(1)
}
