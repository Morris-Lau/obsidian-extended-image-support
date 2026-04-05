import { readPsd } from 'ag-psd';
import { DecoderFn } from './registry';

export const decodePsd: DecoderFn = async (data: ArrayBuffer): Promise<Blob> => {
  const psd = readPsd(new DataView(data), { skipCompositeImageData: false });

  if (!psd.canvas) {
    throw new Error('Failed to render PSD');
  }

  const canvas = psd.canvas;
  
  if ('convertToBlob' in canvas) {
    return (canvas as unknown as OffscreenCanvas).convertToBlob({ type: 'image/png' });
  }
  
  return new Promise<Blob>((resolve) => {
    (canvas as HTMLCanvasElement).toBlob((blob) => {
      if (!blob) {
        throw new Error('Failed to convert canvas to blob');
      }
      resolve(blob);
    }, 'image/png');
  });
};