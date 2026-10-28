/**
 * Image cropping and preprocessing utilities for smartphone prints / screenshots
 * Specifically designed to remove phone status bars (clock, battery, Wi-Fi), app top headers,
 * and bottom navigation / checkout buttons, isolating only the middle content area.
 */

export interface CropBounds {
  topPercent: number;    // Removes status bar, time, battery, app headers (default 16%)
  bottomPercent: number; // Removes bottom nav, home bar, action buttons (default 18%)
  leftPercent: number;   // Cleans side borders
  rightPercent: number;  // Cleans side borders
}

export const DEFAULT_MIDDLE_CROP: CropBounds = {
  topPercent: 16,
  bottomPercent: 18,
  leftPercent: 2,
  rightPercent: 2,
};

export function cropImageToCenter(
  dataUrlOrSrc: string,
  bounds: CropBounds = DEFAULT_MIDDLE_CROP
): Promise<string> {
  return new Promise((resolve) => {
    // If it's a PDF, cannot crop via canvas Image
    if (dataUrlOrSrc.startsWith('data:application/pdf')) {
      resolve(dataUrlOrSrc);
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const topCut = Math.max(0, (bounds.topPercent / 100) * img.height);
        const bottomCut = Math.max(0, (bounds.bottomPercent / 100) * img.height);
        const leftCut = Math.max(0, (bounds.leftPercent / 100) * img.width);
        const rightCut = Math.max(0, (bounds.rightPercent / 100) * img.width);

        const sw = Math.max(10, img.width - leftCut - rightCut);
        const sh = Math.max(10, img.height - topCut - bottomCut);

        const canvas = document.createElement('canvas');
        canvas.width = sw;
        canvas.height = sh;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrlOrSrc);
          return;
        }

        // Draw only the cropped middle area
        ctx.drawImage(img, leftCut, topCut, sw, sh, 0, 0, sw, sh);
        resolve(canvas.toDataURL('image/png'));
      } catch (e) {
        console.warn('Falha ao recortar centro da imagem:', e);
        resolve(dataUrlOrSrc);
      }
    };
    img.onerror = () => {
      resolve(dataUrlOrSrc);
    };
    img.src = dataUrlOrSrc;
  });
}
