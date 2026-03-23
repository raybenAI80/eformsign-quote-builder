import React, { useState } from 'react';
import { SavedQuote } from '../types';

interface Props {
  savedQuotes: SavedQuote[];
  onSaveCurrent: (name: string) => void;
  onLoad: (quote: SavedQuote) => void;
  onDelete: (id: string) => void;
  onMergeExport: (selected: SavedQuote[]) => Promise<boolean>;
  onClose: () => void;
  isMerging: boolean;
}

const nf = new Intl.NumberFormat('ko-KR');

export default function SavedQuotesPanel({
  savedQuotes,
  onSaveCurrent,
  onLoad,
  onDelete,
  onMergeExport,
  onClose,
  isMerging,
}: Props) {
  const [saveName, setSaveName] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmLoadId, setConfirmLoadId] = useState<string | null>(null);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const selectedQuotes = selectedIds
    .map(id => savedQuotes.find(q => q.id === id))
    .filter((q): q is SavedQuote => q !== undefined);

  const handleSave = () => {
    if (!saveName.trim()) return;
    onSaveCurrent(saveName.trim());
    setSaveName('');
  };

  const handleMerge = async () => {
    if (selectedQuotes.length === 0) return;
    // App.tsx handles panel close on success via handleMergeExport
    await onMergeExport(selectedQuotes);
  };

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString('ko-KR', {
        year: '2-digit',
        month: '2-digit',
        day: '2-digit',
      });
    } catch {
      return iso.slice(0, 10);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="relative w-full max-w-2xl mx-4 bg-white rounded-xl shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h2 className="text-base font-bold text-gray-800">멀티 견적</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="닫기"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Save current quote */}
        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
          <p className="text-xs text-gray-500 mb-2">현재 작업 중인 견적서를 목록에 저장합니다.</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={saveName}
              onChange={e => setSaveName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
              placeholder="견적서 이름 (예: 문서 5천건 견적)"
              className="flex-1 text-sm border border-gray-300 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
            <button
              onClick={handleSave}
              disabled={!saveName.trim()}
              className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              저장
            </button>
          </div>
        </div>

        {/* Quote list */}
        <div className="flex-1 overflow-y-auto px-5 py-3">
          {savedQuotes.length === 0 ? (
            <div className="text-center text-sm text-gray-400 py-10">
              저장된 견적서가 없습니다.
            </div>
          ) : (
            <ul className="space-y-2">
              {savedQuotes.map(q => {
                const isSelected = selectedIds.includes(q.id);
                const orderIdx = selectedIds.indexOf(q.id);
                return (
                  <li
                    key={q.id}
                    className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors ${
                      isSelected
                        ? 'border-indigo-400 bg-indigo-50'
                        : 'border-gray-200 bg-white hover:bg-gray-50'
                    }`}
                  >
                    {/* Checkbox with order number */}
                    <button
                      onClick={() => toggleSelect(q.id)}
                      className={`relative flex-shrink-0 w-6 h-6 rounded border-2 flex items-center justify-center text-xs font-bold transition-colors ${
                        isSelected
                          ? 'border-indigo-500 bg-indigo-500 text-white'
                          : 'border-gray-300 text-transparent'
                      }`}
                    >
                      {isSelected ? orderIdx + 1 : ''}
                    </button>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2">
                        <span className="text-sm font-semibold text-gray-800 truncate">{q.name}</span>
                        {q.meta.customerName && (
                          <span className="text-xs text-gray-400 truncate">{q.meta.customerName}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-xs text-gray-400">{formatDate(q.savedAt)}</span>
                        {q.summary && (
                          <span className="text-xs text-indigo-700 font-medium">
                            합계 {nf.format(q.summary.grand)}원
                          </span>
                        )}
                        <span className="text-xs text-gray-400">항목 {q.items.length}개</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {confirmLoadId === q.id ? (
                        <div className="flex items-center gap-1 text-xs">
                          <span className="text-amber-600 font-medium">현재 작업이 교체됩니다.</span>
                          <button
                            onClick={() => { onLoad(q); setConfirmLoadId(null); }}
                            className="px-2 py-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          >
                            확인
                          </button>
                          <button
                            onClick={() => setConfirmLoadId(null)}
                            className="px-2 py-1 text-gray-500 hover:bg-gray-100 rounded transition-colors"
                          >
                            취소
                          </button>
                        </div>
                      ) : confirmDeleteId === q.id ? (
                        <>
                          <button
                            onClick={() => { onDelete(q.id); setConfirmDeleteId(null); setSelectedIds(p => p.filter(x => x !== q.id)); }}
                            className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded transition-colors"
                          >
                            삭제 확인
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(null)}
                            className="px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 rounded transition-colors"
                          >
                            취소
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => setConfirmLoadId(q.id)}
                            title="이 견적서 불러오기"
                            className="px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          >
                            불러오기
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(q.id)}
                            title="삭제"
                            className="p-1 text-gray-300 hover:text-red-400 rounded transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 pt-3 pb-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
          {/* Page order preview */}
          {selectedQuotes.length > 0 && (
            <div className="mb-3 rounded-lg bg-indigo-50 border border-indigo-100 px-3 py-2.5">
              <div className="flex items-center gap-1.5 flex-wrap mb-1">
                <svg className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="text-xs font-semibold text-indigo-700">페이지 순서</span>
                {selectedQuotes.map((q, i) => (
                  <React.Fragment key={q.id}>
                    <span className="text-xs text-indigo-800 font-medium bg-white border border-indigo-200 rounded px-1.5 py-0.5">
                      {i + 1}. {q.name}
                    </span>
                    {i < selectedQuotes.length - 1 && (
                      <span className="text-xs text-indigo-400">→</span>
                    )}
                  </React.Fragment>
                ))}
              </div>
              <p className="text-[11px] text-indigo-500">
                선택한 견적서가 순서대로 각 1페이지씩 합쳐져 하나의 PDF 파일로 저장됩니다.
              </p>
            </div>
          )}

          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-gray-400">
              {selectedIds.length > 0 ? `${selectedIds.length}개 선택됨` : '병합할 견적서를 체크하세요'}
            </span>
            <button
              onClick={handleMerge}
              disabled={selectedIds.length === 0 || isMerging}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {isMerging ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  생성 중...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  {selectedIds.length > 0 ? `${selectedIds.length}개 ` : ''}병합 PDF
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
