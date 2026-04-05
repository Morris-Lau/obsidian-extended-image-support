# Design: Obsidian Extended Image Support Plugin

## Overview

An Obsidian plugin that adds support for image formats not natively rendered by Obsidian: HEIC/HEIF, TIFF, PSD, AVIF, and RAW camera formats (CR2, NEF, ARW, etc.). Uses on-the-fly rendering with dedicated browser-compatible decoders per format.

## Supported Formats

| Format | Extensions | Decoder Library | Type |
|--------|-----------|-----------------|------|
| HEIC/HEIF | .heic, .heif | libheif-js | WASM |
| TIFF | .tiff, .tif | utif | Pure JS |
| PSD | .psd | ag-psd | TypeScript |
| AVIF | .avif | Browser native (fallback: WASM) | Native/WASM |
| RAW | .cr2, .nef, .arw, .crw, .dng, .raf, .orf, .srw | dcraw.js | WASM |

## Architecture

### Core Flow

1. Obsidian renders markdown containing an image embed
2. Plugin's MarkdownPostProcessor detects unsupported file extensions in `<img>` elements
3. Plugin reads the file as ArrayBuffer from vault
4. Routes to the appropriate decoder based on file extension
5. Decoder returns raw pixel data, rendered to PNG Blob
6. Plugin creates a Blob URL and replaces the `<img>` src
7. Result is cached to avoid re-decoding

### Interception Strategy

- **MarkdownPostProcessor**: Catches `<img>` elements after Obsidian renders markdown in both Reading View and Live Preview
- **Blob URL replacement**: Replaces `src` attribute with a dynamically generated blob URL pointing to decoded PNG data
- **File adapter**: Uses `app.vault.adapter.readBinary()` to read file contents

## Components

### `main.ts` — Plugin Entry Point

- Extends `Plugin`
- On `onload`: registers the MarkdownPostProcessor
- On `onenable`: initializes decoder registry and blob cache
- On `ondisable`: revokes all blob URLs, clears cache
- Loads `styles.css` for loading/error UI states

### `decoders/registry.ts` — Decoder Registry

- Maps file extensions to decoder functions
- `registerDecoder(ext: string, handler: DecoderFn)`: registers a decoder for an extension
- `async decode(file: ArrayBuffer, ext: string): Promise<Blob>`: routes to correct decoder
- Pre-registers all decoders on initialization
- Throws `UnsupportedFormatError` for unregistered extensions

### `decoders/heic.ts` — HEIC/HEIF Decoder

- Imports `libheif-js`
- `LibHeif.decode(arrayBuffer)` returns raw pixel data
- Draws to offscreen canvas, exports as PNG Blob
- Handles multi-image HEIC files (uses first image)

### `decoders/tiff.ts` — TIFF Decoder

- Imports `utif`
- `UTIF.decode(arrayBuffer)` returns IFD entries
- `UTIF.decodeImage(arrayBuffer, ifd)` decodes pixel data
- `UTIF.toRGBA8(ifd)` converts to displayable format
- Handles multi-page TIFF files (uses first page)

### `decoders/psd.ts` — PSD Decoder

- Imports `ag-psd`
- `readPsd(arrayBuffer, { skipCompositeImageData: false })` returns composite image
- Renders to canvas, exports as PNG Blob
- Warns on unsupported PSD features (e.g., certain blend modes)

### `decoders/raw.ts` — RAW Decoder

- Imports `dcraw.js`
- `dcraw(arrayBuffer)` returns decoded pixel data
- Supports: CR2, NEF, ARW, CRW, DNG, RAF, ORF, SRW
- Exports as PNG Blob

### `decoders/avif.ts` — AVIF Handler

- First attempts native browser support (Electron in Obsidian Desktop supports AVIF)
- If native fails, falls back to WASM-based AVIF decoder
- On mobile, always uses decoder library

### `post-processor.ts` — MarkdownPostProcessor

- Implements `MarkdownPostProcessor` interface
- `processor(el: HTMLElement, ctx: MarkdownPostProcessorContext)`:
  - Queries all `<img>` elements in the rendered element
  - Extracts file path from `src` attribute
  - Checks extension against supported formats
  - Calls `blobCache.getOrDecode(path)` 
  - Replaces `src` with blob URL on success
  - Shows error state on failure
- Handles both Reading and Live Preview modes

### `blob-cache.ts` — Blob URL Cache

- `Map<string, string>`: file path → blob URL
- `async getOrDecode(path: string): Promise<string>`:
  - Cache hit → return existing blob URL
  - Cache miss → decode file, create blob URL, store, return
- `revoke(path: string)`: revokes blob URL, removes from cache
- `clear()`: revokes all blob URLs, clears map
- Listens to vault file change events to invalidate cache entries

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Decode failure | Show error overlay on image with message and fallback link to original file |
| WASM load failure | Log to console, show error state, do not crash |
| Corrupt/unrecognized file | Catch error, show error overlay with "Failed to decode" message |
| Mobile OOM | Catch error, suggest external conversion |
| File not found | Show broken image with file path |

## Plugin Structure

```
obsidian-extended-image-support/
├── src/
│   ├── main.ts                 # Plugin entry
│   ├── post-processor.ts       # MarkdownPostProcessor
│   ├── blob-cache.ts           # Blob URL cache
│   └── decoders/
│       ├── registry.ts         # Decoder registry
│       ├── heic.ts             # HEIC/HEIF decoder
│       ├── tiff.ts             # TIFF decoder
│       ├── psd.ts              # PSD decoder
│       ├── raw.ts              # RAW decoder
│       └── avif.ts             # AVIF handler
├── package.json
├── tsconfig.json
├── esbuild.config.js           # Bundler config
├── manifest.json               # Obsidian plugin manifest
└── styles.css                  # Loading/error states
```

## Dependencies

| Package | Purpose | License |
|---------|---------|---------|
| obsidian | Plugin SDK | MIT |
| libheif-js | HEIC/HEIF decoding | LGPL |
| utif | TIFF decoding | MIT |
| ag-psd | PSD decoding | MIT |
| dcraw | RAW decoding | GPL-2.0 |

## Performance Considerations

- **Lazy loading**: Decoder libraries are imported on first use, not at plugin load
- **Caching**: Decoded images are cached as blob URLs, never re-decoded unless file changes
- **Offscreen canvas**: Decoding happens off the main rendering path to avoid layout thrashing
- **Memory**: Blob URLs are revoked on plugin disable and file deletion

## Testing Strategy

- Unit tests for each decoder with sample files
- Integration test for post-processor intercepting image elements
- Manual testing with real HEIC, TIFF, PSD, AVIF, and RAW files in Obsidian vault
