import type { MarkdownPostProcessor, MarkdownPostProcessorContext, App } from 'obsidian';
import { DecoderRegistry } from './decoders/registry';
import { BlobCache } from './blob-cache';

const UNSUPPORTED_EXTENSIONS = [
  'heic', 'heif', 'tiff', 'tif', 'psd', 'avif',
  'cr2', 'nef', 'arw', 'crw', 'dng', 'raf', 'orf', 'srw'
];

function extractFilePath(src: string): string | null {
  console.log('[Extended Image Support] extractFilePath called, src:', src);
  
  // Handle app://local/ URLs
  const localPrefix = 'app://local/';
  if (src.startsWith(localPrefix)) {
    const result = decodeURIComponent(src.slice(localPrefix.length));
    console.log('[Extended Image Support] Extracted from app://local/:', result);
    return result;
  }
  
  // Handle obsidian://localhost/ URLs  
  const obsidianPrefix = 'obsidian://localhost/';
  if (src.startsWith(obsidianPrefix)) {
    const result = decodeURIComponent(src.slice(obsidianPrefix.length));
    console.log('[Extended Image Support] Extracted from obsidian://localhost/:', result);
    return result;
  }
  
  // Handle vault root paths like /photo.heic or assets/photo.heic
  if (src.startsWith('/')) {
    const result = decodeURIComponent(src.slice(1));
    console.log('[Extended Image Support] Extracted from root path:', result);
    return result;
  }
  
  // Handle relative paths like assets/photo.heic
  if (src.includes('/') || src.includes('\\')) {
    console.log('[Extended Image Support] Extracted relative path:', src);
    return decodeURIComponent(src);
  }
  
  console.log('[Extended Image Support] Could not extract file path from:', src);
  return null;
}

function getExtension(filePath: string): string | null {
  const lastDot = filePath.lastIndexOf('.');
  if (lastDot === -1 || lastDot === 0) {
    return null;
  }
  return filePath.slice(lastDot + 1).toLowerCase();
}

