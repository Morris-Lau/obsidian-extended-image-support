import { Plugin, MarkdownPostProcessor, MarkdownView } from 'obsidian';
import { BlobCache } from './blob-cache';
import { DecoderRegistry } from './decoders/registry';
import { decodeHeic } from './decoders/heic';
import { decodeTiff } from './decoders/tiff';
import { decodePsd } from './decoders/psd';
import { createImagePostProcessor } from './post-processor';

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
    
    // Also try to handle images in active view
    this.app.workspace.on('layout-ready', () => {
      this.processActiveView();
    });
  }
  
  processActiveView(): void {
    const activeLeaf = this.app.workspace.getActiveFileView();
    if (activeLeaf instanceof MarkdownView) {
      const container = activeLeaf.containerEl;
      const images = container.querySelectorAll('img');
      console.log('[Extended Image Support] Found images in active view:', images.length);
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
