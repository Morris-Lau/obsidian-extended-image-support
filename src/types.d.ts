declare module 'libheif-js/wasm-bundle' {
  interface HeifImage {
    get_width(): number;
    get_height(): number;
    display(target: { data: Uint8ClampedArray; width: number; height: number }, callback: (result: { data: Uint8ClampedArray } | null) => void): void;
  }
  
  interface HeifDecoder {
    decode(data: ArrayBuffer): HeifImage[];
  }
  
  export {
    HeifDecoder
  };
}
