import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import {
  Camera,
  CheckCircle2,
  ScanBarcode,
  Search,
  Upload,
  X,
  AlertCircle,
} from 'lucide-react';
import { apiRequest } from '../lib/api';
import type { Book } from '../types';
import { BarcodeDisplay } from './BarcodeDisplay';

export type BarcodeScannerIntent = 'lookup' | 'return_verify' | 'fill_form';

interface BarcodeScannerModalProps {
  open: boolean;
  intent: BarcodeScannerIntent;
  expectedBarcode?: string;
  expectedBookTitle?: string;
  sampleBarcodes?: Array<{ title: string; barcode: string }>;
  onClose: () => void;
  onBookFound?: (book: Book) => void;
  onCodeCaptured?: (code: string, book: Book | null) => void;
}

export function BarcodeScannerModal({
  open,
  intent,
  expectedBarcode,
  expectedBookTitle,
  sampleBarcodes = [],
  onClose,
  onBookFound,
  onCodeCaptured,
}: BarcodeScannerModalProps) {
  const [mode, setMode] = useState<'keyboard' | 'camera'>('keyboard');
  const [codeInput, setCodeInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [matchedBook, setMatchedBook] = useState<Book | null>(null);
  const [verifiedCode, setVerifiedCode] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const readerRegionId = 'pustaka-barcode-reader';

  useEffect(() => {
    if (open) {
      setCodeInput('');
      setErrorMsg(null);
      setMatchedBook(null);
      setVerifiedCode(null);
      setMode('keyboard');
      setTimeout(() => inputRef.current?.focus(), 60);
    } else {
      void stopCamera();
    }
    return () => {
      void stopCamera();
    };
  }, [open]);

  async function stopCamera() {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        scannerRef.current.clear();
      } catch {
        // Ignore cleanup errors
      }
      scannerRef.current = null;
    }
    setCameraActive(false);
  }

  async function verifyCode(raw: string) {
    const clean = raw.trim();
    if (!clean) {
      setErrorMsg('Masukkan atau pindai kode barcode terlebih dahulu.');
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    setMatchedBook(null);
    setVerifiedCode(clean);

    try {
      if (intent === 'return_verify' && expectedBarcode) {
        const normalizedIn = clean.replace(/[-\s]/g, '');
        const normalizedExp = expectedBarcode.replace(/[-\s]/g, '');
        if (normalizedIn !== normalizedExp) {
          setErrorMsg(
            `Barcode (${clean}) tidak cocok dengan buku "${expectedBookTitle || ''}" (${expectedBarcode}).`
          );
          setLoading(false);
          return;
        }
      }

      const res = await apiRequest<{ found: boolean; book: Book }>(
        `/api/books/barcode/${encodeURIComponent(clean)}`
      );
      setMatchedBook(res.book);
      if (intent === 'return_verify' && onCodeCaptured) {
        onCodeCaptured(clean, res.book);
      }
    } catch (err) {
      if (intent === 'fill_form') {
        // Valid new barcode not yet in catalog -> allow filling add-book form
        setMatchedBook(null);
        setErrorMsg(null);
        if (onCodeCaptured) {
          onCodeCaptured(clean, null);
        }
      } else {
        setErrorMsg(
          err instanceof Error ? err.message : 'Barcode tidak ditemukan di katalog.'
        );
      }
    } finally {
      setLoading(false);
    }
  }

  async function startCamera() {
    setErrorMsg(null);
    await stopCamera();
    try {
      const html5Qr = new Html5Qrcode(readerRegionId);
      scannerRef.current = html5Qr;
      setCameraActive(true);
      await html5Qr.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 260, height: 140 } },
        (decodedText) => {
          setCodeInput(decodedText);
          void stopCamera();
          void verifyCode(decodedText);
        },
        () => {
          // Ignore per-frame decode misses
        }
      );
    } catch {
      setCameraActive(false);
      setErrorMsg(
        'Kamera tidak tersedia atau izin ditolak. Gunakan pemindai USB, input manual, atau unggah gambar barcode.'
      );
    }
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMsg(null);
    setLoading(true);
    try {
      const html5Qr = scannerRef.current || new Html5Qrcode(readerRegionId);
      const decoded = await html5Qr.scanFile(file, true);
      setCodeInput(decoded);
      await verifyCode(decoded);
    } catch {
      setErrorMsg('Barcode pada gambar tidak terbaca. Pastikan gambar jelas dan kontras.');
    } finally {
      setLoading(false);
      e.target.value = '';
    }
  }

  if (!open) return null;

  const titleText =
    intent === 'return_verify'
      ? 'Verifikasi Barcode Pengembalian'
      : intent === 'fill_form'
        ? 'Pindai Barcode Buku Baru'
        : 'Pemindai & Verifikasi Barcode';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="barcode-modal-title"
    >
      <div className="w-full max-w-xl bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2.5">
            <ScanBarcode className="w-5 h-5 text-blue-700" />
            <h2 id="barcode-modal-title" className="text-base font-semibold text-slate-900">
              {titleText}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup modal pemindai"
            className="p-1.5 text-slate-500 hover:text-slate-900 rounded-md hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {intent === 'return_verify' && expectedBarcode && (
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-md text-sm text-slate-700">
              Pindai atau masukkan kode barcode buku{' '}
              <span className="font-semibold text-slate-900">{expectedBookTitle}</span> (
              <span className="font-mono text-slate-900">{expectedBarcode}</span>) untuk
              memverifikasi pengembalian fisik.
            </div>
          )}

          {/* Segmented Mode Switch */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg w-fit">
            <button
              type="button"
              onClick={() => {
                void stopCamera();
                setMode('keyboard');
                setTimeout(() => inputRef.current?.focus(), 40);
              }}
              className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                mode === 'keyboard'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Pemindai USB / Input Cepat
            </button>
            <button
              type="button"
              onClick={() => setMode('camera')}
              className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                mode === 'camera'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Kamera / Gambar Barcode
            </button>
          </div>

          {mode === 'keyboard' ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void verifyCode(codeInput);
              }}
              className="space-y-3"
            >
              <label className="block text-xs font-medium text-slate-600">
                Kode Barcode EAN-13 / Code128 / ISBN
              </label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    ref={inputRef}
                    type="text"
                    value={codeInput}
                    onChange={(e) => setCodeInput(e.target.value)}
                    placeholder="Arahkan pemindai USB atau ketik kode, mis. 9786020633176"
                    className="w-full pl-9 pr-3 py-2 text-sm font-mono bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-700/20 focus:border-blue-700"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-700 hover:bg-blue-800 disabled:opacity-50 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {loading ? 'Memeriksa...' : 'Verifikasi'}
                </button>
              </div>

              {sampleBarcodes.length > 0 && intent === 'lookup' && (
                <div className="pt-1">
                  <span className="text-xs text-slate-500 mr-2">Uji cepat dari katalog:</span>
                  <div className="flex flex-wrap gap-2 mt-1.5">
                    {sampleBarcodes.slice(0, 3).map((item) => (
                      <button
                        key={item.barcode}
                        type="button"
                        onClick={() => {
                          setCodeInput(item.barcode);
                          void verifyCode(item.barcode);
                        }}
                        className="text-xs font-mono text-slate-700 hover:text-blue-700 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded transition-colors cursor-pointer"
                      >
                        {item.barcode}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </form>
          ) : (
            <div className="space-y-3">
              <div
                id={readerRegionId}
                className="w-full min-h-[210px] bg-slate-950 rounded-md overflow-hidden flex items-center justify-center text-slate-400 text-xs"
              >
                {!cameraActive && 'Pratinjau kamera pemindai barcode siap diaktifkan'}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {!cameraActive ? (
                  <button
                    type="button"
                    onClick={() => void startCamera()}
                    className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-md transition-colors cursor-pointer"
                  >
                    <Camera className="w-4 h-4" />
                    Aktifkan Kamera
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void stopCamera()}
                    className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors cursor-pointer"
                  >
                    Hentikan Kamera
                  </button>
                )}

                <label className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-md cursor-pointer transition-colors">
                  <Upload className="w-4 h-4" />
                  Unggah Gambar Barcode
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          )}

          {errorMsg && (
            <div className="flex items-start gap-2.5 p-3.5 bg-red-50 border border-red-200 rounded-md text-xs text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {matchedBook && (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-md space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-700 mb-1">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Barcode Terverifikasi</span>
                  </div>
                  <h3 className="text-sm font-semibold text-slate-900">{matchedBook.title}</h3>
                  <p className="text-xs text-slate-600 mt-0.5">
                    {matchedBook.author} · {matchedBook.shelfLocation} ·{' '}
                    <span className="tabular-nums">
                      {matchedBook.availableCopies}/{matchedBook.totalCopies} tersedia
                    </span>
                  </p>
                </div>
                <BarcodeDisplay value={matchedBook.barcode} compact height={32} />
              </div>

              {intent === 'lookup' && onBookFound && (
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => {
                      onBookFound(matchedBook);
                      onClose();
                    }}
                    className="px-4 py-2 text-xs font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-md transition-colors cursor-pointer"
                  >
                    Pinjam Buku Ini
                  </button>
                </div>
              )}
            </div>
          )}

          {intent === 'fill_form' && verifiedCode && !matchedBook && !errorMsg && !loading && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-md flex items-center justify-between gap-3">
              <div className="text-xs text-emerald-800">
                Kode barcode <span className="font-mono font-semibold">{verifiedCode}</span> siap
                digunakan untuk koleksi baru.
              </div>
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 text-xs font-medium text-white bg-emerald-700 hover:bg-emerald-800 rounded-md cursor-pointer"
              >
                Gunakan Kode
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
