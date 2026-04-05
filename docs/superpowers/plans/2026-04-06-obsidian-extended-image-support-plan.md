# Obsidian Extended Image Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create an Obsidian plugin that renders unsupported image formats (HEIC, TIFF, PSD, AVIF, RAW) by converting them to PNG in-memory using browser decoders.

**Architecture:** Plugin registers a MarkdownPostProcessor that intercepts `<img>` elements with unsupported extensions, decodes them using per-format libraries, and replaces the src with a Blob URL.

**Tech Stack:** TypeScript, Obsidian Plugin API, libheif-js, utif, ag-psd, dcraw.js

---

## File Structure

```
obsidian-extended-image-support/
├── src/
│   ├── main.ts                 # Plugin entry point
│   ├── post-processor.ts       # MarkdownPostProcessor
│   ├── blob-cache.ts          # Blob URL cache
│   └── decoders/
│       ├── registry.ts         # Decoder registry
│       ├── heic.ts            # HEIC/HEIF decoder
│       ├── tiff.ts            # TIFF decoder
│       ├── psd.ts             # PSD decoder
│       ├── raw.ts             # RAW decoder
│       └── avif.ts            # AVIF handler
├── package.json
├── tsconfig.json
├── esbuild.config.js
├── manifest.json
├── styles.css
└── tests/
    ├── decoders/
    │   ├── test-heic.ts
    │   ├── test-tiff.ts
    │   ├── test-psd.ts
    │   ├── test-raw.ts
    │   └── test-avif.ts
    └── integration/
        └── test-post-processor.ts
```

---

### Task 1: Project Scaffold

