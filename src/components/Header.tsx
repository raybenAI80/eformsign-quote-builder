import React from 'react';
import { EformsignLogo } from './EformsignLogo';

interface HeaderProps {
  onExportCSV: () => void;
  onExportImage: () => void;
  onExportPdf: () => void;
  onReset: () => void;
  showPreview: boolean;
  onTogglePreview: () => void;
  onTempSave: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onExportCSV,
  onExportImage,
  onExportPdf,
  onReset,
  showPreview,
  onTogglePreview,
  onTempSave,
}) => {
  const headerRef = React.useRef<HTMLElement>(null);
  const [headerWidth, setHeaderWidth] = React.useState(1000);

  React.useEffect(() => {
    if (!headerRef.current) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setHeaderWidth(entry.contentRect.width);
      }
    });

    observer.observe(headerRef.current);
    return () => observer.disconnect();
  }, []);

  // Width breakpoints for showing text
  const showBrandText = headerWidth > 380;
  const showPreviewText = headerWidth > 550;
  const showTempSaveText = headerWidth > 700;
  const showResetText = headerWidth > 480;
  const showPdfText = headerWidth > 400;

  return (
    <header
      ref={headerRef}
      className="hidden lg:block sticky top-0 z-50 border-b border-[var(--forcs-border)] bg-white/95 backdrop-blur-md print:hidden shadow-sm transition-all"
    >
      {/* Single Row: Branding + Actions */}
      <div className="flex h-14 w-full items-center justify-between px-3 sm:px-4 gap-2 overflow-hidden">
        {/* Left: Branding */}
        <div className="flex items-center gap-2 shrink-0">
          <EformsignLogo className="h-5 sm:h-6 w-auto" />
          {showBrandText && (
            <>
              <div className="mx-1 h-4 w-px bg-gray-300" />
              <span className="whitespace-nowrap text-base font-bold tracking-tight text-[var(--forcs-text)]">
                견적서 빌더
              </span>
            </>
          )}
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Preview Toggle */}
          <div className="flex items-center gap-1.5 mr-1">
            {showPreviewText && (
              <span className={`whitespace-nowrap text-xs font-bold transition-colors ${showPreview ? 'text-[#00a99d]' : 'text-gray-400'}`}>
                미리보기
              </span>
            )}
            <button
              onClick={onTogglePreview}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${showPreview ? 'bg-[#00a99d]' : 'bg-gray-300'}`}
              title="미리보기 토글"
            >
              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform ${showPreview ? 'translate-x-4' : 'translate-x-1'}`} />
            </button>
          </div>

          {/* Temp Save */}
          <button
            onClick={onTempSave}
            className="inline-flex items-center gap-1 rounded-md border border-blue-300 bg-blue-50 text-blue-700 px-2 sm:px-2.5 py-1.5 text-xs font-bold shadow-sm hover:bg-blue-100"
            title="임시저장"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
              <polyline points="17 21 17 13 7 13 7 21" />
              <polyline points="7 3 7 8 15 8" />
            </svg>
            {showTempSaveText && <span>임시저장</span>}
          </button>

          {/* Reset */}
          <button
            className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2 sm:px-2.5 py-1.5 text-xs font-bold text-gray-700 shadow-sm hover:border-[#f97316] hover:text-[#f97316]"
            onClick={onReset}
            title="초기화"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 6h18" />
              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
              <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
            </svg>
            {showResetText && <span>초기화</span>}
          </button>

          {/* Export PDF */}
          <button
            className="inline-flex items-center gap-1 rounded-md bg-[#00a99d] px-2 sm:px-2.5 py-1.5 text-xs font-bold text-white shadow-md hover:bg-[#008a81]"
            onClick={onExportPdf}
            title="PDF / 인쇄"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            {showPdfText && <span>PDF</span>}
          </button>
        </div>
      </div>
    </header>
  );
};
