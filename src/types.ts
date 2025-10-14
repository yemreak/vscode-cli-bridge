export const AVAILABLE_METHODS = ['status', 'eval', 'restartExtension', 'webview', 'registerConfig', 'unregisterConfig', 'listConfigs', 'subscribe', 'unsubscribe', 'listSubscribers', 'getOutput'] as const

export type AvailableMethods = (typeof AVAILABLE_METHODS)[number]

export type JsonRpcRequest =
	| { method: 'status'; params?: {} }
	| { method: 'eval'; params: { code: string } }
	| { method: 'restartExtension'; params?: {} }
	| { method: 'webview'; params: { viewName: string; title?: string; customPath?: string; context?: any } }
	| { method: 'registerConfig'; params: { name: string; filePath: string } }
	| { method: 'unregisterConfig'; params: { name: string } }
	| { method: 'listConfigs'; params?: {} }
	| { method: 'subscribe'; params: { url: string } }
	| { method: 'unsubscribe'; params: { url: string } }
	| { method: 'listSubscribers'; params?: {} }
	| { method: 'getOutput'; params?: { lines?: number } }

export type JsonRpcResponse =
	| { ok: true; result: StatusResult }
	| { ok: true; result: EvalResult }
	| { ok: true; result: RestartExtensionResult }
	| { ok: true; result: WebviewResult }
	| { ok: true; result: ConfigResult }
	| { ok: false; error: string }

export type StatusResult = {
	timestamp: number
	datetime: string
	terminals: {
		count: number
		active: string | null
		list: TerminalInfo[]
	}
	editor: {
		file: string
		language: string
		lines: number
		isDirty: boolean
		cursor: { line: number; column: number }
	} | null
	workspace: {
		folders: { name: string; path: string }[]
		openFiles: number
	}
	extension: {
		name: string
		version: string
		port: number
		uptime: number
	}
}

export type TerminalInfo = {
	name: string
	processId: number
	state: {
		isInteractedWith: boolean
		shell?: string
	}
	exitStatus:
		| {
				code?: number
				reason?: string
		  }
		| undefined
	isActive: boolean
	startTime?: number
	uptime: number | null
	uptimeFormatted: string | null
}

export type RestartExtensionResult = {
	success: boolean
	message: string
}

export type EvalResult = any

export type WebviewResult = {
	success: boolean
	webview: string
}

export type ConfigResult = {
	success?: boolean
	message?: string
	configs?: Array<{
		name: string
		filePath: string
		active: boolean
	}>
	error?: string
}

export type SubscriptionResult = {
	success: boolean
	message: string
	subscribers?: string[]
}

export type VSCodeEvent = {
	event: 'terminal-changed' | 'window-focused' | 'file-saved'
	timestamp: number
	data: any
}
