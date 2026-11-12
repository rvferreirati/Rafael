import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X, Camera, Barcode, AlertCircle, Keyboard, Check } from 'lucide-react';

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (barcode: string) => void;
  title?: string;
  subtitle?: string;
}

const playBeep = () => {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1250, ctx.currentTime);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.14);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  } catch {
    // ignore audio block
  }
};

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  onScan,
  title = 'Ler Código de Barras',
  subtitle = 'Aponte a câmera para o código de barras do produto ou use um leitor USB/Bluetooth',
}) => {
  const [manualCode, setManualCode] = useState('');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const hasScannedRef = useRef(false);
  const regionId = 'artex7-barcode-reader-region';

  useEffect(() => {
    if (!isOpen) return;

    hasScannedRef.current = false;
    setManualCode('');
    setCameraError(null);
    setIsStarting(true);

    let isMounted = true;
    const html5QrCode = new Html5Qrcode(regionId);
    scannerRef.current = html5QrCode;

    const handleSuccess = async (decodedText: string) => {
      if (hasScannedRef.current) return;
      const clean = (decodedText || '').trim();
      if (!clean) return;

      hasScannedRef.current = true;
      playBeep();

      try {
        if (html5QrCode.isScanning) {
          await html5QrCode.stop();
        }
        html5QrCode.clear();
      } catch {
        // ignore stop errors
      }

      onScan(clean);
      onClose();
    };

    const startScanner = async () => {
      try {
        await html5QrCode.start(
          { facingMode: 'environment' },
          {
            fps: 12,
            qrbox: { width: 260, height: 140 },
            aspectRatio: 1.5,
          },
          handleSuccess,
          () => {
            // ignore per-frame decode misses
          }
        );
        if (isMounted) setIsStarting(false);
      } catch (err: any) {
        // Fallback to any available camera (useful on desktop webcams)
        try {
          const devices = await Html5Qrcode.getCameras();
          if (devices && devices.length > 0 && isMounted) {
            await html5QrCode.start(
              devices[0].id,
              {
                fps: 12,
                qrbox: { width: 260, height: 140 },
              },
              handleSuccess,
              () => {}
            );
            if (isMounted) setIsStarting(false);
            return;
          }
        } catch {
          // ignore fallback error
        }

        if (isMounted) {
          setIsStarting(false);
          setCameraError(
            'Não foi possível acessar a câmera neste aparelho. Você pode digitar o código ou usar um leitor USB abaixo.'
          );
        }
      }
    };

    const timer = setTimeout(() => {
      if (isMounted) startScanner();
    }, 150);

    return () => {
      isMounted = false;
      clearTimeout(timer);
      const instance = scannerRef.current;
      if (instance) {
        try {
          if (instance.isScanning) {
            instance
              .stop()
              .then(() => instance.clear())
              .catch(() => {});
          } else {
            instance.clear();
          }
        } catch {
          // ignore cleanup errors
        }
      }
    };
  }, [isOpen, onClose, onScan]);

  if (!isOpen) return null;

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = manualCode.trim();
    if (!clean) return;
    playBeep();
    onScan(clean);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[70] bg-slate-900/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
      <div className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-200 flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300 shrink-0">
              <Barcode className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-bold truncate">{title}</h3>
              <p className="text-[11px] text-slate-300 leading-tight line-clamp-2">{subtitle}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Camera Viewport */}
        <div className="p-4 sm:p-5 space-y-4">
          <div className="relative rounded-2xl overflow-hidden bg-slate-950 border-2 border-slate-800 min-h-[220px] flex items-center justify-center">
            <div id={regionId} className="w-full" />

            {isStarting && !cameraError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white bg-slate-950/90 p-4 text-center">
                <Camera className="w-8 h-8 text-indigo-400 animate-pulse" />
                <span className="text-xs font-semibold text-slate-200">
                  Iniciando câmera para leitura do código de barras...
                </span>
              </div>
            )}

            {cameraError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-900 text-slate-200 p-5 text-center">
                <AlertCircle className="w-8 h-8 text-amber-400" />
                <p className="text-xs font-medium leading-relaxed">{cameraError}</p>
              </div>
            )}
          </div>

          {/* Manual / USB Scanner Fallback */}
          <form onSubmit={handleManualSubmit} className="space-y-2 pt-1 border-t border-slate-100">
            <label className="text-[11px] font-bold text-slate-600 uppercase flex items-center gap-1.5">
              <Keyboard className="w-3.5 h-3.5 text-indigo-600" />
              <span>Ou digite / bipe com leitor USB:</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="Ex: 7891234567890"
                autoFocus={Boolean(cameraError)}
                className="flex-1 px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs sm:text-sm font-mono font-bold text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
              <button
                type="submit"
                disabled={!manualCode.trim()}
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                <Check className="w-4 h-4" />
                <span>Usar</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