export async function processEmbed(
  el: HTMLElement,
  app: App,
  registry: DecoderRegistry,
  cache: BlobCache
): Promise<void> {
  console.log('[Extended Image Support] ========== processEmbed called ==========');
  console.log('[Extended Image Support] element:', el.tagName, 'class:', el.className);
  
  const src = el.getAttribute('src');
  console.log('[Extended Image Support] src attribute:', src);
  if (!src) {
    console.log('[Extended Image Support] No src attribute, returning');
    return;
  }

  const filePath = extractFilePath(src);
  if (!filePath) {
    console.log('[Extended Image Support] Could not extract file path, returning');
    return;
  }

  const extension = getExtension(filePath);
  console.log('[Extended Image Support] extension:', extension);
  if (!extension) {
    console.log('[Extended Image Support] No extension found, returning');
    return;
  }

  console.log('[Extended Image Support] UNSUPPORTED_EXTENSIONS includes:', UNSUPPORTED_EXTENSIONS.includes(extension));
  console.log('[Extended Image Support] registry.isSupported:', registry.isSupported(extension));
  
  if (!UNSUPPORTED_EXTENSIONS.includes(extension)) {
    console.log('[Extended Image Support] Extension not in unsupported list, returning');
    return;
  }
  if (!registry.isSupported(extension)) {
    console.log('[Extended Image Support] Extension not supported by registry, returning');
    return;
  }

  if (el.classList.contains('processed')) {
    console.log('[Extended Image Support] Element already processed, returning');
    return;
  }

  console.log('[Extended Image Support] Starting to process file:', filePath);

  try {
    let blobUrl = cache.get(filePath);
    console.log('[Extended Image Support] blobUrl from cache:', blobUrl ? 'found' : 'not found');

    if (!blobUrl) {
      console.log('[Extended Image Support] Looking for file in vault:', filePath);
      let file = app.vault.getAbstractFileByPath(filePath);
      console.log('[Extended Image Support] File found (original path):', !!file);
      
      if (!file) {
        const normalized = filePath.replace(/\\/g, '/');
        console.log('[Extended Image Support] Trying normalized path:', normalized);
        file = app.vault.getAbstractFileByPath(normalized);
        console.log('[Extended Image Support] File found (normalized):', !!file);
      }
      
      if (!file) {
        const fileName = filePath.split('/').pop() || '';
        console.log('[Extended Image Support] Searching by filename:', fileName);
        file = await findFileByName(app, fileName);
        console.log('[Extended Image Support] File found (by name):', !!file);
      }
      
      if (!file) {
        console.error('[Extended Image Support] File not found:', filePath);
        el.classList.add('image-decode-error');
        return;
      }
      
      console.log('[Extended Image Support] Reading file binary data...');
      const data = await app.vault.readBinary(file);
      console.log('[Extended Image Support] File data size:', data.byteLength);
      
      console.log('[Extended Image Support] Decoding with registry...');
      const blob = await registry.decode(data, extension);
      console.log('[Extended Image Support] Decoded blob size:', blob.size, 'type:', blob.type);
      
      blobUrl = URL.createObjectURL(blob);
      console.log('[Extended Image Support] Created blob URL:', blobUrl);
      await cache.set(filePath, blobUrl);
    }

    const newImg = createImg(blobUrl, src);
    el.replaceWith(newImg);
    console.log('[Extended Image Support] Successfully replaced embed with img');
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
    console.log('[Extended Image Support] PostProcessor triggered for element:', el.tagName);
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
  console.log('[Extended Image Support] processImage called for img, src:', img.src);
  const src = img.getAttribute('src');
  if (!src) {
    console.log('[Extended Image Support] img has no src, returning');
    return;
  }
  
  if (img.src.startsWith('blob:')) {
    console.log('[Extended Image Support] img already has blob src, returning');
    return;
  }

  const filePath = extractFilePath(src);
  if (!filePath) {
    console.log('[Extended Image Support] Could not extract file path from img, returning');
    return;
  }

  const extension = getExtension(filePath);
  console.log('[Extended Image Support] img extension:', extension);
  if (!extension) return;

  if (!UNSUPPORTED_EXTENSIONS.includes(extension)) {
    console.log('[Extended Image Support] img extension not unsupported, returning');
    return;
  }
  if (!registry.isSupported(extension)) {
    console.log('[Extended Image Support] img extension not supported by registry, returning');
    return;
  }

  try {
    let blobUrl = cache.get(filePath);
    console.log('[Extended Image Support] img blobUrl from cache:', blobUrl ? 'found' : 'not found');

    if (!blobUrl) {
      console.log('[Extended Image Support] Reading img file with adapter:', filePath);
      const data = await app.vault.adapter.readBinary(filePath);
      console.log('[Extended Image Support] img file data size:', data.byteLength);
      
      const blob = await registry.decode(data, extension);
      console.log('[Extended Image Support] img decoded blob size:', blob.size);
      
      blobUrl = URL.createObjectURL(blob);
      await cache.set(filePath, blobUrl);
    }

    img.src = blobUrl;
    console.log('[Extended Image Support] Set img src to blob URL');
  } catch (error) {
    console.error('[Extended Image Support] Failed to decode img:', filePath, error);
    img.classList.add('image-decode-error');
  }
}

export async function processAllImagesInElement(
  el: HTMLElement,
  app: App,
  registry: DecoderRegistry,
  cache: BlobCache
): Promise<void> {
  console.log('[Extended Image Support] ========== processAllImagesInElement called ==========');
  console.log('[Extended Image Support] el:', el.tagName, 'id:', el.id, 'class:', el.className);
  
  // Process internal embeds (like ![[file.heic]])
  const embeds = Array.from(el.querySelectorAll('.internal-embed'));
  console.log('[Extended Image Support] Found .internal-embed:', embeds.length);
  for (let i = 0; i < embeds.length; i++) {
    const embed = embeds[i];
    console.log(`[Extended Image Support] Processing embed ${i + 1}/${embeds.length}:`, embed.getAttribute('src'));
    await processEmbed(embed as HTMLElement, app, registry, cache);
  }
  
  // Also process regular img elements
  const images = Array.from(el.querySelectorAll('img'));
  console.log('[Extended Image Support] Found img:', images.length);
  for (let i = 0; i < images.length; i++) {
    const img = images[i];
    console.log(`[Extended Image Support] Processing img ${i + 1}/${images.length}:`, img.src);
    await processImage(img, app, registry, cache);
  }
  console.log('[Extended Image Support] ========== processAllImagesInElement done ==========');
}
