import * as net from 'net'
import type { JsonRpcRequest, JsonRpcResponse } from './types'

export function sendVSCodeRequest(params: {
	request: JsonRpcRequest
	port?: number
}): Promise<JsonRpcResponse> {
	const port = params.port ?? 9485

	return new Promise((resolve, reject) => {
		const client = net.createConnection({ port }, () => {
			client.write(JSON.stringify(params.request))
		})

		let buffer = ''
		client.on('data', data => {
			buffer += data.toString()
		})

		client.on('end', () => {
			try {
				resolve(JSON.parse(buffer))
			} catch (e) {
				reject(new Error('Invalid JSON response'))
			}
		})

		client.on('error', reject)
	})
}

export function buildVSCodeRequest(params: { method: string; args: string[] }): JsonRpcRequest {
	switch (params.method) {
		case 'status':
			return { method: 'status', params: {} }

		case 'eval':
			return { method: 'eval', params: { code: params.args[0]! } }

		case 'restartExtension':
			return { method: 'restartExtension', params: {} }

		case 'webview':
			return {
				method: 'webview',
				params: {
					viewName: params.args[0]!,
					title: params.args[1],
					customPath: params.args[2]
				}
			}

		case 'registerConfig':
			return {
				method: 'registerConfig',
				params: {
					name: params.args[0]!,
					filePath: params.args[1]!
				}
			}

		case 'unregisterConfig':
			return {
				method: 'unregisterConfig',
				params: {
					name: params.args[0]!
				}
			}

		case 'listConfigs':
			return { method: 'listConfigs', params: {} }

		case 'subscribe':
			return {
				method: 'subscribe',
				params: {
					url: params.args[0]!
				}
			}

		case 'unsubscribe':
			return {
				method: 'unsubscribe',
				params: {
					url: params.args[0]!
				}
			}

		case 'listSubscribers':
			return { method: 'listSubscribers', params: {} }

		case 'getOutput':
			return {
				method: 'getOutput',
				params: {
					lines: params.args[0] ? parseInt(params.args[0]) : 100
				}
			}

		default:
			throw new Error(`Unhandled command: ${params.method}`)
	}
}

export * from './types'
