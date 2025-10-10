import * as vscode from 'vscode'
import { BridgeServer } from './cli-bridge'
import { WebviewManager } from './webview-manager'
import * as path from 'path'
import * as fs from 'fs'

// Terminal start times tracking
const terminalStartTimes = new Map<vscode.Terminal, number>()

// Config state
const activeConfigs = new Map<string, { dispose: () => void; watcher: any }>()

export function activate(context: vscode.ExtensionContext) {
	// Track new terminals
	vscode.window.onDidOpenTerminal(terminal => {
		terminalStartTimes.set(terminal, Date.now())
	})

	// Clean up closed terminals
	vscode.window.onDidCloseTerminal(terminal => {
		terminalStartTimes.delete(terminal)
	})

	// Webview manager başlat
	const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || ''
	const webviewManager = new WebviewManager({
		context,
		workspaceRoot
	})

	// Bridge server başlat ve context, terminalStartTimes + webviewManager'ı geç
	const bridge = new BridgeServer(vscode, context, terminalStartTimes, webviewManager)
	bridge.start()

	// Event broadcaster: Terminal değiştiğinde subscribers'a broadcast et
	vscode.window.onDidChangeActiveTerminal(async terminal => {
		if (!terminal) return

		const processId = await terminal.processId
		bridge.broadcast({
			event: 'terminal-changed',
			timestamp: Date.now(),
			data: {
				name: terminal.name,
				processId: processId
			}
		})
	})

	// Status bar
	const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100)
	statusBar.text = '$(plug) CLI Bridge'

	function updateStatusBar() {
		const uptimeSeconds = Math.floor((Date.now() - bridge.getStartTime()) / 1000)
		const hours = Math.floor(uptimeSeconds / 3600)
		const minutes = Math.floor((uptimeSeconds % 3600) / 60)
		const uptimeFormatted = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`

		statusBar.tooltip = `CLI Bridge running on port 9485\nUptime: ${uptimeFormatted}`
	}

	updateStatusBar()
	const interval = setInterval(updateStatusBar, 30000)
	context.subscriptions.push({ dispose: () => clearInterval(interval) })

	statusBar.show()
	context.subscriptions.push(statusBar)

	// Config registry
	const vscodeDir = path.join(workspaceRoot, '.vscode')
	if (!fs.existsSync(vscodeDir)) {
		fs.mkdirSync(vscodeDir, { recursive: true })
	}

	const configRegistryFile = path.join(vscodeDir, '.cli-bridge-configs.json')

	function loadConfigRegistry(): Record<string, string> {
		try {
			return JSON.parse(fs.readFileSync(configRegistryFile, 'utf-8'))
		} catch {
			return {}
		}
	}

	function saveConfigRegistry(configs: Record<string, string>) {
		fs.writeFileSync(configRegistryFile, JSON.stringify(configs, null, 2))
	}

	async function loadConfig(params: { name: string; filePath: string }) {
		try {
			// Dispose old config
			if (activeConfigs.has(params.name)) {
				const old = activeConfigs.get(params.name)!
				old.dispose()
				old.watcher.close()
				activeConfigs.delete(params.name)
			}

			// Clear require cache
			delete require.cache[params.filePath]

			// Load new config
			const config = require(params.filePath)
			if (config.activate) {
				const instance = config.activate({
					vscode,
					context,
					startTime: bridge.getStartTime()
				})

				// Watch config file
				const watcher = fs.watch(params.filePath, () => {
					console.log(`Config '${params.name}' changed, reloading...`)
					loadConfig(params)
				})

				activeConfigs.set(params.name, { dispose: instance.dispose, watcher })
				console.log(`Config '${params.name}' loaded from ${params.filePath}`)
			}
		} catch (error) {
			console.error(`Failed to load config '${params.name}':`, error)
		}
	}

	// Load all registered configs on startup
	const registry = loadConfigRegistry()
	for (const [name, filePath] of Object.entries(registry)) {
		if (fs.existsSync(filePath)) {
			loadConfig({ name, filePath })
		}
	}

	// Bridge'e config yönetim fonksiyonlarını geç
	bridge.setConfigHandlers({
		register: (params: { name: string; filePath: string }) => {
			const registry = loadConfigRegistry()
			registry[params.name] = params.filePath
			saveConfigRegistry(registry)
			loadConfig(params)
			return { success: true, message: `Config '${params.name}' registered` }
		},
		unregister: (params: { name: string }) => {
			const registry = loadConfigRegistry()
			if (!registry[params.name]) {
				return { error: `Config '${params.name}' not found` }
			}

			// Dispose and remove
			if (activeConfigs.has(params.name)) {
				const config = activeConfigs.get(params.name)!
				config.dispose()
				config.watcher.close()
				activeConfigs.delete(params.name)
			}

			delete registry[params.name]
			saveConfigRegistry(registry)
			return { success: true, message: `Config '${params.name}' unregistered` }
		},
		list: () => {
			const registry = loadConfigRegistry()
			return {
				configs: Object.entries(registry).map(([name, filePath]) => ({
					name,
					filePath,
					active: activeConfigs.has(name)
				}))
			}
		}
	})

	// Komutları kaydet
	context.subscriptions.push(
		vscode.commands.registerCommand('cli-bridge.status', async () => {
			// Get full status from bridge
			const terminals = await Promise.all(
				vscode.window.terminals.map(async terminal => ({
					name: terminal.name,
					processId: await terminal.processId,
					state: terminal.state,
					uptime: terminalStartTimes.has(terminal) ? Math.floor((Date.now() - terminalStartTimes.get(terminal)!) / 1000) : null
				}))
			)

			const activeEditor = vscode.window.activeTextEditor
			const workspace = vscode.workspace.workspaceFolders

			const status = {
				terminals: {
					count: terminals.length,
					active: vscode.window.activeTerminal?.name || 'None',
					list: terminals
				},
				editor: activeEditor
					? {
							file: activeEditor.document.fileName.split('/').pop(),
							language: activeEditor.document.languageId,
							lines: activeEditor.document.lineCount,
							cursor: `${activeEditor.selection.active.line + 1}:${activeEditor.selection.active.character + 1}`
						}
					: null,
				workspace: workspace
					? {
							folders: workspace.map(f => f.name).join(', '),
							openFiles: vscode.window.visibleTextEditors.length
						}
					: null,
				bridge: {
					port: 9485,
					status: 'Running'
				}
			}

			// Create output channel for status
			const output = vscode.window.createOutputChannel('CLI Bridge Status')
			output.clear()
			output.appendLine('=== CLI Bridge Full Status ===\n')
			output.appendLine(JSON.stringify(status, null, 2))
			output.show()
		}),

		vscode.commands.registerCommand('cli-bridge.showTerminals', async () => {
			const terminals = vscode.window.terminals
			const activeTerminal = vscode.window.activeTerminal

			const info = terminals.map(async t => {
				const pid = await t.processId
				const uptime = terminalStartTimes.has(t) ? Math.floor((Date.now() - terminalStartTimes.get(t)!) / 1000) : null

				return `${t === activeTerminal ? '➤' : ' '} ${t.name} (PID: ${pid})${uptime ? ` - ${uptime}s` : ''}`
			})

			const result = await Promise.all(info)
			vscode.window.showQuickPick(result, {
				placeHolder: `${terminals.length} terminal(s) open`,
				canPickMany: false
			})
		}),

		vscode.commands.registerCommand('cli-bridge.showWorkspace', () => {
			const workspace = vscode.workspace.workspaceFolders
			const editors = vscode.window.visibleTextEditors

			vscode.window.showInformationMessage(
				`Workspace: ${workspace?.map(f => f.name).join(', ') || 'No folder'} | ` +
					`Open files: ${editors.length} | ` +
					`Active: ${vscode.window.activeTextEditor?.document.fileName.split('/').pop() || 'None'}`
			)
		}),

		vscode.commands.registerCommand('cli-bridge.webview', async () => {
			const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || ''

			// Find all HTML files in workspace
			const htmlFiles: Array<{ label: string; description: string; htmlPath: string }> = []
			try {
				const fs = require('fs')
				const findHtmlFiles = (dir: string, relativePath: string = '') => {
					const entries = fs.readdirSync(dir, { withFileTypes: true })
					for (const entry of entries) {
						const fullPath = require('path').join(dir, entry.name)
						const relPath = relativePath ? `${relativePath}/${entry.name}` : entry.name

						if (entry.isDirectory()) {
							// Skip node_modules, .git, out, etc.
							if (!['node_modules', '.git', 'out', 'dist', '.vscode'].includes(entry.name)) {
								findHtmlFiles(fullPath, relPath)
							}
						} else if (entry.isFile() && entry.name.endsWith('.html')) {
							htmlFiles.push({
								label: entry.name,
								description: relPath,
								htmlPath: fullPath
							})
						}
					}
				}

				findHtmlFiles(workspaceRoot)
			} catch (error) {
				vscode.window.showErrorMessage(`Failed to scan HTML files: ${error}`)
				return
			}

			if (htmlFiles.length === 0) {
				vscode.window.showInformationMessage('No HTML files found in workspace')
				return
			}

			// Smart Quick Pick: Select from list OR paste custom path
			const quickPick = vscode.window.createQuickPick()
			quickPick.title = 'Open Webview'
			quickPick.placeholder = 'Select an HTML file or type/paste custom path'
			quickPick.items = htmlFiles
			quickPick.matchOnDescription = true

			let selectedPath: string | undefined

			quickPick.onDidAccept(() => {
				if (quickPick.activeItems.length > 0) {
					// Item selected from list
					selectedPath = (quickPick.activeItems[0] as any).htmlPath
				} else if (quickPick.value) {
					// No item selected, but text entered (custom path)
					selectedPath = require('path').isAbsolute(quickPick.value)
						? quickPick.value
						: require('path').join(workspaceRoot, quickPick.value)
				}
				quickPick.hide()
			})

			quickPick.onDidHide(() => {
				quickPick.dispose()
				if (selectedPath) {
					webviewManager.openView({ context, viewName: selectedPath, title: require('path').basename(selectedPath) })
				}
			})

			quickPick.show()
		})
	)

	console.log('CLI Bridge activated')
}

export function deactivate() {
	console.log('CLI Bridge deactivated')
}
