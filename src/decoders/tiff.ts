import { DecoderFn } from './registry';

let utifModule: any = null;

async function getUtif() {
  if (!utifModule) {
    utifModule = await import('utif');
  }
  return utifModule;
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

export const decodeTiff: DecoderFn = async (data: ArrayBuffer): Promise<Blob> => {
  const utif: any = await getUtif();

  const ifds: any[] = utif.decode(data);

  if (ifds.length === 0) {
    throw new Error('No images found in TIFF file');
  }

  const ifd: any = ifds[0];
  utif.decodeImage(data, ifd);

  const rgba: Uint8Array = utif.toRGBA8(ifd);

  const width = ifd.width;
  const height = ifd.height;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d')!;
  const imageData = ctx.createImageData(width, height);

  imageData.data.set(rgba);
  ctx.putImageData(imageData, 0, 0);

  return canvasToBlob(canvas);
};
