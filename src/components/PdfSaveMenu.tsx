import React from 'react';
import { createPortal } from 'react-dom';
import type { PdfLayout } from '../utils/pdfLayoutPref';
import { buildPdfLayoutMenuText } from '../utils/pdfLayoutMenuText';

/** 메뉴를 열 때 잰 값. 부제의 쪽 수와 글자 비율은 실제 측정값이다. */
export interface PdfLayoutInfo {
  /** 항목(품목) 수 */
  itemCount: number;
  /** 한 장에 맞출 때 글자가 줄어드는 비율(%). 줄어들지 않으면 100 */
  fitPct: number;
  /** 여러 쪽으로 나눴을 때 쪽 수 */
  pagedPages: number;
}

interface PdfSaveSplitButtonProps {
  /** 현재 기본 방식(마지막으로 고른 방식) */
  layout: PdfLayout;
  /** PDF 본 버튼: 기억된 방식으로 저장 */
  onExport: () => void;
  /** 메뉴 항목: 그 방식으로 저장하고 기본값으로 기억 */
  onExportAs: (layout: PdfLayout) => void;
  /** 메뉴를 열 때 호출해 쪽 수·글자 비율을 잰다 */
  getInfo: () => PdfLayoutInfo | null;
  showText: boolean;
}

const CHECK = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const OPTIONS: Array<{ layout: PdfLayout; title: string }> = [
  { layout: 'fit', title: 'A4 한 장에 맞춰 저장' },
  { layout: 'paged', title: '여러 쪽으로 나눠 저장' },
];

/**
 * 헤더의 PDF 분할 버튼: [PDF | ▾]. 본 버튼은 기억된 방식으로 저장하고, ▾ 는 저장 방식 메뉴를 연다.
 * 헤더 안쪽 줄이 overflow-hidden 이라 메뉴는 포털(document.body)로 띄운다.
 */
export const PdfSaveSplitButton: React.FC<PdfSaveSplitButtonProps> = ({ layout, onExport, onExportAs, getInfo, showText }) => {
  const [open, setOpen] = React.useState(false);
  const [info, setInfo] = React.useState<PdfLayoutInfo | null>(null);
  const [pos, setPos] = React.useState<{ top: number; right: number }>({ top: 0, right: 0 });
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const caretRef = React.useRef<HTMLButtonElement>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const menuId = React.useId();
  const menuText = buildPdfLayoutMenuText(info);
  const getMenuItems = (): HTMLElement[] => {
    const nodes = menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitemradio"]');
    return nodes ? Array.from(nodes) : [];
  };

  const openMenu = React.useCallback(() => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (rect) setPos({ top: rect.bottom + 8, right: Math.max(8, window.innerWidth - rect.right) });
    setInfo(getInfo());
    setOpen(true);
  }, [getInfo]);

  const closeMenu = React.useCallback((restoreFocus: boolean) => {
    setOpen(false);
    if (restoreFocus) caretRef.current?.focus();
  }, []);

  // 열릴 때 현재 선택 항목에 포커스
  React.useEffect(() => {
    if (!open) return;
    const items = getMenuItems();
    const selected = items.find(el => el.getAttribute('aria-checked') === 'true');
    (selected ?? items[0])?.focus();
  }, [open]);

  // 바깥 클릭·창 크기 변화로 닫기
  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (menuRef.current?.contains(t) || wrapRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onResize = () => setOpen(false);
    document.addEventListener('mousedown', onDown);
    window.addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('resize', onResize);
    };
  }, [open]);

  const onMenuKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const items = getMenuItems();
    const idx = items.indexOf(document.activeElement as HTMLElement);
    if (e.key === 'Escape') {
      e.preventDefault();
      closeMenu(true);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      items[(idx + 1) % items.length]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      items[(idx - 1 + items.length) % items.length]?.focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      items[0]?.focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      items[items.length - 1]?.focus();
    } else if (e.key === 'Tab') {
      closeMenu(false);
    }
  };

  const onCaretKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault();
      openMenu();
    }
  };

  const choose = (next: PdfLayout) => {
    closeMenu(true);
    onExportAs(next);
  };

  const focusRing = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00a99d] focus-visible:ring-offset-1';

  return (
    <>
      <div ref={wrapRef} className="inline-flex items-stretch rounded-md shadow-md">
        {/* Export PDF — 기억된 방식으로 저장 */}
        <button
          className={`inline-flex items-center gap-1 rounded-l-md bg-[#00a99d] px-2 sm:px-2.5 py-1.5 text-xs font-bold text-white hover:bg-[#008a81] ${focusRing}`}
          onClick={onExport}
          title="PDF / 인쇄"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          {showText && <span>PDF</span>}
        </button>
        {/* 저장 방식 메뉴 */}
        <button
          ref={caretRef}
          className={`inline-flex items-center rounded-r-md border-l border-white/40 bg-[#00a99d] px-1.5 text-white hover:bg-[#008a81] ${focusRing}`}
          onClick={() => (open ? closeMenu(false) : openMenu())}
          onKeyDown={onCaretKeyDown}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls={open ? menuId : undefined}
          aria-label="PDF 저장 방식 선택"
          title="PDF 저장 방식 선택"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      </div>

      {open &&
        createPortal(
          <div
            ref={menuRef}
            id={menuId}
            role="menu"
            aria-label="PDF 쪽 구성"
            onKeyDown={onMenuKeyDown}
            className="fixed z-[1000] w-[344px] rounded-xl border border-gray-200 bg-white p-1.5 shadow-xl [word-break:keep-all] [overflow-wrap:break-word] [line-break:strict]"
            style={{ top: pos.top, right: pos.right }}
          >
            <p role="presentation" className="px-3 pb-2 pt-2 text-xs text-gray-500">
              PDF 쪽 구성 · 항목 <span className="whitespace-nowrap">{info?.itemCount ?? 0}건</span>
            </p>
            {menuText.notice && (
              <p role="presentation" className="px-3 pb-2 text-xs text-gray-500 [text-wrap:pretty]">
                {menuText.notice}
              </p>
            )}
            {OPTIONS.map(opt => {
              const selected = opt.layout === layout;
              return (
                <button
                  key={opt.layout}
                  role="menuitemradio"
                  aria-checked={selected}
                  onClick={() => choose(opt.layout)}
                  className={`flex w-full items-start gap-2 rounded-lg px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#00a99d] ${
                    selected ? 'bg-[#e8f7f5]' : 'hover:bg-gray-50'
                  }`}
                >
                  <span className="mt-0.5 flex h-4 w-4 flex-none items-center justify-center text-[#00a99d]">{selected && CHECK}</span>
                  <span className="min-w-0">
                    <span className="block text-[13px] font-bold text-gray-800">{opt.title}</span>
                    <span className="mt-0.5 block text-xs text-gray-500">{menuText.subtitles[opt.layout]}</span>
                  </span>
                </button>
              );
            })}
            <p role="presentation" className="mt-1 border-t border-gray-100 px-3 pb-2 pt-2.5 text-xs text-gray-500 [text-wrap:pretty]">
              마지막으로 고른 방식이 PDF 버튼의 기본 동작이 됩니다.
            </p>
          </div>,
          document.body
        )}
    </>
  );
};
