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
