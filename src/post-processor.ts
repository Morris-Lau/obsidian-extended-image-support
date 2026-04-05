import type { MarkdownPostProcessor, MarkdownPostProcessorContext, App } from 'obsidian';
import { DecoderRegistry } from './decoders/registry';
import { BlobCache } from './blob-cache';

const UNSUPPORTED_EXTENSIONS = [
  'heic', 'heif', 'tiff', 'tif', 'psd', 'avif',
  'cr2', 'nef', 'arw', 'crw', 'dng', 'raf', 'orf', 'srw'
];

function extractFilePath(src: string): string | null {
  // Handle app://local/ URLs
  const localPrefix = 'app://local/';
  if (src.startsWith(localPrefix)) {
    return decodeURIComponent(src.slice(localPrefix.length));
  }
  
  // Handle obsidian://localhost/ URLs  
  const obsidianPrefix = 'obsidian://localhost/';
  if (src.startsWith(obsidianPrefix)) {
    return decodeURIComponent(src.slice(obsidianPrefix.length));
  }
  
  // Handle vault root paths like /photo.heic
  if (src.startsWith('/')) {
    return decodeURIComponent(src.slice(1));
  }
  
  return null;
}

function getExtension(filePath: string): string | null {
  const lastDot = filePath.lastIndexOf('.');
  if (lastDot === -1 || lastDot === 0) {
    return null;
  }
  return filePath.slice(lastDot + 1).toLowerCase();
}

async function processImage(
  img: HTMLImageElement,
  app: App,
  registry: DecoderRegistry,
  cache: BlobCache
): Promise<void> {
  const src = img.getAttribute('src');
  if (!src) return;
  
  if (img.src.startsWith('blob:')) return;

  const filePath = extractFilePath(src);
  if (!filePath) return;

  const extension = getExtension(filePath);
  if (!extension) return;

  if (!UNSUPPORTED_EXTENSIONS.includes(extension)) return;
  if (!registry.isSupported(extension)) {
    console.log('[Extended Image Support] Unsupported format:', extension);
    return;
  }

  try {
    let blobUrl = cache.get(filePath);

    if (!blobUrl) {
      console.log('[Extended Image Support] Decoding:', filePath);
      const data = await app.vault.adapter.readBinary(filePath);
      const blob = await registry.decode(data, extension);
      blobUrl = URL.createObjectURL(blob);
      await cache.set(filePath, blobUrl);
      console.log('[Extended Image Support] Decoded successfully:', filePath);
    }

    img.src = blobUrl;
  } catch (error) {
    console.error('[Extended Image Support] Failed to decode:', filePath, error);
    img.classList.add('image-decode-error');
  }
}

export function createImagePostProcessor(
  app: App,
  registry: DecoderRegistry,
  cache: BlobCache
): MarkdownPostProcessor {
  const processor = async (el: HTMLElement, ctx: MarkdownPostProcessorContext): Promise<void> => {
    // Process existing images
    const images = Array.from(el.querySelectorAll('img'));
    for (const img of images) {
      await processImage(img, app, registry, cache);
    }

    // Set up MutationObserver for dynamically added images
    const observer = new MutationObserver(async (mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node instanceof HTMLElement) {
            const images = node instanceof HTMLImageElement 
              ? [node] 
              : Array.from(node.querySelectorAll('img'));
            for (const img of images) {
              await processImage(img, app, registry, cache);
            }
          }
        }
      }
    });

    observer.observe(el, { childList: true, subtree: true });
  };

  return processor;
}
