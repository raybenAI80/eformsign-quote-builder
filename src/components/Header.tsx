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
  return (
    <header className="sticky top-0 z-50 border-b border-[var(--forcs-border)] bg-white/95 backdrop-blur-md print:hidden shadow-sm transition-all">
      {/* Row 1: Branding */}
      <div className="mx-auto flex h-14 w-full items-center justify-between px-6 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <EformsignLogo className="h-6 w-auto" />
          <div className="mx-1 h-4 w-px bg-gray-300" />
          <span className="whitespace-nowrap text-base font-bold tracking-tight text-[var(--forcs-text)]">
            견적서 빌더
          </span>
        </div>
      </div>

      {/* Row 2: Toolbar */}
      <div className="mx-auto flex h-12 w-full items-center justify-between bg-gray-50/50 px-6">
        {/* Left: Preview Toggle */}
        <div className="flex items-center gap-2">
          <span className={`whitespace-nowrap text-xs font-bold transition-colors ${showPreview ? 'text-[#00a99d]' : 'text-gray-400'}`}>
            미리보기
          </span>
          <button
            onClick={onTogglePreview}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#00a99d] focus:ring-offset-2 ${showPreview ? 'bg-[#00a99d]' : 'bg-gray-300'
              }`}
          >
            <span
              className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform ${showPreview ? 'translate-x-4' : 'translate-x-1'
                }`}
            />
          </button>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={onTempSave}
            className="hidden whitespace-nowrap sm:inline-flex items-center gap-1.5 rounded-md border border-blue-300 bg-blue-50 text-blue-700 px-3 py-1.5 text-xs font-bold shadow-sm transition-all hover:bg-blue-100 hover:border-blue-400"
            title="현재 작성 중인 내용을 임시 저장합니다"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
              <polyline points="17 21 17 13 7 13 7 21" />
              <polyline points="7 3 7 8 15 8" />
            </svg>
            임시저장
          </button>

          <button
            className="flex items-center gap-1.5 whitespace-nowrap rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-bold text-gray-700 shadow-sm transition-all hover:border-[#f97316] hover:text-[#f97316] active:scale-95"
            onClick={onReset}
            title="작성한 내용을 초기 상태로 돌립니다"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 6h18" />
              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
              <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
            </svg>
            초기화
          </button>

          <button
            className="flex items-center gap-1.5 whitespace-nowrap rounded-md bg-[#00a99d] px-4 py-1.5 text-xs font-bold text-white shadow-md transition-all hover:bg-[#008a81] hover:shadow-lg active:scale-95 active:translate-y-0"
            onClick={onExportPdf}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            PDF / 인쇄
          </button>
        </div>
      </div>
    </header>
  );
};
