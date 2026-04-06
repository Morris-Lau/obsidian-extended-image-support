import { Plugin } from 'obsidian';
import { DecoderRegistry } from './decoders/registry';
import { decodeHeic } from './decoders/heic';
// TIFF and PSD support coming soon
// import { decodeTiff } from './decoders/tiff';
// import { decodePsd } from './decoders/psd';

const UNSUPPORTED_EXTENSIONS = ['heic', 'heif'];

export default class ExtendedImageSupport extends Plugin {
  registry: DecoderRegistry = new DecoderRegistry();
  blobCache: Map<string, string> = new Map();
  observer: MutationObserver | null = null;

  onload(): void {
    this.registry.registerDecoder('heic', decodeHeic);
    this.registry.registerDecoder('heif', decodeHeic);
    // TIFF and PSD support coming soon
    // this.registry.registerDecoder('tiff', decodeTiff);
    // this.registry.registerDecoder('tif', decodeTiff);
    // this.registry.registerDecoder('psd', decodePsd);
    
    this.registerMarkdownPostProcessor((el) => this.processElement(el));
    this.setupLivePreview();
  }
  
  setupLivePreview(): void {
    setTimeout(() => this.scanAndProcess(), 500);
    
    this.registerEvent(this.app.workspace.on('file-open', () => {
      setTimeout(() => this.scanAndProcess(), 300);
    }));
    
    this.observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node instanceof HTMLElement) {
            if (node.classList?.contains('internal-embed') || 
                node.querySelector?.('.internal-embed')) {
              this.scanAndProcess();
              return;
            }
          }
        }
      }
    });
    
    const workspace = document.querySelector('.workspace');
    if (workspace) {
      this.observer.observe(workspace, { childList: true, subtree: true });
    }
  }
  
  async scanAndProcess(): Promise<void> {
    const embeds = document.querySelectorAll('.internal-embed:not(.extended-image-processed)');
    for (const embed of Array.from(embeds)) {
      await this.processEmbed(embed as HTMLElement);
    }
  }
  
  async processElement(el: HTMLElement): Promise<void> {
    const embeds = el.querySelectorAll('.internal-embed:not(.extended-image-processed)');
    for (const embed of Array.from(embeds)) {
      await this.processEmbed(embed as HTMLElement);
    }
  }
  
  async processEmbed(embed: HTMLElement): Promise<void> {
    if (embed.classList.contains('extended-image-processed')) return;
    
    const src = embed.getAttribute('src');
    if (!src) return;
    
    const ext = src.split('.').pop()?.toLowerCase();
    if (!ext || !UNSUPPORTED_EXTENSIONS.includes(ext)) return;
    
    try {
      let filePath = src;
      if (src.startsWith('app://local/')) {
        filePath = decodeURIComponent(src.slice(12));
      } else if (src.startsWith('/')) {
        filePath = src.slice(1);
      }
      
      let file = this.app.vault.getAbstractFileByPath(filePath);
      if (!file) {
        file = this.app.vault.getAbstractFileByPath(filePath.replace(/\\/g, '/'));
      }
      if (!file) {
        const fileName = filePath.split('/').pop();
        file = this.app.vault.getFiles().find(f => f.name.toLowerCase() === fileName?.toLowerCase());
      }
      
      if (!file) return;
      
      let blobUrl = this.blobCache.get(file.path);
      
      if (!blobUrl) {
        const data = await this.app.vault.readBinary(file);
        const blob = await this.registry.decode(data, ext);
        blobUrl = URL.createObjectURL(blob);
        this.blobCache.set(file.path, blobUrl);
      }
      
      embed.innerHTML = '';
      embed.classList.remove('file-embed', 'mod-generic');
      embed.classList.add('media-embed', 'image-embed');
      
      const wrapper = document.createElement('div');
      wrapper.className = 'image-wrapper';
      
      const img = document.createElement('img');
      img.src = blobUrl;
      img.alt = src;
      
      wrapper.appendChild(img);
      embed.appendChild(wrapper);
      
      embed.classList.add('extended-image-processed');
      
    } catch (error) {
      console.error('[Extended Image Support]', error);
    }
  }

  onunload(): void {
    this.observer?.disconnect();
    for (const url of this.blobCache.values()) {
      URL.revokeObjectURL(url);
    }
    this.blobCache.clear();
  }
}
