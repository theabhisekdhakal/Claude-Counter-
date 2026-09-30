(() => {
	'use strict';

	const KZ = (globalThis.KazooCounter = globalThis.KazooCounter || {});

	const SESSION_MS = 5 * 60 * 60 * 1000;
	const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
	const CONTEXT_LIMIT = 200000;

	const LOGO = `<svg viewBox="0 0 32 32" width="26" height="26"><defs><linearGradient id="kzg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8b5cf6"/><stop offset="1" stop-color="#ec4899"/></linearGradient></defs><rect width="32" height="32" rx="9" fill="url(#kzg)"/><g stroke="#fff" stroke-width="3" stroke-linecap="round" fill="none"><path d="M11 9v14"/><path d="M21 9l-10 8"/><path d="M14 15l7 8"/></g></svg>`;

	const CSS = `
		:host{all:initial}
		.box{position:fixed;z-index:2147483000;width:300px;max-width:calc(100vw - 24px);box-sizing:border-box;
			font:12px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;
			border-radius:18px;padding:12px 14px 14px;border:1px solid var(--bd);background:var(--bg);color:var(--fg);
			box-shadow:0 12px 34px rgba(20,10,40,.22);touch-action:none;font-variant-numeric:tabular-nums}
		.box{--bg:#fff;--fg:#1f1e24;--mut:#7a7885;--bd:#e6e3ee;--track:#ebe8f2;--card:#f7f5fb}
		.box.dark{--bg:#1d1b22;--fg:#f5f3fb;--mut:#a3a0b0;--bd:#37343f;--track:#38353f;--card:#26232d}
		.hd{display:flex;align-items:center;gap:9px;cursor:grab;user-select:none}
		.hd:active{cursor:grabbing}
		.logo{display:flex}
		.title{flex:1;font-weight:700;font-size:14px;letter-spacing:.1px}
		.title small{display:block;font-weight:500;font-size:10.5px;color:var(--mut)}
		.btn{cursor:pointer;color:var(--mut);padding:3px 7px;border-radius:7px;font-size:14px;line-height:1}
		.btn:hover{background:var(--card);color:var(--fg)}
		.sec{margin-top:10px;padding:10px 12px;border-radius:13px;background:var(--card)}
		.row{display:flex;justify-content:space-between;align-items:baseline;gap:8px}
		.lbl{font-weight:650}.lbl small{font-weight:500;color:var(--mut);margin-left:5px}
		.pct{font-weight:750;font-size:15px}
		.bar{position:relative;height:8px;border-radius:999px;background:var(--track);margin:8px 0 7px}
		.fill{height:100%;border-radius:999px;background:linear-gradient(90deg,#8b5cf6,#ec4899);transition:width .4s}
		.amber .fill{background:linear-gradient(90deg,#f5b544,#f0862a)}
		.red .fill{background:linear-gradient(90deg,#f87171,#dc2626)}
		.red .pct{color:#ef4444}
		.mk{position:absolute;top:-3px;bottom:-3px;width:2px;border-radius:1px;background:var(--fg);opacity:.7}
		.line{color:var(--mut)}
		.line b{color:var(--fg);font-weight:650}
		.big{display:flex;justify-content:space-between;align-items:baseline;margin-top:2px}
		.big .n{font-size:19px;font-weight:750;letter-spacing:-.3px}
		.big .n span{font-size:11px;font-weight:500;color:var(--mut);margin-left:4px}
		.note{color:var(--mut);margin-top:10px;text-align:center}
		.note u{cursor:pointer;color:#8b5cf6}
		.pills{display:flex;gap:6px;flex:1;justify-content:flex-end;font-weight:650}
		.pill{background:var(--card);border-radius:999px;padding:3px 10px}
		.tag{font-size:10px;font-weight:600;color:#8b5cf6;background:rgba(139,92,246,.12);border-radius:999px;padding:1px 7px;margin-left:6px}
	`;

	function fmtDur(ms) {
		if (ms <= 0) return '0m';
		const s = Math.floor(ms / 1000);
		const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
		if (d) return `${d}d ${h}h`;
		if (h) return `${h}h ${String(m).padStart(2, '0')}m`;
		return `${m}m ${String(sec).padStart(2, '0')}s`;
	}
	function fmtClock(ms, withDay) {
		const dt = new Date(ms);
		const time = dt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
		const same = new Date().toDateString() === dt.toDateString();
		return withDay || !same ? `${dt.toLocaleDateString([], { weekday: 'short' })} ${time}` : time;
	}
	const fmtCache = (sec) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
	const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
	const level = (p) => (p >= 90 ? 'red' : p >= 70 ? 'amber' : '');
	const pctText = (p) => `${p < 10 && p > 0 ? p.toFixed(1) : Math.round(p)}%`;

	function isDark() {
		const mode = document.documentElement.dataset?.mode;
		if (mode === 'dark') return true;
		if (mode === 'light') return false;
		for (const el of [document.body, document.documentElement]) {
			const m = (el && getComputedStyle(el).backgroundColor || '').match(/[\d.]+/g);
			if (m && m.length >= 3 && !(m.length >= 4 && Number(m[3]) < 0.5)) {
				return 0.299 * m[0] + 0.587 * m[1] + 0.114 * m[2] < 128;
			}
		}
		return matchMedia('(prefers-color-scheme: dark)').matches;
	}

	class CounterUI {
		constructor({ onUsageRefresh } = {}) {
			this.onUsageRefresh = onUsageRefresh || null;
			this.debugProvider = null;
			this.tokens = null;
			this.cachedUntil = null;
			this.pending = false;
			this.usage = null; // { five_hour, seven_day } from claude.ai (or null)
			this.usageLoaded = false;
			this.estimate = null; // { start, resets } estimated from your messages
			this.collapsed = false;
			this.pos = null;
			this.copied = false;
			try {
				this.collapsed = localStorage.getItem('kzCollapsed') === '1';
				this.pos = JSON.parse(localStorage.getItem('kzPos') || 'null');
			} catch {}
		}

		initialize() { this._ensure(); }
		attachHeader() {}
		attachUsageLine() {}
		ensureFallback() { this._ensure(); }
		tick() { this.render(); }

		setPendingCache(p) { this.pending = p; this.render(); }

		setConversationMetrics({ totalTokens, cachedUntil } = {}) {
			this.pending = false;
			this.tokens = typeof totalTokens === 'number' ? totalTokens : null;
			this.cachedUntil = typeof cachedUntil === 'number' ? cachedUntil : null;
			this.render();
		}

		setUsage(usage) { this.usage = usage || null; this.usageLoaded = true; this.render(); }
		setSessionEstimate(est) { this.estimate = est || null; }

		_ensure() {
			if (this.host && this.host.isConnected) return true;
			if (!document.body) return false;
			this.host = document.createElement('div');
			const root = this.host.attachShadow({ mode: 'open' });
			root.innerHTML = `<style>${CSS}</style><div class="box"></div>`;
			this.box = root.querySelector('.box');
			this._applyPos();

			let drag = null;
			this.box.addEventListener('click', async (e) => {
				if (e.target.closest('[data-act="toggle"]')) {
					this.collapsed = !this.collapsed;
					try { localStorage.setItem('kzCollapsed', this.collapsed ? '1' : '0'); } catch {}
					this.render();
				} else if (e.target.closest('[data-act="refresh"]')) {
					if (this.onUsageRefresh) await this.onUsageRefresh();
				} else if (e.target.closest('[data-act="debug"]')) {
					try {
						const data = this.debugProvider ? this.debugProvider() : {};
						await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
						this.copied = true;
						setTimeout(() => { this.copied = false; this.render(); }, 2500);
						this.render();
					} catch {}
				}
			});
			this.box.addEventListener('pointerdown', (e) => {
				if (!e.target.closest('.hd') || e.target.closest('[data-act]')) return;
				const r = this.box.getBoundingClientRect();
				drag = { dx: e.clientX - r.left, dy: e.clientY - r.top };
				this.box.setPointerCapture(e.pointerId);
			});
			this.box.addEventListener('pointermove', (e) => {
				if (!drag) return;
				this.pos = { x: clamp(e.clientX - drag.dx, 0, innerWidth - 80), y: clamp(e.clientY - drag.dy, 0, innerHeight - 50) };
				this._applyPos();
			});
			const end = () => {
				if (!drag) return;
				drag = null;
				try { localStorage.setItem('kzPos', JSON.stringify(this.pos)); } catch {}
			};
			this.box.addEventListener('pointerup', end);
			this.box.addEventListener('pointercancel', end);
			document.body.appendChild(this.host);
			this.render();
			return true;
		}

		_applyPos() {
			const b = this.box;
			if (this.pos) { b.style.left = `${this.pos.x}px`; b.style.top = `${this.pos.y}px`; b.style.right = b.style.bottom = 'auto'; }
			else { b.style.right = '16px'; b.style.bottom = '16px'; b.style.left = b.style.top = 'auto'; }
		}

		// Work out what to show for the 5-hour session
		_session(now) {
			const s = this.usage && this.usage.five_hour;
			const apiReset = s && s.resets_at ? Date.parse(s.resets_at) : null;
			if (apiReset && apiReset > now && typeof s.utilization === 'number') {
				return { pct: clamp(s.utilization, 0, 100), start: apiReset - SESSION_MS, resets: apiReset, estimated: false };
			}
			if (this.estimate && this.estimate.resets > now) {
				return { pct: null, start: this.estimate.start, resets: this.estimate.resets, estimated: true };
			}
			return null;
		}

		_weekly(now) {
			const w = this.usage && this.usage.seven_day;
			const r = w && w.resets_at ? Date.parse(w.resets_at) : null;
			if (r && r > now && typeof w.utilization === 'number') {
				return { pct: clamp(w.utilization, 0, 100), start: r - WEEK_MS, resets: r };
			}
			return null;
		}

		_sessionBlock(now) {
			const s = this._session(now);
			if (!s) {
				return `<div class="sec"><div class="row"><span class="lbl">Session<small>5-hour</small></span><span class="pct">0%</span></div><div class="bar"><div class="fill" style="width:0%"></div></div><div class="line">Not started · your timer begins when you send a message</div></div>`;
			}
			const used = clamp(now - s.start, 0, SESSION_MS);
			const left = s.resets - now;
			const timePct = (used / SESSION_MS) * 100;
			const fill = s.pct != null ? s.pct : timePct;
			const cls = s.pct != null ? level(s.pct) : '';
			const head = s.pct != null ? pctText(s.pct) : '';
			const tag = s.estimated ? '<span class="tag">estimated</span>' : '';
			const marker = s.pct != null ? `<i class="mk" style="left:${timePct}%"></i>` : '';
			return `<div class="sec ${cls}"><div class="row"><span class="lbl">Session<small>5-hour</small>${tag}</span><span class="pct">${head}</span></div><div class="bar"><div class="fill" style="width:${fill}%"></div>${marker}</div><div class="big"><div class="n">${fmtDur(left)}<span>left</span></div><div class="line">resets <b>${fmtClock(s.resets, false)}</b></div></div><div class="line" style="margin-top:3px">Used <b>${fmtDur(used)}</b> so far${s.pct == null ? ' · from your messages' : ''}</div></div>`;
		}

		_weeklyBlock(now) {
			const w = this._weekly(now);
			if (!w) return '';
			const used = clamp(now - w.start, 0, WEEK_MS);
			const timePct = (used / WEEK_MS) * 100;
			return `<div class="sec ${level(w.pct)}"><div class="row"><span class="lbl">Weekly<small>7-day</small></span><span class="pct">${pctText(w.pct)}</span></div><div class="bar"><div class="fill" style="width:${w.pct}%"></div><i class="mk" style="left:${timePct}%"></i></div><div class="big"><div class="n">${fmtDur(w.resets - now)}<span>left</span></div><div class="line">resets <b>${fmtClock(w.resets, true)}</b></div></div><div class="line" style="margin-top:3px">Used <b>${fmtDur(used)}</b> of 7 days</div></div>`;
		}

		_contextBlock(now) {
			if (this.tokens == null) return `<div class="sec"><div class="line">Open a chat to count its tokens</div></div>`;
			const pct = clamp((this.tokens / CONTEXT_LIMIT) * 100, 0, 100);
			let cache;
			if (this.pending) cache = 'generating…';
			else if (this.cachedUntil && this.cachedUntil > now) cache = `cached for <b>${fmtCache(Math.ceil((this.cachedUntil - now) / 1000))}</b>`;
			else cache = 'not cached';
			return `<div class="sec ${level(pct)}"><div class="row"><span class="lbl">This chat<small>~${this.tokens.toLocaleString()} tokens</small></span><span class="pct">${pctText(pct)}</span></div><div class="bar"><div class="fill" style="width:${pct}%"></div></div><div class="line">${cache}</div></div>`;
		}

		render() {
			if (!this._ensure() || !this.box) return;
			this.box.classList.toggle('dark', isDark());
			const now = Date.now();
			let html = `<div class="hd"><span class="logo">${LOGO}</span>`;
			if (this.collapsed) {
				const s = this._session(now);
				let pills = '';
				if (s) pills += `<span class="pill">${fmtDur(s.resets - now)}</span>`;
				if (this.tokens != null) pills += `<span class="pill">~${this.tokens >= 1000 ? (this.tokens / 1000).toFixed(1) + 'k' : this.tokens}</span>`;
				html += `<div class="pills">${pills}</div>`;
			} else {
				html += `<div class="title">Kazoo Counter<small>usage &amp; limits</small></div><span class="btn" data-act="refresh" title="Refresh">↻</span>`;
			}
			html += `<span class="btn" data-act="toggle" title="Collapse / expand">${this.collapsed ? '▴' : '▾'}</span></div>`;

			if (!this.collapsed) {
				html += this._contextBlock(now) + this._sessionBlock(now) + this._weeklyBlock(now);
				const liveMissing = this.usageLoaded && !this._weekly(now) && !(this._session(now) && !this._session(now).estimated);
				if (liveMissing) {
					html += `<div class="note">Live usage % isn't available from claude.ai right now. <u data-act="debug">${this.copied ? 'Copied!' : 'Copy debug info'}</u></div>`;
				}
			}
			this.box.innerHTML = html;
		}
	}

	KZ.ui = { CounterUI };
})();
