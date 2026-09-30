(() => {
	'use strict';

	const KZ = (globalThis.KazooCounter = globalThis.KazooCounter || {});

	function getRuntime() {
		return globalThis.browser?.runtime || globalThis.chrome?.runtime || null;
	}

	function makeRequestId() {
		return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
	}

	class BridgeClient {
		constructor() {
			this._pending = new Map();
			this._listeners = new Map();

			window.addEventListener('message', (event) => {
				if (event.source !== window) return;
				const data = event.data;
				if (!data || data.kz !== 'KazooCounter') return;

				if (data.type === 'kz:response') {
					const { requestId, ok, payload, error } = data;
					const pending = this._pending.get(requestId);
					if (!pending) return;
					this._pending.delete(requestId);
					clearTimeout(pending.timeoutId);
					if (ok) pending.resolve(payload);
					else pending.reject(new Error(error || 'Bridge request failed'));
					return;
				}

				// Events
				this._emit(data.type, data.payload);
			});
		}

		_emit(type, payload) {
			const listeners = this._listeners.get(type);
			if (!listeners) return;
			for (const fn of listeners) {
				fn(payload);
			}
		}

		on(type, fn) {
			if (!this._listeners.has(type)) this._listeners.set(type, new Set());
			this._listeners.get(type).add(fn);
			return () => this._listeners.get(type)?.delete(fn);
		}

		request(kind, payload, { timeoutMs = 10000 } = {}) {
			const requestId = makeRequestId();
			return new Promise((resolve, reject) => {
				const timeoutId = setTimeout(() => {
					this._pending.delete(requestId);
					reject(new Error(`Bridge request timed out (${kind})`));
				}, timeoutMs);

				this._pending.set(requestId, { resolve, reject, timeoutId });
				window.postMessage(
					{
						kz: 'KazooCounter',
						type: 'kz:request',
						requestId,
						kind,
						payload
					},
					'*'
				);
			});
		}

		async requestUsage(orgId) {
			return this.request('usage', { orgId }, { timeoutMs: 15000 });
		}

		async requestConversation(orgId, conversationId) {
			return this.request('conversation', { orgId, conversationId }, { timeoutMs: 20000 });
		}

		async requestConversations(orgId) {
			return this.request('conversations', { orgId }, { timeoutMs: 20000 });
		}

		async requestHash(text) {
			return this.request('hash', { text }, { timeoutMs: 5000 });
		}
	}

	let bridgeReadyPromise = null;

	function injectBridgeOnce() {
		if (bridgeReadyPromise) return bridgeReadyPromise;

		const runtime = getRuntime();
		if (!runtime) return Promise.resolve(false);

		if (document.getElementById(KZ.DOM.BRIDGE_SCRIPT_ID)) {
			return Promise.resolve(true);
		}

		bridgeReadyPromise = new Promise((resolve) => {
			const script = document.createElement('script');
			script.id = KZ.DOM.BRIDGE_SCRIPT_ID;
			script.src = runtime.getURL('src/injected/bridge.js');
			script.onload = () => resolve(true);
			script.onerror = () => resolve(false);
			(document.head || document.documentElement).appendChild(script);
		});

		return bridgeReadyPromise;
	}

	KZ.bridge = new BridgeClient();
	KZ.injectBridgeOnce = injectBridgeOnce;
})();
