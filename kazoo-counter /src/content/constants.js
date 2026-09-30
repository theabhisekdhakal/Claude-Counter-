(() => {
	'use strict';

	const KZ = (globalThis.KazooCounter = globalThis.KazooCounter || {});

	KZ.DOM = Object.freeze({
		CHAT_MENU_TRIGGER: '[data-testid="chat-menu-trigger"]',
		MODEL_SELECTOR_DROPDOWN: '[data-testid="model-selector-dropdown"]',
		CHAT_PROJECT_WRAPPER: '.chat-project-wrapper',
		BRIDGE_SCRIPT_ID: 'kz-bridge-script'
	});

	KZ.CONST = Object.freeze({
		CACHE_WINDOW_MS: 5 * 60 * 1000,
		CONTEXT_LIMIT_TOKENS: 200000
	});

	KZ.TIPS = Object.freeze({
		session: '5-hour session window.\nThe bar shows your usage.\nThe line marks where you are in the window.',
		weekly: '7-day usage window.\nThe bar shows your usage.\nThe line marks where you are in the window.'
	});

	KZ.COLORS = Object.freeze({
		PROGRESS_FILL_DARK: 'linear-gradient(90deg,#a78bfa,#f472b6)',
		PROGRESS_FILL_LIGHT: 'linear-gradient(90deg,#8b5cf6,#ec4899)',
		PROGRESS_OUTLINE_DARK: 'transparent',
		PROGRESS_OUTLINE_LIGHT: 'transparent',
		PROGRESS_MARKER_DARK: '#ffffff',
		PROGRESS_MARKER_LIGHT: '#111111',
		RED_WARNING: 'linear-gradient(90deg,#f87171,#dc2626)',
		BOLD_LIGHT: '#141413',
		BOLD_DARK: '#faf9f5'
	});
})();
