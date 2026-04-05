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
  
  // Handle vault root paths like /photo.heic or assets/photo.heic
  if (src.startsWith('/')) {
    return decodeURIComponent(src.slice(1));
  }
  
  // Handle relative paths like assets/photo.heic
  if (src.includes('/') || src.includes('\\')) {
    return decodeURIComponent(src);
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

async function processEmbed(
  el: HTMLElement,
  app: App,
  registry: DecoderRegistry,
  cache: BlobCache
): Promise<void> {
  const src = el.getAttribute('src');
  if (!src) return;

  const filePath = extractFilePath(src);
  if (!filePath) return;

  const extension = getExtension(filePath);
  if (!extension) return;

  if (!UNSUPPORTED_EXTENSIONS.includes(extension)) return;
  if (!registry.isSupported(extension)) return;

  if (el.classList.contains('processed')) return;

  try {
    let blobUrl = cache.get(filePath);

    if (!blobUrl) {
      let file = app.vault.getAbstractFileByPath(filePath);
      
      if (!file) {
        const normalized = filePath.replace(/\\/g, '/');
        file = app.vault.getAbstractFileByPath(normalized);
      }
      
      if (!file) {
        const fileName = filePath.split('/').pop() || '';
        file = await findFileByName(app, fileName);
      }
      
      if (!file) {
        el.classList.add('image-decode-error');
        return;
      }
      
      const data = await app.vault.readBinary(file);
      const blob = await registry.decode(data, extension);
      blobUrl = URL.createObjectURL(blob);
      await cache.set(filePath, blobUrl);
    }

    el.replaceWith(createImg(blobUrl, src));
  } catch (error) {
    console.error('[Extended Image Support] Failed to decode:', filePath, error);
    el.classList.add('image-decode-error');
  }
}

async function findFileByName(app: App, fileName: string): Promise<any> {
  const root = app.vault.root;
  
  function searchFolder(folder: any): any {
    if (!folder.children) return null;
    
    for (const child of folder.children) {
      if (child.name.toLowerCase() === fileName.toLowerCase()) {
        return child;
      }
      if (child.children) {
        const found = searchFolder(child);
        if (found) return found;
      }
    }
    return null;
  }
  
  return searchFolder(root);
}

function createImg(src: string, alt: string): HTMLImageElement {
  const img = document.createElement('img');
  img.src = src;
  img.alt = alt;
  img.classList.add('processed');
  return img;
}

export function createImagePostProcessor(
  app: App,
  registry: DecoderRegistry,
  cache: BlobCache
): MarkdownPostProcessor {
  const processor = async (el: HTMLElement, ctx: MarkdownPostProcessorContext): Promise<void> => {
    await processAllImagesInElement(el, app, registry, cache);

    const observer = new MutationObserver(async (mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node instanceof HTMLElement) {
            // Process internal embeds
            const embeds = node instanceof HTMLElement 
              ? [node] 
              : [];
            for (const embed of embeds) {
              if (embed.classList?.contains('internal-embed')) {
                await processEmbed(embed, app, registry, cache);
              }
            }
            // Also process img inside added nodes
            const images = Array.from(node.querySelectorAll('img'));
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
  if (!registry.isSupported(extension)) return;

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
    console.error('[Extended Image Support] Failed to decode:', filePath, error);
    img.classList.add('image-decode-error');
  }
}

export async function processAllImagesInElement(
  el: HTMLElement,
  app: App,
  registry: DecoderRegistry,
  cache: BlobCache
): Promise<void> {
  // Process internal embeds (like ![[file.heic]])
  const embeds = Array.from(el.querySelectorAll('.internal-embed'));
  for (const embed of embeds) {
    await processEmbed(embed, app, registry, cache);
  }
  
  // Also process regular img elements
  const images = Array.from(el.querySelectorAll('img'));
  for (const img of images) {
    await processImage(img, app, registry, cache);
  }
}
