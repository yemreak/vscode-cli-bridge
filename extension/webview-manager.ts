import * as vscode from 'vscode'
import * as fs from 'fs'
import * as path from 'path'

export class WebviewManager {
	private panels = new Map<string, vscode.WebviewPanel>()
	private watchers = new Map<string, vscode.FileSystemWatcher>()
	private workspaceRoot: string

	constructor(params: {
		context: vscode.ExtensionContext
		workspaceRoot: string
	}) {
		this.workspaceRoot = params.workspaceRoot
	}

	openView(params: {
		context: vscode.ExtensionContext
		viewName: string
		title?: string
		customPath?: string
	}) {
		if (this.panels.has(params.viewName)) {
			this.panels.get(params.viewName)!.reveal()
			return
		}

		// Read default path from settings
		const config = vscode.workspace.getConfiguration('cli-bridge')
		const defaultPath = config.get<string>('webviewPath') || 'src/interface/web'

		// Path detection: custom path or default
		let viewPath: string
		let htmlPath: string

		if (params.customPath) {
			viewPath = path.isAbsolute(params.customPath)
				? params.customPath
				: path.join(this.workspaceRoot, params.customPath)
			htmlPath = path.join(viewPath, 'index.html')
		} else if (params.viewName.includes('/')) {
			// If viewName has /, treat as custom path
			const fullPath = path.isAbsolute(params.viewName)
				? params.viewName
				: path.join(this.workspaceRoot, params.viewName)
			if (params.viewName.endsWith('.html')) {
				// If it's a file path, use parent directory as viewPath
				viewPath = path.dirname(fullPath)
				htmlPath = fullPath
			} else {
				viewPath = fullPath
				htmlPath = path.join(viewPath, 'index.html')
			}
		} else {
			// Default: {defaultPath}/{viewName}
			viewPath = path.join(this.workspaceRoot, defaultPath, params.viewName)
			htmlPath = path.join(viewPath, 'index.html')
		}

		const manifestPath = path.join(viewPath, 'manifest.json')

		if (!fs.existsSync(htmlPath)) {
			vscode.window.showErrorMessage(`View not found: ${htmlPath}`)
			return
		}

		// Read manifest.json if exists
		let watchFiles: string[] = []
		if (fs.existsSync(manifestPath)) {
			try {
				const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
				if (manifest.watch && Array.isArray(manifest.watch)) {
					watchFiles = manifest.watch
				}
			} catch (error) {
				console.error(`Failed to parse manifest.json for ${params.viewName}:`, error)
			}
		}

		// Get parent directory for component imports
		const parentPath = path.dirname(viewPath)

		const panel = vscode.window.createWebviewPanel(
			`view-${params.viewName}`,
			params.title || params.viewName,
			vscode.ViewColumn.One,
			{
				enableScripts: true,
				retainContextWhenHidden: true,
				localResourceRoots: [
					vscode.Uri.file(viewPath),
					vscode.Uri.file(parentPath)
				]
			}
		)

		// Read HTML and inject CSS if available
		let html = fs.readFileSync(htmlPath, 'utf8')
		html = this.injectLocalCSS(html, htmlPath, viewPath, panel.webview)
		html = this.convertResourcePaths(html, viewPath, panel.webview)
		panel.webview.html = html

		panel.webview.onDidReceiveMessage(msg => {
			// Write to first watch file (convention)
			if (watchFiles[0]) {
				const firstWatchFile = path.join(viewPath, watchFiles[0])
				this.handleMessage(params.viewName, firstWatchFile, msg)
			}
		})

		panel.onDidDispose(() => {
			this.panels.delete(params.viewName)
			// Dispose all watchers for this view
			Array.from(this.watchers.keys())
				.filter(key => key.startsWith(params.viewName + '_'))
				.forEach(key => {
					this.watchers.get(key)?.dispose()
					this.watchers.delete(key)
				})
		})

		this.panels.set(params.viewName, panel)
		params.context.subscriptions.push(panel)

		// Setup watchers for all watch files
		watchFiles.forEach((fileName, index) => {
			const filePath = path.join(viewPath, fileName)
			this.setupDataWatcher(params.context, params.viewName, filePath, panel, index)
			this.syncDataToView(params.viewName, filePath, panel)
		})

		this.setupHtmlWatcher(params.context, params.viewName, htmlPath, panel, viewPath)
		this.setupAssetWatchers(params.context, params.viewName, viewPath, htmlPath, panel)
	}

	private setupDataWatcher(
		context: vscode.ExtensionContext,
		viewName: string,
		dataPath: string,
		panel: vscode.WebviewPanel,
		index: number
	) {
		const watcher = vscode.workspace.createFileSystemWatcher(dataPath)

		watcher.onDidChange(() => {
			this.syncDataToView(viewName, dataPath, panel)
		})

		this.watchers.set(`${viewName}_data_${index}`, watcher)
		context.subscriptions.push(watcher)
	}

	private setupHtmlWatcher(
		context: vscode.ExtensionContext,
		viewName: string,
		htmlPath: string,
		panel: vscode.WebviewPanel,
		viewPath: string
	) {
		const htmlPattern = path.join(viewPath, '**/*.html')
		const watcher = vscode.workspace.createFileSystemWatcher(htmlPattern)

		const reload = () => this.reloadWebview(htmlPath, viewPath, panel)

		watcher.onDidChange(reload)
		watcher.onDidCreate(reload)
		watcher.onDidDelete(reload)

		this.watchers.set(viewName + '_html', watcher)
		context.subscriptions.push(watcher)
	}

