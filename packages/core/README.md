# @kidar/core

Shared types, plan/settings helpers, M4 storage contracts, MindAR/popout
validation, and **M4.4a local render generators**.

## M4.4a — local AR / print generators

Pure, fully testable utilities (no uploads, no consumer routes, no worker job
execution):

| API | Module | Output |
| --- | --- | --- |
| `renderArPage(config)` | `templates/ar-page` | Standalone MindAR + A-Frame HTML |
| `generateArQrPng(url)` | `print/qr` | QR PNG bytes |
| `generateA4PrintPdf(input)` | `print/pdf` | A4 portrait PDF bytes |

**M4.4b** owns public immutable writes (R2/CDN or a separate public Appwrite
bucket). This package does not publish artifacts, serve `/ar/:slug`, or mark
`page_render` jobs done.

### Camera / audio gating

- MindAR uses `autoStart: false`; `arSystem.start()` runs only on Start click
  (`Pornește experiența AR`).
- Optional audio plays on MindAR `targetFound` and pauses on `targetLost`
  (never autoplay on load or Start alone).

### CDN pins

Aligned with the M4.3 compiler (`mind-ar@1.2.5`) and upstream image-tracking
examples:

- A-Frame `1.5.0` from `aframe.io`
- `mindar-image-aframe.prod.js` from jsDelivr `mind-ar@1.2.5`

### CSP

The generated page sets a strict CSP (`default-src 'none'`). `script-src`
includes `'unsafe-inline'` for the Start/audio boot script and
`'wasm-unsafe-eval'` so MindAR/TFJS can compile WebAssembly. It does **not**
include `'unsafe-eval'`. `blob:` is limited to `worker-src`/`child-src`
(MindAR/A-Frame blob workers) and `media-src`/`img-src` (camera object URLs
and canvas snapshots), not `default-src`.

### PDF text note

A4 PDFs use Helvetica (WinAnsi). Romanian diacritics in the instruction /
watermark are folded to ASCII-compatible Latin at draw time so print stays
self-contained without bundling a Unicode font (M4.4a scope).
