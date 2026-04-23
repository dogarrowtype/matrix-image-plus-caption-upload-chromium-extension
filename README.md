# Matrix Image + Caption

A Chromium extension that sends an image and caption as a **single combined Matrix message** (`m.image` with `body` text).

## Why

Some Matrix clients send image attachments and their accompanying text as two separate messages. Some Matrix bots expect a single `m.room.message` event where the image URL and caption coexist — two messages confuse them. This extension exists as a workaround, producing exactly that format.

## Install

1. Open `chrome://extensions`
2. Enable **Developer mode** (toggle, top-right)
3. Click **Load unpacked** → select this folder
4. The camera icon appears in the toolbar

## Setup

Click the ⚙ gear in the popup (or right-click the toolbar icon → Options) and enter:

- **Homeserver URL** — e.g. `https://matrix.example.org`
- **Access Token** — get it from your Matrix client:
  - **Element**: Settings → Help & About → Advanced → Access Token
  - **FluffyChat**: Settings → Account → Access Token

Credentials are stored in `chrome.storage.local`, sandboxed to this extension.

## Usage

1. Click the extension icon
2. Drop, paste (Cmd+V / Ctrl+V), or click to browse for an image
3. Type a caption
4. The Room ID field auto-fills from last use — change it if needed
5. Hit **Send**

Upload progress and speed are shown in real time. On success the form resets after 2 seconds.

## Notes

- No encryption support (by design — the target room is unencrypted)
- No build step, no npm, no external dependencies — pure vanilla JS
- Matrix REST API used directly (`/_matrix/media/v3/upload` + `/_matrix/client/v3/rooms/{id}/send/…`)

---

*This project was created by [Claude Sonnet 4.6](https://www.anthropic.com/claude) (Anthropic), a large language model, at the direction of the repository owner.*
