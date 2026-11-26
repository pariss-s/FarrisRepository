import { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';
import { Download } from 'lucide-react';

interface BarcodeDisplayProps {
  value: string;
  label?: string;
  height?: number;
  compact?: boolean;
  allowDownload?: boolean;
}

export function BarcodeDisplay({
  value,
  label,
  height = 46,
  compact = false,
  allowDownload = false,
}: BarcodeDisplayProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (!svgRef.current || !value) return;
    try {
      const clean = value.replace(/[^0-9A-Za-z-]/g, '') || '0000000000000';
      const isEan13 = /^\d{13}$/.test(clean);
      JsBarcode(svgRef.current, clean, {
        format: isEan13 ? 'EAN13' : 'CODE128',
        lineColor: '#0f172a',
        background: '#ffffff',
        width: compact ? 1.3 : 1.7,
        height,
        displayValue: true,
        font: 'JetBrains Mono, monospace',
        fontSize: compact ? 10 : 12,
        margin: compact ? 4 : 8,
      });
    } catch {
      try {
        JsBarcode(svgRef.current, value, {
          format: 'CODE128',
          lineColor: '#0f172a',
          background: '#ffffff',
          width: compact ? 1.3 : 1.7,
          height,
          displayValue: true,
          fontSize: compact ? 10 : 12,
          margin: compact ? 4 : 8,
        });
      } catch {
        // Fallback handled silently
      }
    }
  }, [value, height, compact]);

  function handleDownloadSvg() {
    if (!svgRef.current) return;
    const serializer = new XMLSerializer();
    const source = serializer.serializeToString(svgRef.current);
    const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `barcode-${value}.svg`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="inline-flex flex-col items-start gap-2">
      <div className="bg-white border border-slate-200 rounded-md p-2 inline-block">
        <svg ref={svgRef} className="max-w-full h-auto block" />
      </div>
      {(label || allowDownload) && (
        <div className="flex items-center justify-between w-full gap-3">
          {label && (
            <span className="text-xs text-slate-500 truncate max-w-[200px]">{label}</span>
          )}
          {allowDownload && (
            <button
              type="button"
              onClick={handleDownloadSvg}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 hover:text-blue-800 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Unduh Label SVG
            </button>
          )}
        </div>
      )}
    </div>
  );
}