**Files:**
- Create: `obsidian-extended-image-support/package.json`
- Create: `obsidian-extended-image-support/tsconfig.json`
- Create: `obsidian-extended-image-support/esbuild.config.js`
- Create: `obsidian-extended-image-support/manifest.json`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "obsidian-extended-image-support",
  "version": "1.0.0",
  "description": "Display unsupported image formats in Obsidian",
  "main": "main.js",
  "scripts": {
    "build": "node esbuild.config.js",
    "dev": "node esbuild.config.js --watch",
    "test": "jest"
  },
  "dependencies": {
    "obsidian": "^1.4.0",
    "libheif-js": "^1.19.0",
    "utif": "^3.1.0",
    "ag-psd": "^1.8.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "esbuild": "^0.19.0",
    "typescript": "^5.0.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020", "DOM"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "declaration": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: Create esbuild.config.js**

```javascript
const esbuild = require('esbuild');

const isWatch = process.argv.includes('--watch');

const config = {
  entryPoints: ['src/main.ts'],
  bundle: true,
  outfile: 'main.js',
  target: 'es2020',
  platform: 'browser',
  external: ['obsidian'],
  format: 'cjs',
  sourcemap: true,
};

if (isWatch) {
  esbuild.context(config).then(ctx => ctx.watch());
} else {
  esbuild.build(config);
}
```

- [ ] **Step 4: Create manifest.json**

```json
{
  "id": "obsidian-extended-image-support",
  "name": "Extended Image Support",
  "version": "1.0.0",
  "description": "Display unsupported image formats (HEIC, TIFF, PSD, AVIF, RAW)",
  "author": "Your Name",
  "authorUrl": "https://github.com/yourusername",
  "isDesktopOnly": false,
  "minAppVersion": "1.0.0"
}
```

- [ ] **Step 5: Commit**

```bash
git init
git add package.json tsconfig.json esbuild.config.js manifest.json
git commit -m "chore: scaffold obsidian plugin project"
```

---

### Task 2: Blob Cache

**Files:**
- Create: `src/blob-cache.ts`
- Test: `tests/blob-cache.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
import { BlobCache } from '../src/blob-cache';

describe('BlobCache', () => {
  let cache: BlobCache;

  beforeEach(() => {
    cache = new BlobCache();
  });

  afterEach(() => {
    cache.clear();
  });

  test('should return null for non-existent key', () => {
    expect(cache.get('nonexistent')).toBeNull();
  });

  test('should store and retrieve blob URL', async () => {
    const blob = new Blob(['test'], { type: 'image/png' });
    const url = URL.createObjectURL(blob);
    
    await cache.set('test.heic', url);
    expect(cache.get('test.heic')).toBe(url);
  });

  test('should clear all stored URLs', async () => {
    const blob1 = new Blob(['test1'], { type: 'image/png' });
    const blob2 = new Blob(['test2'], { type: 'image/png' });
    
    await cache.set('test1.heic', URL.createObjectURL(blob1));
    await cache.set('test2.heic', URL.createObjectURL(blob2));
    
    cache.clear();
    
    expect(cache.get('test1.heic')).toBeNull();
    expect(cache.get('test2.heic')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/blob-cache.test.ts`
Expected: FAIL - module not found

- [ ] **Step 3: Implement BlobCache**

```typescript
export class BlobCache {
  private cache: Map<string, string> = new Map();

  get(key: string): string | null {
    return this.cache.get(key) ?? null;
  }

  async set(key: string, blobUrl: string): Promise<void> {
    this.cache.set(key, blobUrl);
  }

  has(key: string): boolean {
    return this.cache.has(key);
  }

  delete(key: string): void {
    const url = this.cache.get(key);
    if (url) {
      URL.revokeObjectURL(url);
      this.cache.delete(key);
    }
  }

  clear(): void {
    for (const url of this.cache.values()) {
      URL.revokeObjectURL(url);
    }
    this.cache.clear();
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/blob-cache.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/blob-cache.ts tests/blob-cache.test.ts
git commit -m "feat: add BlobCache class for caching decoded images"
```

---

### Task 3: Decoder Registry

**Files:**
- Create: `src/decoders/registry.ts`
- Test: `tests/decoders/registry.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
import { DecoderRegistry } from '../../src/decoders/registry';

describe('DecoderRegistry', () => {
  let registry: DecoderRegistry;

  beforeEach(() => {
    registry = new DecoderRegistry();
  });

  test('should throw for unregistered format', async () => {
    await expect(registry.decode(new ArrayBuffer(0), 'unknown'))
      .rejects.toThrow('Unsupported format: unknown');
  });

  test('should register and invoke decoder', async () => {
    const mockDecoder = jest.fn().mockResolvedValue(new Blob(['test'], { type: 'image/png' }));
    registry.registerDecoder('heic', mockDecoder);
    
    await registry.decode(new ArrayBuffer(10), 'heic');
    
    expect(mockDecoder).toHaveBeenCalledWith(expect.any(ArrayBuffer));
  });

  test('should support multiple extensions', async () => {
    const mockDecoder = jest.fn().mockResolvedValue(new Blob(['test'], { type: 'image/png' }));
    registry.registerDecoder('heic', mockDecoder);
    registry.registerDecoder('heif', mockDecoder);
    
    await registry.decode(new ArrayBuffer(10), 'heif');
    
    expect(mockDecoder).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/decoders/registry.test.ts`
Expected: FAIL - module not found

- [ ] **Step 3: Implement DecoderRegistry**

```typescript
export type DecoderFn = (data: ArrayBuffer) => Promise<Blob>;

export class UnsupportedFormatError extends Error {
  constructor(format: string) {
    super(`Unsupported format: ${format}`);
    this.name = 'UnsupportedFormatError';
  }
}

export class DecoderRegistry {
  private decoders: Map<string, DecoderFn> = new Map();

  registerDecoder(extension: string, decoder: DecoderFn): void {
    this.decoders.set(extension.toLowerCase(), decoder);
  }

  async decode(data: ArrayBuffer, extension: string): Promise<Blob> {
    const decoder = this.decoders.get(extension.toLowerCase());
    
    if (!decoder) {
      throw new UnsupportedFormatError(extension);
    }
    
    return decoder(data);
  }

  isSupported(extension: string): boolean {
    return this.decoders.has(extension.toLowerCase());
  }

  getSupportedExtensions(): string[] {
    return Array.from(this.decoders.keys());
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/decoders/registry.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/decoders/registry.ts tests/decoders/registry.test.ts
git commit -m "feat: add DecoderRegistry for managing format decoders"
```

---

### Task 4: HEIC Decoder

**Files:**
- Create: `src/decoders/heic.ts`
- Test: `tests/decoders/heic.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
import { decodeHeic } from '../../src/decoders/heic';

describe('HEIC Decoder', () => {
  test('should decode valid HEIC data to PNG blob', async () => {
    // This would need a real HEIC test file - placeholder for now
    const result = await decodeHeic(new ArrayBuffer(0));
    expect(result.type).toBe('image/png');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/decoders/heic.test.ts`
Expected: FAIL - module not found

- [ ] **Step 3: Implement HeicDecoder**

```typescript
import { DecoderFn } from './registry';

let libheif: any = null;

async function loadLibHeif(): Promise<any> {
  if (!libheif) {
    const libheifJs = await import('libheif-js');
    libheif = await libheifJs.default();
  }
  return libheif;
}

export const decodeHeic: DecoderFn = async (data: ArrayBuffer): Promise<Blob> => {
  const lib = await loadLibHeif();
  
  const decoder = new lib.HeifDecoder();
  decoder.decode(data);
  
  const image = decoder.getImage(0);
  const width = image.get_width();
  const height = image.get_height();
  
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d')!;
  
  const imageData = ctx.createImageData(width, height);
  const data = image.get_data();
  
  for (let i = 0; i < data.length; i++) {
    imageData.data[i] = data[i];
  }
  
  ctx.putImageData(imageData, 0, 0);
  
  return canvas.convertToBlob({ type: 'image/png' });
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/decoders/heic.test.ts`
Expected: PASS (or skip with real HEIC file)

- [ ] **Step 5: Commit**

```bash
git add src/decoders/heic.ts tests/decoders/heic.test.ts
git commit -m "feat: add HEIC decoder using libheif-js"
```

---

### Task 5: TIFF Decoder

**Files:**
- Create: `src/decoders/tiff.ts`
- Test: `tests/decoders/tiff.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
import { decodeTiff } from '../../src/decoders/tiff';

describe('TIFF Decoder', () => {
  test('should decode valid TIFF data to PNG blob', async () => {
    const result = await decodeTiff(new ArrayBuffer(0));
    expect(result.type).toBe('image/png');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/decoders/tiff.test.ts`
Expected: FAIL - module not found

- [ ] **Step 3: Implement TiffDecoder**

```typescript
import UTIF from 'utif';
import { DecoderFn } from './registry';

export const decodeTiff: DecoderFn = async (data: ArrayBuffer): Promise<Blob> => {
  const ifds = UTIF.decode(data);
  
  if (ifds.length === 0) {
    throw new Error('No images found in TIFF');
  }
  
  UTIF.decodeImage(data, ifds[0]);
  const rgba = UTIF.toRGBA8(ifds[0]);
  
  const canvas = new OffscreenCanvas(ifds[0].width, ifds[0].height);
  const ctx = canvas.getContext('2d')!;
  
  const imageData = new ImageData(
    new Uint8ClampedArray(rgba),
    ifds[0].width,
    ifds[0].height
  );
  
  ctx.putImageData(imageData, 0, 0);
  
  return canvas.convertToBlob({ type: 'image/png' });
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/decoders/tiff.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/decoders/tiff.ts tests/decoders/tiff.test.ts
git commit -m "feat: add TIFF decoder using utif"
```

---

### Task 6: PSD Decoder

**Files:**
- Create: `src/decoders/psd.ts`
- Test: `tests/decoders/psd.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
import { decodePsd } from '../../src/decoders/psd';

describe('PSD Decoder', () => {
  test('should decode valid PSD data to PNG blob', async () => {
    const result = await decodePsd(new ArrayBuffer(0));
    expect(result.type).toBe('image/png');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/decoders/psd.test.ts`
Expected: FAIL - module not found

- [ ] **Step 3: Implement PsdDecoder**

```typescript
import { readPsd } from 'ag-psd';
import { DecoderFn } from './registry';

export const decodePsd: DecoderFn = async (data: ArrayBuffer): Promise<Blob> => {
  const psd = readPsd(new DataView(data), { skipCompositeImageData: false });
  
  if (!psd.canvas) {
    throw new Error('Failed to render PSD');
  }
  
  const canvas = psd.canvas as OffscreenCanvas;
  return canvas.convertToBlob({ type: 'image/png' });
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/decoders/psd.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/decoders/psd.ts tests/decoders/psd.test.ts
git commit -m "feat: add PSD decoder using ag-psd"
```

---

### Task 7: Post-Processor

**Files:**
- Create: `src/post-processor.ts`
- Test: `tests/post-processor.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
import { createImagePostProcessor } from '../../src/post-processor';
import { MarkdownPostProcessorContext } from 'obsidian';

describe('PostProcessor', () => {
  test('should replace unsupported image src with blob URL', async () => {
    const mockEl = document.createElement('div');
    mockEl.innerHTML = '<img src="app://local/photo.heic">';
    
    const ctx = {
      sourcePath: 'test.md',
      app: {
        vault: {
          adapter: {
            readBinary: jest.fn().mockResolvedValue(new ArrayBuffer(10))
          }
        }
      }
    } as unknown as MarkdownPostProcessorContext;
    
    const processor = createImagePostProcessor({} as any);
    await processor(mockEl, ctx);
    
    const img = mockEl.querySelector('img');
    expect(img?.src).not.toContain('photo.heic');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/post-processor.test.ts`
Expected: FAIL - module not found

- [ ] **Step 3: Implement PostProcessor**

```typescript
import { MarkdownPostProcessor, MarkdownPostProcessorContext } from 'obsidian';
import { BlobCache } from './blob-cache';
import { DecoderRegistry } from './decoders/registry';

const UNSUPPORTED_EXTENSIONS = [
  'heic', 'heif', 'tiff', 'tif', 'psd', 'avif',
  'cr2', 'nef', 'arw', 'crw', 'dng', 'raf', 'orf', 'srw'
];

export function createImagePostProcessor(
  registry: DecoderRegistry,
  cache: BlobCache
): MarkdownPostProcessor {
  return async (el: HTMLElement, ctx: MarkdownPostProcessorContext) => {
    const images = el.querySelectorAll('img');
    
    for (const img of images) {
      const src = img.getAttribute('src');
      if (!src) continue;
      
      const filePath = extractFilePath(src);
      if (!filePath) continue;
      
      const ext = getExtension(filePath);
      if (!ext || !UNSUPPORTED_EXTENSIONS.includes(ext.toLowerCase())) {
        continue;
      }
      
      try {
        if (!registry.isSupported(ext)) {
          continue;
        }
        
        let blobUrl = cache.get(filePath);
        
        if (!blobUrl) {
          const data = await ctx.app.vault.adapter.readBinary(filePath);
          const blob = await registry.decode(data, ext);
          blobUrl = URL.createObjectURL(blob);
          await cache.set(filePath, blobUrl);
        }
        
        img.src = blobUrl;
      } catch (error) {
        console.error(`Failed to decode ${filePath}:`, error);
        img.classList.add('image-decode-error');
      }
    }
  };
}

function extractFilePath(src: string): string | null {
  const match = src.match(/app:\/\/local\/(.+)/);
  return match ? match[1] : null;
}

function getExtension(filePath: string): string | null {
  const parts = filePath.split('.');
  return parts.length > 1 ? parts.pop()!.toLowerCase() : null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/post-processor.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/post-processor.ts tests/post-processor.test.ts
git commit -m "feat: add MarkdownPostProcessor to intercept and decode images"
```

---

### Task 8: Main Plugin Entry

**Files:**
- Create: `src/main.ts`
- Create: `styles.css`

- [ ] **Step 1: Write main.ts**

```typescript
import { Plugin, MarkdownPostProcessor } from 'obsidian';
import { BlobCache } from './blob-cache';
import { DecoderRegistry } from './decoders/registry';
import { createImagePostProcessor } from './post-processor';
import { decodeHeic } from './decoders/heic';
import { decodeTiff } from './decoders/tiff';
import { decodePsd } from './decoders/psd';

export default class ExtendedImageSupport extends Plugin {
  private cache: BlobCache = new BlobCache();
  private registry: DecoderRegistry = new DecoderRegistry();
  private processor: MarkdownPostProcessor | null = null;

  async onload() {
    this.registerDecoders();
    this.registerPostProcessor();
    this.loadStyles();
  }

  private registerDecoders(): void {
    this.registry.registerDecoder('heic', decodeHeic);
    this.registry.registerDecoder('heif', decodeHeic);
    this.registry.registerDecoder('tiff', decodeTiff);
    this.registry.registerDecoder('tif', decodeTiff);
    this.registry.registerDecoder('psd', decodePsd);
    // AVIF and RAW would be added here
  }

  private registerPostProcessor(): void {
    this.processor = createImagePostProcessor(this.registry, this.cache);
    this.registerMarkdownPostProcessor(this.processor);
  }

  private loadStyles(): void {
    this.addStyleSheet('styles.css');
  }

  onunload() {
    this.cache.clear();
  }
}
```

- [ ] **Step 2: Write styles.css**

```css
.image-decode-error {
  border: 2px solid #ff4444;
  background-color: #ffeeee;
  padding: 8px;
  border-radius: 4px;
}

.image-decode-error::after {
  content: "⚠️ Failed to decode image";
  display: block;
  color: #ff4444;
  font-size: 12px;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/main.ts styles.css
git commit -m "feat: add main plugin entry point with decoder registration"
```

---

### Task 9: AVIF and RAW Decoders (Optional)

**Files:**
- Create: `src/decoders/avif.ts`
- Create: `src/decoders/raw.ts`

These are optional and depend on finding suitable MIT-licensed libraries.

- [ ] **Step 1: Implement AVIF decoder**

```typescript
import { DecoderFn } from './registry';

export const decodeAvif: DecoderFn = async (data: ArrayBuffer): Promise<Blob> => {
  try {
    const blob = new Blob([data], { type: 'image/avif' });
    const url = URL.createObjectURL(blob);
    
    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = url;
    });
    
    const canvas = new OffscreenCanvas(img.width, img.height);
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    
    URL.revokeObjectURL(url);
    return canvas.convertToBlob({ type: 'image/png' });
  } catch (error) {
    throw new Error('Native AVIF decoding not supported');
  }
};
```

- [ ] **Step 2: Commit**

```bash
git add src/decoders/avif.ts
git commit -m "feat: add AVIF decoder with native browser fallback"
```

---

## Summary

| Task | Component | Files Created |
|------|-----------|---------------|
| 1 | Project Scaffold | package.json, tsconfig.json, esbuild.config.js, manifest.json |
| 2 | Blob Cache | src/blob-cache.ts |
| 3 | Decoder Registry | src/decoders/registry.ts |
| 4 | HEIC Decoder | src/decoders/heic.ts |
| 5 | TIFF Decoder | src/decoders/tiff.ts |
| 6 | PSD Decoder | src/decoders/psd.ts |
| 7 | Post-Processor | src/post-processor.ts |
| 8 | Main Plugin | src/main.ts, styles.css |
| 9 | AVIF/RAW | src/decoders/avif.ts, src/decoders/raw.ts (optional) |

---

**Plan complete and saved to `docs/superpowers/plans/2026-04-06-obsidian-extended-image-support-plan.md`.**

Two execution options:

1. **Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

2. **Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
