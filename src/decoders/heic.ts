import { DecoderFn } from './registry';

let libheif: any = null;

async function getLibheif() {
  if (!libheif) {
    libheif = await import('libheif-js/wasm-bundle');
  }
  return libheif;
}

// 检测是否支持 OffscreenCanvas
function supportsOffscreenCanvas(): boolean {
  return typeof OffscreenCanvas !== 'undefined';
}

// 创建 canvas（兼容移动端）
function createCanvas(width: number, height: number): HTMLCanvasElement | OffscreenCanvas {
  if (supportsOffscreenCanvas()) {
    return new OffscreenCanvas(width, height);
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

// 转换为 Blob（兼容移动端）
async function canvasToBlob(canvas: HTMLCanvasElement | OffscreenCanvas): Promise<Blob> {
  if (canvas instanceof OffscreenCanvas) {
    return canvas.convertToBlob({ type: 'image/png' });
  }
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Canvas toBlob failed'));
    }, 'image/png');
  });
}

export const decodeHeic: DecoderFn = async (data: ArrayBuffer): Promise<Blob> => {
  // 移动端文件大小限制（10MB）
  const MAX_SIZE = 10 * 1024 * 1024;
  if (data.byteLength > MAX_SIZE) {
    throw new Error(`File too large (${(data.byteLength / 1024 / 1024).toFixed(1)}MB). Max: 10MB`);
  }
  
  const lib: any = await getLibheif();
  const decoder = new lib.HeifDecoder();
  const decodedImages: any[] = decoder.decode(data);
  
  if (decodedImages.length === 0) {
    throw new Error('No images found in HEIC file');
  }
  
  const image: any = decodedImages[0];
  const width = image.get_width();
  const height = image.get_height();
  
  // 尺寸限制（防止内存溢出）
  const MAX_DIMENSION = 10000;
  if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
    throw new Error(`Image too large (${width}x${height}). Max: ${MAX_DIMENSION}px`);
  }
  
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d')!;
  const imageData = ctx.createImageData(width, height);
  
  const displayData = await new Promise<Uint8ClampedArray>((resolve, reject) => {
    image.display(
      { data: new Uint8ClampedArray(width * height * 4), width, height },
      (result: any) => {
        if (!result) {
          reject(new Error('Failed to display HEIC image'));
          return;
        }
        resolve(result.data);
      }
    );
  });
  
  imageData.data.set(displayData);
  ctx.putImageData(imageData, 0, 0);
  
  return canvasToBlob(canvas);
};
