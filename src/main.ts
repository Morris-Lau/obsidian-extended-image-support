import { Plugin, MarkdownPostProcessor } from 'obsidian';
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
    this.registerDecoders();
    this.registerPostProcessor();
    this.loadStyles();
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

  loadStyles(): void {
    this.addStyleSheet('styles.css');
  }

  onunload(): void {
    this.cache.clear();
  }
}
