import type { MarkdownPostProcessor, MarkdownPostProcessorContext, App } from 'obsidian';
import { DecoderRegistry } from './decoders/registry';
import { BlobCache } from './blob-cache';

const UNSUPPORTED_EXTENSIONS = [
  'heic', 'heif', 'tiff', 'tif', 'psd', 'avif',
  'cr2', 'nef', 'arw', 'crw', 'dng', 'raf', 'orf', 'srw'
];

function extractFilePath(src: string): string | null {
  const prefix = 'app://local/';
  if (src.startsWith(prefix)) {
    return decodeURIComponent(src.slice(prefix.length));
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

export function createImagePostProcessor(
  app: App,
  registry: DecoderRegistry,
  cache: BlobCache
): MarkdownPostProcessor {
  const processor = async (el: HTMLElement, ctx: MarkdownPostProcessorContext): Promise<void> => {
    const images = Array.from(el.querySelectorAll('img'));
    
    for (const img of images) {
      const src = img.getAttribute('src');
      if (!src) continue;

      const filePath = extractFilePath(src);
      if (!filePath) continue;

      const extension = getExtension(filePath);
      if (!extension) continue;

      if (!UNSUPPORTED_EXTENSIONS.includes(extension)) continue;
      if (!registry.isSupported(extension)) continue;

      try {
        let blobUrl = cache.get(filePath);

        if (!blobUrl) {
          const data = await app.vault.adapter.readBinary(filePath);
          const blob = await registry.decode(data, extension);
          blobUrl = URL.createObjectURL(blob);
          await cache.set(filePath, blobUrl);
        }

        img.src = blobUrl;
      } catch (error) {
        img.classList.add('image-decode-error');
      }
    }
  };

  return processor;
}
