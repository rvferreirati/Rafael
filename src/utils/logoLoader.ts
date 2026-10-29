/**
 * Logo loader and caching utility for ARTEX7
 */

export const ARTEX7_LOGO_URL = '/assets/aistudio/Logo_ARtex7_em_Preto_254e2cb7.png';

let cachedLogoDataUrl: string | null = null;
let loadPromise: Promise<string> | null = null;

export function getCachedLogo(): string | null {
  return cachedLogoDataUrl;
}

export function loadLogoDataUrl(): Promise<string> {
  if (cachedLogoDataUrl) {
    return Promise.resolve(cachedLogoDataUrl);
  }
  if (loadPromise) {
    return loadPromise;
  }

  loadPromise = new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve(ARTEX7_LOGO_URL);
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          cachedLogoDataUrl = canvas.toDataURL('image/png');
          resolve(cachedLogoDataUrl);
          return;
        }
      } catch (err) {
        console.warn('Erro ao converter logo para canvas:', err);
      }
      resolve(ARTEX7_LOGO_URL);
    };
    img.onerror = () => {
      resolve(ARTEX7_LOGO_URL);
    };
    img.src = ARTEX7_LOGO_URL;
  });

  return loadPromise;
}

// Preload on browser initialization
if (typeof window !== 'undefined') {
  loadLogoDataUrl();
}
