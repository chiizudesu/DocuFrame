// Utility helpers for matching keyboard events against user-configurable shortcuts

export interface ParsedShortcut {
	needCtrl: boolean;
	needAlt: boolean;
	needShift: boolean;
	needMeta: boolean;
	needCommandOrControl: boolean; // VS Code-like semantics
	key: string | null; // Normalized (e.g., 'f1', 'q', '`')
}

export function parseShortcut(shortcutRaw: string | undefined | null): ParsedShortcut {
	const shortcut = (shortcutRaw || '').replace(/\s+/g, '');
	const parts = shortcut.split('+').filter(Boolean);
	let needCtrl = false;
	let needAlt = false;
	let needShift = false;
	let needMeta = false;
	let needCommandOrControl = false;
	let key: string | null = null;

	for (const part of parts) {
		switch (part.toLowerCase()) {
			case 'ctrl':
			case 'control':
				needCtrl = true;
				break;
			case 'alt':
				needAlt = true;
				break;
			case 'shift':
				needShift = true;
				break;
			case 'meta':
			case 'cmd':
			case 'command':
				needMeta = true;
				break;
			case 'commandorcontrol':
				needCommandOrControl = true;
				break;
			default:
				key = part.toLowerCase();
		}
	}

	return { needCtrl, needAlt, needShift, needMeta, needCommandOrControl, key };
}

export function eventMatchesShortcut(event: KeyboardEvent, shortcutRaw: string | undefined | null): boolean {
	if (!shortcutRaw) return false;
	const parsed = parseShortcut(shortcutRaw);

	// Check modifiers
	if (parsed.needCommandOrControl) {
		if (!(event.ctrlKey || event.metaKey)) return false;
	} else {
		if (parsed.needCtrl !== event.ctrlKey) return false;
		if (parsed.needMeta !== event.metaKey) return false;
	}
	if (parsed.needAlt !== event.altKey) return false;
	if (parsed.needShift !== event.shiftKey) return false;

	// If no key specified, just modifiers
	if (!parsed.key) return true;

	const key = parsed.key;
	const eventKey = event.key;

	// Handle function keys (F1..F24)
	if (/^f\d{1,2}$/.test(key)) {
		return eventKey.toUpperCase() === key.toUpperCase();
	}

	// Handle special keys like backtick `
	if (key === '`') {
		return eventKey === '`';
	}

	// Normal character key
	return eventKey.toLowerCase() === key.toLowerCase();
}


