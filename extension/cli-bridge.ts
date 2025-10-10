#!/usr/bin/env bun

import * as net from 'net'
import type { JsonRpcRequest, JsonRpcResponse } from './types'
import { AVAILABLE_METHODS } from './types'

// Extension tarafında çalışacak server
export class BridgeServer {
	private server: net.Server
	private vscode: any // Extension context'te gelecek
	private context: any
	private terminalStartTimes: Map<any, number>
	private startTime: number
	private outputChannel: any
	private webviewManager: any
	private configHandlers: any
	private subscribers: Set<string> = new Set()

	constructor(vscode: any, context: any, terminalStartTimes?: Map<any, number>, webviewManager?: any) {
		this.vscode = vscode
		this.context = context
		this.terminalStartTimes = terminalStartTimes || new Map()
		this.webviewManager = webviewManager
		this.startTime = Date.now()
		this.outputChannel = vscode.window.createOutputChannel('CLI Bridge', { log: true })
		this.server = net.createServer(this.handleConnection.bind(this))
	}

	setConfigHandlers(handlers: any) {
		this.configHandlers = handlers
	}

	getStartTime(): number {
		return this.startTime
	}

	broadcast(event: { event: string; timestamp: number; data: any }) {
		this.subscribers.forEach(url => {
			fetch(url, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(event)
			}).catch(err => {
				this.outputChannel.appendLine(`✖ Broadcast failed to ${url}: ${err}`)
			})
		})
	}

	start(port = 9485) {
		this.outputChannel.appendLine('=== CLI Bridge Started ===')
		this.outputChannel.appendLine(`Listening on port ${port}`)
		// Don't show output on start (annoying)
		this.server.listen(port, () => {
			this.outputChannel.appendLine('Server is ready')
		})
	}

	private async handleConnection(socket: net.Socket) {
		socket.on('data', async data => {
			try {
				const request = JSON.parse(data.toString())
				this.outputChannel.appendLine(`→ INPUT: ${JSON.stringify(request)}`)

				const result = await this.executeCommand(request)

				if (result && typeof result === 'object' && 'error' in result) {
					const response = { ok: false, error: result.error }
					this.outputChannel.appendLine(`← OUTPUT: ${JSON.stringify(response)}`)
					socket.write(JSON.stringify(response))
				} else {
					const response = { ok: true, result }
					this.outputChannel.appendLine(`← OUTPUT: ${JSON.stringify(response)}`)
					socket.write(JSON.stringify(response))
				}
				socket.end()
			} catch (error) {
				const response = { ok: false, error: error instanceof Error ? error.message : String(error) }
				this.outputChannel.appendLine(`← ERROR: ${JSON.stringify(response)}`)
				socket.write(JSON.stringify(response))
				socket.end()
			}
		})

		socket.on('error', error => {
			this.outputChannel.appendLine(`✖ SOCKET ERROR: ${error}`)
		})
	}

	private async executeCommand(request: any) {
		const { method, params } = request

		switch (method) {
			// Restart extension host
			case 'restartExtension':
				setImmediate(() => {
					this.vscode.commands.executeCommand('workbench.action.restartExtensionHost')
				})
				return { success: true, message: 'Extension host will restart' }

			// Evaluate arbitrary code
			case 'eval':
				const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor
				// Auto-wrap: if single expression without return, wrap it
				let code = params.code.trim()
				const hasExplicitReturn = /\breturn\b/.test(code)
				const isSingleExpression = !code.includes('\n') && !code.includes(';')
				if (!hasExplicitReturn && isSingleExpression) {
					code = `return (${code})`
				}
				// Inject require and vscode into eval context
				const fn = new AsyncFunction('require', 'vscode', code)
				return await fn.call(this, require, this.vscode)

			// Open webview
			case 'webview':
				if (!this.webviewManager) {
					return { error: 'WebviewManager not initialized' }
				}
				if (!params.viewName) {
					return { error: 'viewName parameter required' }
				}
				this.webviewManager.openView({
					context: this.context,
					viewName: params.viewName,
					title: params.title || `🌲 ${params.viewName}`,
					customPath: params.customPath
				})
				return { success: true, webview: params.viewName }

			// Register config
			case 'registerConfig':
				if (!this.configHandlers) {
					return { error: 'Config handlers not initialized' }
				}
				if (!params.name || !params.filePath) {
					return { error: 'name and filePath required' }
				}
				return this.configHandlers.register({ name: params.name, filePath: params.filePath })

			// Unregister config
			case 'unregisterConfig':
				if (!this.configHandlers) {
					return { error: 'Config handlers not initialized' }
				}
				if (!params.name) {
					return { error: 'name required' }
				}
				return this.configHandlers.unregister({ name: params.name })

			// List configs
			case 'listConfigs':
				if (!this.configHandlers) {
					return { error: 'Config handlers not initialized' }
				}
				return this.configHandlers.list()

			// Subscribe to events
			case 'subscribe':
				if (!params.url) {
					return { error: 'url parameter required' }
				}
				this.subscribers.add(params.url)
				this.outputChannel.appendLine(`✓ Subscribed: ${params.url}`)
				return { success: true, message: `Subscribed to ${params.url}`, subscribers: Array.from(this.subscribers) }

			// Unsubscribe from events
			case 'unsubscribe':
				if (!params.url) {
					return { error: 'url parameter required' }
				}
				this.subscribers.delete(params.url)
				this.outputChannel.appendLine(`✓ Unsubscribed: ${params.url}`)
				return { success: true, message: `Unsubscribed from ${params.url}` }

			// List subscribers
			case 'listSubscribers':
				return { success: true, message: `${this.subscribers.size} subscriber(s)`, subscribers: Array.from(this.subscribers) }

			// Get full system status
			case 'status':
				const statusTerminals = await Promise.all(
					this.vscode.window.terminals.map(async (terminal: any) => {
						const processId = await terminal.processId
						const startTime = this.terminalStartTimes.get(terminal)
						const now = Date.now()
						return {
							name: terminal.name,
							processId: processId,
							state: terminal.state,
							exitStatus: terminal.exitStatus,
							isActive: terminal === this.vscode.window.activeTerminal,
							startTime: startTime,
							uptime: startTime ? Math.floor((now - startTime) / 1000) : null,
							uptimeFormatted: startTime ? this.formatUptime((now - startTime) / 1000) : null
						}
					})
				)

				const statusActiveEditor = this.vscode.window.activeTextEditor
				const statusWorkspaceFolders = this.vscode.workspace.workspaceFolders

				return {
					timestamp: Date.now(),
					datetime: new Date().toISOString(),
					terminals: {
						count: statusTerminals.length,
						active: this.vscode.window.activeTerminal?.name || null,
						list: statusTerminals
					},
					editor: statusActiveEditor
						? {
								file: statusActiveEditor.document.fileName,
								language: statusActiveEditor.document.languageId,
								lines: statusActiveEditor.document.lineCount,
								isDirty: statusActiveEditor.document.isDirty,
								cursor: {
									line: statusActiveEditor.selection.active.line + 1,
									column: statusActiveEditor.selection.active.character + 1
								}
							}
						: null,
					workspace: {
						folders:
							statusWorkspaceFolders?.map((f: any) => ({
								name: f.name,
								path: f.uri.path
							})) || [],
						openFiles: this.vscode.window.visibleTextEditors.length
					},
					extension: {
						name: 'CLI Bridge',
						version: '0.1.0',
						port: 9485,
						uptime: Math.floor((Date.now() - (this.startTime || Date.now())) / 1000)
					}
				}

			default:
				return {
					error: `Unknown method: ${method}`,
					available: AVAILABLE_METHODS,
					hint: 'Run "vscode --help" for examples'
				}
		}
	}

	private formatUptime(seconds: number): string {
		const hours = Math.floor(seconds / 3600)
		const minutes = Math.floor((seconds % 3600) / 60)
		const secs = Math.floor(seconds % 60)

		if (hours > 0) {
			return `${hours}h ${minutes}m ${secs}s`
		} else if (minutes > 0) {
			return `${minutes}m ${secs}s`
		} else {
			return `${secs}s`
		}
	}
}

// CLI Tool tarafı
export class BridgeClient {
	private port: number

	constructor(port = 9485) {
		this.port = port
	}

	async send(request: JsonRpcRequest): Promise<JsonRpcResponse> {
		return new Promise((resolve, reject) => {
			const client = net.createConnection({ port: this.port }, () => {
				client.write(JSON.stringify(request))
			})

			client.on('data', data => {
				resolve(JSON.parse(data.toString()))
				client.end()
			})

			client.on('error', reject)
		})
	}
}

// CLI kullanımı - Bun ile çalıştırılacak, extension'dan bağımsız
