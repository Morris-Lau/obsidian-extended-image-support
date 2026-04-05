import { Extension, StateEffect, StateField, RangeSetBuilder } from '@codemirror/state';
import { Decoration, WidgetType, EditorView, DecorationSet } from '@codemirror/view';
import type { App } from 'obsidian';
import { BlobCache } from './blob-cache';
import { DecoderRegistry } from './decoders/registry';

const UNSUPPORTED_EXTENSIONS = [
  'heic', 'heif', 'tiff', 'tif', 'psd', 'avif',
  'cr2', 'nef', 'arw', 'crw', 'dng', 'raf', 'orf', 'srw'
];

const clearImageDecorations = StateEffect.define<null>();

class ImageWidget extends WidgetType {
  constructor(
    private filePath: string,
    private blobUrl: string | null,
    private app: App,
    private registry: DecoderRegistry,
    private cache: BlobCache,
    private isLoading: boolean
  ) {
    super();
  }

  toDOM(): HTMLElement {
    console.log('[Extended Image Support] ImageWidget.toDOM called for:', this.filePath);
    const wrap = document.createElement('div');
    wrap.className = 'obsidian-extended-image-embed';
    wrap.setAttribute('data-file-path', this.filePath);

    if (this.isLoading) {
      console.log('[Extended Image Support] ImageWidget showing loading state');
      wrap.className += ' is-loading';
      wrap.innerHTML = `<div class="image-loading">Loading ${this.filePath.split('/').pop()}...</div>`;
      this.loadImage(wrap);
      return wrap;
    }

    if (this.blobUrl) {
      console.log('[Extended Image Support] ImageWidget showing image with blob URL');
      const img = document.createElement('img');
      img.src = this.blobUrl;
      img.alt = this.filePath;
      img.className = 'extended-image';
      wrap.appendChild(img);
    } else {
      console.log('[Extended Image Support] ImageWidget showing error state');
      wrap.className += ' has-error';
      wrap.innerHTML = `<div class="image-error">Failed to load ${this.filePath.split('/').pop()}</div>`;
    }

    return wrap;
  }

  private async loadImage(container: HTMLElement): Promise<void> {
    console.log('[Extended Image Support] ImageWidget.loadImage started for:', this.filePath);
    try {
      const extension = this.getExtension(this.filePath);
      console.log('[Extended Image Support] ImageWidget extension:', extension);
      
      if (!extension || !this.registry.isSupported(extension)) {
        console.log('[Extended Image Support] ImageWidget extension not supported');
        this.updateContainer(container, null, true);
        return;
      }

      let blobUrl = this.cache.get(this.filePath);
      console.log('[Extended Image Support] ImageWidget cache lookup:', blobUrl ? 'found' : 'not found');
      
      if (!blobUrl) {
        console.log('[Extended Image Support] ImageWidget looking for file:', this.filePath);
        const file = this.app.vault.getAbstractFileByPath(this.filePath);
        console.log('[Extended Image Support] ImageWidget file found:', !!file);
        
        if (!file) {
          this.updateContainer(container, null, true);
          return;
        }
        
        console.log('[Extended Image Support] ImageWidget reading file...');
        const data = await this.app.vault.readBinary(file);
        console.log('[Extended Image Support] ImageWidget file data size:', data.byteLength);
        
        console.log('[Extended Image Support] ImageWidget decoding...');
        const blob = await this.registry.decode(data, extension);
        console.log('[Extended Image Support] ImageWidget decoded blob size:', blob.size, 'type:', blob.type);
        
        blobUrl = URL.createObjectURL(blob);
        console.log('[Extended Image Support] ImageWidget created blob URL:', blobUrl);
        await this.cache.set(this.filePath, blobUrl);
      }

      this.updateContainer(container, blobUrl, false);
      console.log('[Extended Image Support] ImageWidget loadImage completed successfully');
    } catch (error) {
      console.error('[Extended Image Support] ImageWidget failed to load:', this.filePath, error);
      this.updateContainer(container, null, true);
    }
  }

  private updateContainer(container: HTMLElement, blobUrl: string | null, error: boolean): void {
    container.classList.remove('is-loading');
    if (error) {
      container.classList.add('has-error');
      container.innerHTML = `<div class="image-error">Failed to load ${this.filePath.split('/').pop()}</div>`;
    } else if (blobUrl) {
      const img = document.createElement('img');
      img.src = blobUrl;
      img.alt = this.filePath;
      img.className = 'extended-image';
      container.innerHTML = '';
      container.appendChild(img);
    }
  }

  private getExtension(filePath: string): string | null {
    const lastDot = filePath.lastIndexOf('.');
    if (lastDot === -1 || lastDot === 0) return null;
    return filePath.slice(lastDot + 1).toLowerCase();
  }
}

interface EmbedMatch {
  fullMatch: string;
  filePath: string;
  from: number;
  to: number;
}

const embedRegex = /\!\[\[([^\]|]+)(\|[^\]]+)?\]\]/g;

function findEmbeds(doc: string): EmbedMatch[] {
  console.log('[Extended Image Support] findEmbeds called, doc length:', doc.length);
  const matches: EmbedMatch[] = [];
  let match;
  const regex = /\!\[\[([^\]|]+)(\|[^\]]+)?\]\]/g;
  
  while ((match = regex.exec(doc)) !== null) {
    const filePath = match[1];
    const ext = filePath.split('.').pop()?.toLowerCase();
    console.log('[Extended Image Support] Found embed:', filePath, 'extension:', ext);
    if (ext && UNSUPPORTED_EXTENSIONS.includes(ext)) {
      matches.push({
        fullMatch: match[0],
        filePath: filePath,
        from: match.index,
        to: match.index + match[0].length
      });
    }
  }
  
  console.log('[Extended Image Support] findEmbeds found', matches.length, 'matching embeds');
  return matches;
}

function createImageExtensions(
  app: App,
  registry: DecoderRegistry,
  cache: BlobCache
) {
  console.log('[Extended Image Support] createImageExtensions called');
  
  const imageField = StateField.define<DecorationSet>({
    create() {
      console.log('[Extended Image Support] imageField.create called');
      return Decoration.none;
    },
    update(decorations, tr) {
      decorations = decorations.map(tr.changes);
      
      for (const effect of tr.effects) {
        if (effect.is(clearImageDecorations)) {
          console.log('[Extended Image Support] clearImageDecorations effect received');
          decorations = Decoration.none;
        }
      }

      const doc = tr.state.doc.toString();
      const embeds = findEmbeds(doc);
      
      if (embeds.length === 0) {
        return decorations;
      }

      console.log('[Extended Image Support] Building decorations for', embeds.length, 'embeds');
      const builder = new RangeSetBuilder<Decoration>();
      
      for (const embed of embeds) {
        console.log('[Extended Image Support] Creating widget for:', embed.filePath);
        const widget = new ImageWidget(
          embed.filePath,
          null,
          app,
          registry,
          cache,
          true
        );
        builder.add(embed.from, embed.to, Decoration.replace({
          widget: widget,
          side: 1
        }));
      }
      
      return builder.finish();
    }
  });

  return imageField;
}

export function registerEditorExtension(
  app: App,
  registry: DecoderRegistry,
  cache: BlobCache
): any {
  console.log('[Extended Image Support] registerEditorExtension called');
  return createImageExtensions(app, registry, cache);
}
