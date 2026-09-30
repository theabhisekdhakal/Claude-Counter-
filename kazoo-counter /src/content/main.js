(() => {
	'use strict';

	const KZ = (globalThis.KazooCounter = globalThis.KazooCounter || {});
	if (KZ.__started) return;
	KZ.__started = true;

	const SESSION_MS = 5 * 60 * 60 * 1000;
	const clamp = (n) => Math.max(0, Math.min(100, n));

	function getConversationId() {
		const match = window.location.pathname.match(/\/chat\/([^/?]+)/);
		return match ? match[1] : null;
	}

	function getOrgIdFromCookie() {
		try {
			return document.cookie
				.split('; ')
				.find((row) => row.startsWith('lastActiveOrg='))
				?.split('=')[1] || null;
		} catch {
			return null;
		}
	}

	function observeUrlChanges(callback) {
		let lastPath = window.location.pathname;
		const fireIfChanged = () => {
			const current = window.location.pathname;
			if (current !== lastPath) {
				lastPath = current;
				callback();
			}
		};
		window.addEventListener('kz:urlchange', fireIfChanged);
		window.addEventListener('popstate', fireIfChanged);
		return () => {
			window.removeEventListener('kz:urlchange', fireIfChanged);
			window.removeEventListener('popstate', fireIfChanged);
		};
	}

	// ---------- usage parsing (tolerant: finds session/weekly windows wherever they are) ----------
	const PCT_KEYS = ['utilization', 'used_percentage', 'percent_used', 'percentage_used', 'usage_percent', 'used_percent'];

	function pctOf(o) {
		for (const k of PCT_KEYS) {
			if (typeof o[k] === 'number' && Number.isFinite(o[k])) return clamp(o[k]);
		}
		return null;
	}

	function resetOf(o) {
		const v = o.resets_at ?? o.reset_at ?? o.resetsAt ?? o.reset_time ?? o.window_end;
		if (typeof v === 'string') {
			const t = Date.parse(v);
			return Number.isNaN(t) ? null : t;
		}
		if (typeof v === 'number') return v < 1e12 ? v * 1000 : v;
		const secs = o.resets_in_seconds ?? o.seconds_until_reset;
		if (typeof secs === 'number') return Date.now() + secs * 1000;
		return null;
	}

	function classify(path) {
		const p = path.toLowerCase();
		if (/opus|sonnet|haiku|oauth|cowork|extra|design/.test(p)) return null;
		if (/five|5h|5_h|session|hour/.test(p)) return 'session';
		if (/seven|7d|7_d|week/.test(p)) return 'weekly';
		return null;
	}

	function parseUsageFromUsageEndpoint(raw) {
		if (!raw || typeof raw !== 'object') return null;
		const out = { five_hour: null, seven_day: null };
		const walk = (o, path, depth) => {
			if (!o || typeof o !== 'object' || Array.isArray(o) || depth > 4) return;
			const pct = pctOf(o);
			if (pct != null && path) {
				const kind = classify(path);
				if (kind) {
					const t = resetOf(o);
					const win = { utilization: pct, resets_at: t ? new Date(t).toISOString() : null };
					if (kind === 'session' && !out.five_hour) out.five_hour = win;
					if (kind === 'weekly' && !out.seven_day) out.seven_day = win;
				}
				return;
			}
			for (const [k, v] of Object.entries(o)) walk(v, path ? `${path}.${k}` : k, depth + 1);
		};
		walk(raw, '', 0);
		return out;
	}

	// Live message_limit event from the reply stream (utilization is a 0-1 fraction, resets_at is epoch seconds)
	function parseUsageFromMessageLimit(raw) {
		if (!raw?.windows || typeof raw.windows !== 'object') return null;
		const norm = (w) => {
			if (!w || typeof w !== 'object' || typeof w.utilization !== 'number') return null;
			const resets = typeof w.resets_at === 'number' ? new Date(w.resets_at * 1000).toISOString() : null;
			return { utilization: clamp(w.utilization * 100), resets_at: resets };
		};
		const five = norm(raw.windows['5h']);
		const seven = norm(raw.windows['7d']);
		if (!five && !seven) return null;
		return { five_hour: five, seven_day: seven };
	}

	// ---------- session estimate from your own messages ----------
	// A session starts with the first message after the previous one ended and lasts 5 hours.
	const SENDS_KEY = 'kzSends';
	let sends = [];
	try { sends = JSON.parse(localStorage.getItem(SENDS_KEY) || '[]').filter((n) => typeof n === 'number'); } catch {}
	let historyTs = [];

	function recordSend() {
		const now = Date.now();
		sends = sends.filter((t) => now - t < 48 * 3600e3);
		sends.push(now);
		try { localStorage.setItem(SENDS_KEY, JSON.stringify(sends.slice(-300))); } catch {}
	}

	function computeEstimate() {
		const now = Date.now();
		const all = [...historyTs, ...sends].filter((t) => now - t < 36 * 3600e3).sort((a, b) => a - b);
		let start = null;
		for (const t of all) {
			if (start === null || t >= start + SESSION_MS) start = t;
		}
		return start !== null && now < start + SESSION_MS ? { start, resets: start + SESSION_MS } : null;
	}

	let currentConversationId = null;
	let currentOrgId = null;
	let lastRawUsage = null;
	let lastRawLimit = null;
	let usageFetchInFlight = false;
	let usageState = null;
	let usageResetMs = { five_hour: null, seven_day: null };
	const rolloverHandledForResetMs = { five_hour: null, seven_day: null };

	const ui = new KZ.ui.CounterUI({
		onUsageRefresh: async () => {
			await refreshUsage();
			await refreshConversation();
			await bootstrapHistory();
		}
	});
	ui.debugProvider = () => ({
		note: 'Kazoo Counter debug info (contains only usage numbers)',
		usage_endpoint_response: lastRawUsage,
		last_message_limit_event: lastRawLimit,
		estimate: computeEstimate()
	});
	ui.initialize();

	const bridgeReady = KZ.injectBridgeOnce();

	function applyUsageUpdate(normalized) {
		if (!normalized) return;
		usageState = normalized;
		usageResetMs.five_hour = normalized.five_hour?.resets_at ? Date.parse(normalized.five_hour.resets_at) : null;
		usageResetMs.seven_day = normalized.seven_day?.resets_at ? Date.parse(normalized.seven_day.resets_at) : null;
		ui.setUsage(normalized);
	}

	function updateOrgIdIfNeeded(newOrgId) {
		if (newOrgId && typeof newOrgId === 'string' && newOrgId !== currentOrgId) currentOrgId = newOrgId;
	}

	async function refreshUsage() {
		await bridgeReady;
		const orgId = currentOrgId || getOrgIdFromCookie();
		if (!orgId) return;
		updateOrgIdIfNeeded(orgId);
		if (usageFetchInFlight) return;
		usageFetchInFlight = true;
		let raw;
		try {
			raw = await KZ.bridge.requestUsage(orgId);
		} catch {
			ui.setUsage(usageState);
			return;
		} finally {
			usageFetchInFlight = false;
		}
		lastRawUsage = raw;
		applyUsageUpdate(parseUsageFromUsageEndpoint(raw) || { five_hour: null, seven_day: null });
	}

	async function bootstrapHistory() {
		await bridgeReady;
		const orgId = currentOrgId || getOrgIdFromCookie();
		if (!orgId) return;
		try {
			const list = await KZ.bridge.requestConversations(orgId);
			const arr = Array.isArray(list) ? list : (list?.data || list?.conversations || []);
			const cutoff = Date.now() - 12 * 3600e3;
			const recent = arr
				.filter((c) => c?.uuid && Date.parse(c.updated_at || c.created_at || 0) > cutoff)
				.slice(0, 8);
			const ts = [];
			for (const c of recent) {
				try {
					const conv = await KZ.bridge.requestConversation(orgId, c.uuid);
					for (const m of conv?.chat_messages || []) {
						if (m?.sender === 'human' && m.created_at) {
							const t = Date.parse(m.created_at);
							if (!Number.isNaN(t)) ts.push(t);
						}
					}
				} catch {}
			}
			historyTs = ts;
			ui.setSessionEstimate(computeEstimate());
		} catch {}
	}

	async function refreshConversation() {
		await bridgeReady;
		if (!currentConversationId) {
			ui.setConversationMetrics();
			return;
		}
		const orgId = currentOrgId || getOrgIdFromCookie();
		if (!orgId) return;
		updateOrgIdIfNeeded(orgId);
		try {
			await KZ.bridge.requestConversation(orgId, currentConversationId);
		} catch {}
	}

	function handleGenerationStart() {
		recordSend();
		ui.setSessionEstimate(computeEstimate());
		if (currentConversationId) ui.setPendingCache(true);
	}

	async function handleConversationPayload({ orgId, conversationId, data }) {
		if (!conversationId || conversationId !== currentConversationId) return;
		updateOrgIdIfNeeded(orgId);
		if (!data) return;
		const metrics = await KZ.tokens.computeConversationMetrics(data);
		ui.setConversationMetrics({ totalTokens: metrics.totalTokens, cachedUntil: metrics.cachedUntil });
	}

	function handleMessageLimit(messageLimit) {
		lastRawLimit = messageLimit;
		applyUsageUpdate(parseUsageFromMessageLimit(messageLimit));
	}

	KZ.bridge.on('kz:generation_start', handleGenerationStart);
	KZ.bridge.on('kz:conversation', handleConversationPayload);
	KZ.bridge.on('kz:message_limit', handleMessageLimit);

	async function handleUrlChange() {
		currentConversationId = getConversationId();
		if (!currentConversationId) {
			ui.setConversationMetrics();
			return;
		}
		updateOrgIdIfNeeded(getOrgIdFromCookie());
		await refreshConversation();
	}

	const unobserveUrl = observeUrlChanges(handleUrlChange);
	window.addEventListener('beforeunload', unobserveUrl);

	// Initial fetches
	handleUrlChange();
	refreshUsage();
	setTimeout(bootstrapHistory, 2500);

	let lastUsagePollMs = Date.now();

	function tick() {
		const now = Date.now();
		ui.setSessionEstimate(computeEstimate());
		ui.tick();

		// Re-check usage when a window ends
		for (const key of ['five_hour', 'seven_day']) {
			const r = usageResetMs[key];
			if (r && now >= r && rolloverHandledForResetMs[key] !== r) {
				rolloverHandledForResetMs[key] = r;
				refreshUsage();
			}
		}
		// Safety refresh every 5 minutes while visible
		if (!document.hidden && now - lastUsagePollMs > 5 * 60 * 1000) {
			lastUsagePollMs = now;
			refreshUsage();
		}
	}

	setInterval(tick, 1000);
})();
