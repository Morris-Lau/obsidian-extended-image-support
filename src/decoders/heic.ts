import { DecoderFn } from './registry';

let libheif: typeof import('libheif-js') | null = null;

async function getLibheif() {
  if (!libheif) {
    libheif = await import('libheif-js');
  }
  return libheif;
}

export const decodeHeic: DecoderFn = async (data: ArrayBuffer): Promise<Blob> => {
  const lib = await getLibheif();
  
  const decoder = new lib.HeifDecoder();
  const decodedImages = decoder.decode(data);
  
  if (decodedImages.length === 0) {
    throw new Error('No images found in HEIC file');
  }
  
  const image = decodedImages[0];
  const width = image.get_width();
  const height = image.get_height();
  
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d')!;
  const imageData = ctx.createImageData(width, height);
  
  const displayData = await new Promise<Uint8ClampedArray>((resolve, reject) => {
    image.display(
      { data: new Uint8ClampedArray(width * height * 4), width, height },
      (result) => {
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
  
  return canvas.convertToBlob({ type: 'image/png' });
};