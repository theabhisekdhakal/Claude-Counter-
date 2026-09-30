# Kazoo Counter

One small card on claude.ai (bottom-right, draggable, collapsible) showing:

- **This chat** - approximate token count, context bar (200k), prompt-cache timer
- **Session (5-hour)** - usage %, time used so far, time left, exact clock time it resets
- **Weekly (7-day)** - usage %, time used, time left, reset day and time
- If claude.ai doesn't give live usage numbers, the session card is estimated from the timestamps of your own messages (marked "estimated").

## Install (Chrome / Edge / Brave)
1. Unzip the folder.
2. Open chrome://extensions and turn on Developer mode.
3. Click "Load unpacked" and choose the folder.
4. Reload claude.ai.

## Privacy
Everything stays in your browser. Requests only go to claude.ai.

## Credits / License
Based on the MIT-licensed Claude Counter (github.com/she-llac/claude-counter). Token counting uses a vendored copy of gpt-tokenizer (MIT) - see THIRD_PARTY_NOTICES.md. MIT licensed, see LICENSE.
