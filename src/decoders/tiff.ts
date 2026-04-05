import { DecoderFn } from './registry';

let UTIF: typeof import('utif') | null = null;

async function getUtif() {
  if (!UTIF) {
    UTIF = await import('utif');
  }
  return UTIF;
}

export const decodeTiff: DecoderFn = async (data: ArrayBuffer): Promise<Blob> => {
  const utif = await getUtif();

  const ifds = utif.decode(data);

  if (ifds.length === 0) {
    throw new Error('No images found in TIFF file');
  }

  const ifd = ifds[0];
  utif.decodeImage(data, ifd);

  const rgba = utif.toRGBA8(ifd);

  const width = ifd.width;
  const height = ifd.height;

  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d')!;
  const imageData = ctx.createImageData(width, height);

  imageData.data.set(rgba);
  ctx.putImageData(imageData, 0, 0);

  return canvas.convertToBlob({ type: 'image/png' });
};