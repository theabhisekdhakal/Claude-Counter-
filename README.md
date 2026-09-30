<div align="center">

<img src="icons/icon128.png" width="96" alt="Kazoo Counter logo">

# Kazoo Counter

**See your Claude usage at a glance.**
Token count, prompt-cache timer, and 5-hour / weekly usage with exact reset times, all in one small card on claude.ai.

![Manifest V3](https://img.shields.io/badge/Manifest-V3-8b5cf6)
![License: MIT](https://img.shields.io/badge/License-MIT-ec4899)
![Chrome / Edge / Brave](https://img.shields.io/badge/Chrome%20%7C%20Edge%20%7C%20Brave-supported-444)

</div>

<!-- Add a screenshot: save it as docs/screenshot.png and uncomment the next line -->
<!-- ![Kazoo Counter screenshot](docs/screenshot.png) -->

## What it shows

One draggable card in the bottom-right corner of [claude.ai](https://claude.ai):

| Section | What you get |
| --- | --- |
| **This chat** | Approximate token count, a bar against the 200k context limit, and the prompt-cache countdown |
| **Session (5-hour)** | Usage %, time used so far, time left, and the exact clock time it resets |
| **Weekly (7-day)** | Usage %, time used, time left, and the reset day and time |

If claude.ai doesn't provide live usage numbers, the session card is **estimated** from the timestamps of your own recent messages and is marked *estimated*.

## Install

Quick version below. For screenshots-free step-by-step help and troubleshooting, see [INSTALL.md](INSTALL.md).

Works in Chrome, Edge, Brave and other Chromium browsers.

1. Download this repo (**Code → Download ZIP**) and unzip it, or `git clone` it.
2. Open `chrome://extensions` (or `edge://extensions`).
3. Turn on **Developer mode**.
4. Click **Load unpacked** and choose the project folder (the one containing `manifest.json`).
5. Open or reload [claude.ai](https://claude.ai). The card appears after a few seconds.

**Firefox (temporary):** open `about:debugging` → *This Firefox* → *Load Temporary Add-on* → select `manifest.json`. Less tested than Chromium.

## How to use it

- **Drag** the card by its header to move it. The position is remembered.
- **▾ / ▴** collapses the card to two small pills (time left in session, tokens in chat).
- **↻** refreshes usage and re-reads your recent chats.
- **Session card:** the big number is time left until your 5-hour window resets. A session starts when you send a message after the previous one ended.
- **Cache timer:** "cached for 2:31" means messages sent in the next 2m 31s reuse the saved copy of your chat, which is cheaper on your limit. After it expires, the next message re-reads the whole chat.
- **"Copy debug info"** appears if claude.ai isn't returning live usage numbers. It copies the raw usage response (numbers only) so you can attach it to an issue.

### Tips for stretching your limit

- Start a new chat when you change topic. Long chats are re-read on every message.
- Reply before the cache timer hits 0:00 when you're mid-task.
- Use a lighter model for easy questions.
- Put the whole task in one message instead of many short ones.

## How it works

- A small script injected into the page watches claude.ai's own requests to read your conversation, the usage endpoint, and the live rate-limit event that arrives with each reply.
- Tokens are counted with a bundled tokenizer (`o200k_base`). This is a **generic tokenizer, so counts are approximate** and can differ from Claude's own.
- Session and weekly numbers come from claude.ai's usage data. If they're missing, the session is estimated as 5 hours from your first message after the previous window ended.

## Limitations

- This is an unofficial tool. It relies on claude.ai's internal, undocumented endpoints, which can change without notice and break parts of it.
- Token counts are estimates. They exclude the system prompt and become inaccurate after context compaction.
- The estimated session is a best guess, and real reset times may be rounded differently.
- Desktop browsers only. It does not run in the Claude mobile or desktop apps.

## Privacy

Everything stays in your browser. Kazoo Counter makes requests only to `claude.ai`, sends nothing anywhere else, and has no analytics or tracking. It reads the `lastActiveOrg` cookie to know which organization's usage to request, and stores only your card position, collapsed state, and timestamps of messages you send (in your browser's local storage).

## Changelog

See [CHANGELOG.md](CHANGELOG.md).

## Project structure

```
manifest.json          Extension manifest (Manifest V3)
icons/                 Logo in several sizes
src/injected/bridge.js Runs in the page: watches requests and fetches data
src/content/
  bridge-client.js     Talks to the injected bridge
  constants.js         Shared constants
  tokens.js            Token counting and cache timing
  ui.js                The floating card
  main.js              Usage parsing, session estimate, wiring
src/vendor/            Bundled tokenizer (see THIRD_PARTY_NOTICES.md)
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Issues and pull requests are welcome. If something looks wrong, open an issue and include your browser, what you expected, and (if shown) the debug info from the card.

## Credits and license

Kazoo Counter is based on the MIT-licensed [Claude Counter](https://github.com/she-llac/claude-counter) and keeps its original copyright notice, as the license requires. Token counting uses a bundled copy of [gpt-tokenizer](https://github.com/niieani/gpt-tokenizer) (MIT), see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

Released under the [MIT License](LICENSE).

*Not affiliated with or endorsed by Anthropic. "Claude" is a trademark of Anthropic.*
