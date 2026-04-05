import { Plugin, MarkdownPostProcessor, MarkdownView, WorkspaceItem } from 'obsidian';
import { BlobCache } from './blob-cache';
import { DecoderRegistry } from './decoders/registry';
import { decodeHeic } from './decoders/heic';
import { decodeTiff } from './decoders/tiff';
import { decodePsd } from './decoders/psd';
import { createImagePostProcessor, processAllImagesInElement } from './post-processor';

export default class ExtendedImageSupport extends Plugin {
  cache: BlobCache = new BlobCache();
  registry: DecoderRegistry = new DecoderRegistry();
  processor: MarkdownPostProcessor | null = null;

  async onload(): Promise<void> {
    console.log('[Extended Image Support] Plugin loading...');
    
    this.registerDecoders();
    this.registerPostProcessor();
    this.loadStyles();
    
    console.log('[Extended Image Support] Plugin loaded, supported formats:', this.registry.getSupportedExtensions());
    
    // Process images when workspace is ready
    this.app.workspace.on('layout-ready', () => {
      setTimeout(() => this.processAllViews(), 1000);
      
      this.app.workspace.on('file-open', () => {
        setTimeout(() => this.processAllViews(), 500);
      });
    });
  }

  registerDecoders(): void {
    this.registry.registerDecoder('heic', decodeHeic);
    this.registry.registerDecoder('heif', decodeHeic);
    this.registry.registerDecoder('tiff', decodeTiff);
    this.registry.registerDecoder('tif', decodeTiff);
    this.registry.registerDecoder('psd', decodePsd);
  }

  registerPostProcessor(): void {
    this.processor = createImagePostProcessor(this.app, this.registry, this.cache);
    this.registerMarkdownPostProcessor(this.processor);
  }
  
  processAllViews(): void {
    const leaves = this.app.workspace.getLeavesOfType('markdown');
    
    for (const leaf of leaves) {
      const view = leaf.view;
      if (view instanceof MarkdownView) {
        const container = (view as any).containerEl || (view as any).contentEl;
        if (container) {
          processAllImagesInElement(container, this.app, this.registry, this.cache);
        }
      }
    }
  }

  loadStyles(): void {
    const styleEl = document.createElement('style');
    styleEl.textContent = `.image-decode-error {
  border: 2px solid #ff4444;
  background-color: #ffeeee;
  padding: 8px;
  border-radius: 4px;
  display: inline-block;
}

.image-decode-error::after {
  content: "Failed to decode image";
  display: block;
  color: #ff4444;
  font-size: 12px;
}`;
    document.head.appendChild(styleEl);
  }

  onunload(): void {
    this.cache.clear();
    console.log('[Extended Image Support] Plugin unloaded');
  }
}
