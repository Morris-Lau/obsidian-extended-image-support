import { DecoderFn } from './registry';

let utifModule: any = null;

async function getUtif() {
  if (!utifModule) {
    utifModule = await import('utif');
  }
  return utifModule;
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

  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d')!;
  const imageData = ctx.createImageData(width, height);

  imageData.data.set(rgba);
  ctx.putImageData(imageData, 0, 0);

  return canvas.convertToBlob({ type: 'image/png' });
};