	private setupAssetWatchers(
		context: vscode.ExtensionContext,
		viewName: string,
		viewPath: string,
		htmlPath: string,
		panel: vscode.WebviewPanel
	) {
		// Watch all CSS and JS files in the view directory
		const cssPattern = path.join(viewPath, '**/*.css')
		const jsPattern = path.join(viewPath, '**/*.js')

		const cssWatcher = vscode.workspace.createFileSystemWatcher(cssPattern)
		const jsWatcher = vscode.workspace.createFileSystemWatcher(jsPattern)

		const reload = () => this.reloadWebview(htmlPath, viewPath, panel)

		cssWatcher.onDidChange(reload)
		cssWatcher.onDidCreate(reload)
		cssWatcher.onDidDelete(reload)

		jsWatcher.onDidChange(reload)
		jsWatcher.onDidCreate(reload)
		jsWatcher.onDidDelete(reload)

		this.watchers.set(`${viewName}_css`, cssWatcher)
		this.watchers.set(`${viewName}_js`, jsWatcher)
		context.subscriptions.push(cssWatcher, jsWatcher)
	}

	private reloadWebview(htmlPath: string, viewPath: string, panel: vscode.WebviewPanel) {
		try {
			console.log(`[WebviewManager] Reloading: ${htmlPath}`)
			// Reload HTML with CSS injection and updated resource paths
			let newHtml = fs.readFileSync(htmlPath, 'utf8')
			newHtml = this.injectLocalCSS(newHtml, htmlPath, viewPath, panel.webview)
			newHtml = this.convertResourcePaths(newHtml, viewPath, panel.webview)
			panel.webview.html = newHtml
			console.log(`[WebviewManager] Reload complete`)
		} catch (error) {
			console.error(`[WebviewManager] Reload error:`, error)
			// Show error in webview
			panel.webview.html = `
				<html>
					<body style="background:#1e1e1e;color:#f44;font-family:monospace;padding:40px">
						<h1>⚠️ Reload Error</h1>
						<pre>${error}</pre>
					</body>
				</html>
			`
		}
	}

	private handleMessage(viewName: string, dataPath: string, msg: any) {
		if (msg.type === 'user_message') {
			const line = JSON.stringify({
				role: 'user',
				content: msg.content,
				timestamp: msg.timestamp
			})

			fs.appendFileSync(dataPath, line + '\n')
		}
	}

	private injectLocalCSS(html: string, htmlPath: string, viewPath: string, webview: vscode.Webview): string {
		// Check if there's a CSS file with the same name
		const htmlBaseName = path.basename(htmlPath, '.html')
		const cssPath = path.join(path.dirname(htmlPath), `${htmlBaseName}.css`)

		if (!fs.existsSync(cssPath)) {
			return html
		}

		// Convert CSS path to webview URI
		const cssUri = webview.asWebviewUri(vscode.Uri.file(cssPath))
		const cssLink = `<link rel="stylesheet" href="${cssUri}">`

		// Inject CSS into <head> or at the start of HTML
		if (html.includes('<head>')) {
			return html.replace('<head>', `<head>\n\t${cssLink}`)
		} else if (html.includes('<!DOCTYPE') || html.includes('<html')) {
			// If there's a doctype/html tag, inject after it
			const match = html.match(/(<html[^>]*>)/i)
			if (match) {
				return html.replace(match[0], `${match[0]}\n${cssLink}`)
			}
		}

		// Fallback: prepend to HTML
		return `${cssLink}\n${html}`
	}

	private convertResourcePaths(html: string, viewPath: string, webview: vscode.Webview): string {
		// Convert relative paths to webview URIs
		return html.replace(/(href|src)="([^"]+)"/g, (match, attr, relativePath) => {
			// Skip absolute URLs and data URIs
			if (relativePath.startsWith('http') || relativePath.startsWith('data:') || relativePath.startsWith('vscode-')) {
				return match
			}

			// Convert to absolute path
			const absolutePath = path.join(viewPath, relativePath)

			// Check if file exists
			if (!fs.existsSync(absolutePath)) {
				console.warn(`Resource not found: ${absolutePath}`)
				return match
			}

			// Convert to webview URI
			const webviewUri = webview.asWebviewUri(vscode.Uri.file(absolutePath))
			return `${attr}="${webviewUri}"`
		})
	}

	private syncDataToView(viewName: string, dataPath: string, panel: vscode.WebviewPanel) {
		if (!fs.existsSync(dataPath)) return

		const content = fs.readFileSync(dataPath, 'utf8')

		try {
			let data: any

			// Try JSON array/object first
			try {
				data = JSON.parse(content)
			} catch {
				// Fallback to JSONL (line-delimited JSON)
				data = content
					.split('\n')
					.filter(line => line.trim())
					.map(line => JSON.parse(line))
			}

			// Send different message types based on data structure
			if (Array.isArray(data) && data[0]?.role) {
				// Conversation format
				panel.webview.postMessage({
					type: 'update_messages',
					messages: data
				})
			} else if (Array.isArray(data) && data[0]?.type) {
				// Metrics/dashboard format
				panel.webview.postMessage({
					type: 'update_metrics',
					metrics: data
				})
			} else {
				// Generic data format
				panel.webview.postMessage({
					type: 'update_data',
					data: data
				})
			}
		} catch (error) {
			console.error(`Failed to sync data for ${viewName}:`, error)
		}
	}
}
