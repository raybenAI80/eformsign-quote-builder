import React, { useState } from 'react';
import { QuoteSnapshot, QuotePreset } from '../../types';
import { toast } from 'sonner';

interface HistoryEditorProps {
    history: QuoteSnapshot[];
    presets: QuotePreset[];
    actions: {
        saveSnapshot: (label?: string) => void;
        restoreSnapshot: (id: string) => void;
        deleteSnapshot: (id: string) => void;
        clearHistory?: () => void;
        savePreset: (name: string) => void;
        loadPreset: (id: string) => void;
        deletePreset: (id: string) => void;
    };
    openConfirm?: (title: string, message: string, onConfirm: () => void, isDestructive?: boolean) => void;
    onPreview?: (snapshot: QuoteSnapshot | null) => void;
    previewId?: string;
}

export const HistoryEditor: React.FC<HistoryEditorProps> = ({
    history,
    presets,
    actions,
    openConfirm,
    onPreview,
    previewId
}) => {
    const [snapshotLabel, setSnapshotLabel] = useState('');
    const [templateName, setTemplateName] = useState('');

    const handleClearAll = () => {
        if (openConfirm && actions.clearHistory) {
            openConfirm(
                '히스토리 전체 삭제',
                '저장된 모든 작업 기록이 삭제됩니다. 계속하시겠습니까?',
                () => {
                    actions.clearHistory!();
                    toast.success('히스토리가 초기화되었습니다.');
                },
                true
            );
        } else if (actions.clearHistory) {
            if (confirm('모든 기록을 삭제하시겠습니까?')) {
                actions.clearHistory();
                toast.success('히스토리가 초기화되었습니다.');
            }
        }
    };

    const handleDelete = (id: string) => {
        if (openConfirm) {
            openConfirm(
                '버전 삭제',
                '선택한 버전을 삭제하시겠습니까?',
                () => {
                    actions.deleteSnapshot(id);
                    toast.success('버전이 삭제되었습니다.');
                    if (previewId === id && onPreview) {
                        onPreview(null);
                    }
                },
                true
            );
        } else if (confirm('선택한 버전을 삭제하시겠습니까?')) {
            actions.deleteSnapshot(id);
            toast.success('버전이 삭제되었습니다.');
            if (previewId === id && onPreview) {
                onPreview(null);
            }
        }
    };

    return (
        <div className="space-y-8">
            {/* Version Management Section */}
            <section>
                <div className="mb-4 flex items-center justify-between">
                    <h2 className='section-heading mb-0'>견적서 버전 관리</h2>
                    {history.length > 0 && (
                        <button
                            onClick={handleClearAll}
                            className="text-xs text-red-500 hover:text-red-700 hover:underline"
                        >
                            전체 삭제
                        </button>
                    )}
                </div>

                <div className='rounded-2xl border border-[var(--forcs-border)] bg-white p-5 shadow-sm'>
                    <div className='flex gap-2 mb-6'>
                        <input
                            className='input-field flex-1'
                            placeholder='현재 버전 메모 (예: 할인 10% 적용안)'
                            value={snapshotLabel}
                            onChange={e => setSnapshotLabel(e.target.value)}
                            onKeyDown={e => {
                                if (e.key === 'Enter') {
                                    actions.saveSnapshot(snapshotLabel);
                                    setSnapshotLabel('');
                                    toast.success('현재 버전이 저장되었습니다.');
                                }
                            }}
                        />
                        <button
                            className='px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded-lg shadow-sm hover:bg-blue-700 transition-colors whitespace-nowrap flex items-center gap-1.5'
                            onClick={() => {
                                actions.saveSnapshot(snapshotLabel);
                                setSnapshotLabel('');
                                toast.success('현재 버전이 저장되었습니다.');
                            }}
                        >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                                <polyline points="17 21 17 13 7 13 7 21" />
                                <polyline points="7 3 7 8 15 8" />
                            </svg>
                            현재 버전 저장
                        </button>
                    </div>

                    <div className='space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar pr-1'>
                        {history.length === 0 ? (
                            <div className="flex h-32 flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50 text-gray-400">
                                <span className="text-2xl mb-2">🕰️</span>
                                <p className="text-sm">저장된 버전이 없습니다.</p>
                            </div>
                        ) : (
                            history.map(snap => {
                                const isPreviewing = previewId === snap.id;
                                return (
                                    <div
                                        key={snap.id}
                                        className={`group relative flex items-center justify-between rounded-xl border p-4 transition-all ${isPreviewing
                                            ? 'border-[var(--forcs-blue)] bg-blue-50/50 ring-1 ring-[var(--forcs-blue)]'
                                            : 'border-[var(--forcs-border)] bg-white hover:border-[var(--forcs-blue)] hover:shadow-md'
                                            }`}
                                    >
                                        <div className="flex-1 min-w-0 mr-4">
                                            {/* 버전명 라인 */}
                                            <div className='flex items-center gap-2 mb-2'>
                                                <span className='font-bold text-[var(--forcs-text)] truncate text-sm'>
                                                    {snap.meta.quoteNo || '견적번호 없음'}
                                                </span>
                                                {isPreviewing && (
                                                    <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-800">
                                                        미리보기 중
                                                    </span>
                                                )}
                                            </div>

                                            {/* 메모 표시 (있을 경우) */}
                                            {snap.label && (
                                                <div className='mb-2 flex items-center gap-1.5'>
                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-amber-500 shrink-0">
                                                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                                        <polyline points="14 2 14 8 20 8" />
                                                        <line x1="16" y1="13" x2="8" y2="13" />
                                                        <line x1="16" y1="17" x2="8" y2="17" />
                                                    </svg>
                                                    <span className='text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md font-medium'>
                                                        {snap.label}
                                                    </span>
                                                </div>
                                            )}

                                            {/* 요약 정보 */}
                                            <div className='flex items-center gap-3 text-xs text-[color:var(--forcs-text-muted)]'>
                                                <span className='flex items-center gap-1'>
                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400">
                                                        <circle cx="12" cy="12" r="10" />
                                                        <polyline points="12 6 12 12 16 14" />
                                                    </svg>
                                                    {new Date(snap.createdAt).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })} {new Date(snap.createdAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                                <span className="w-px h-3 bg-gray-300"></span>
                                                <span>항목 {snap.items.length}개</span>
                                                <span className="w-px h-3 bg-gray-300"></span>
                                                <span className="font-bold text-[var(--forcs-blue)]">
                                                    {snap.summary.grand.toLocaleString()}원
                                                </span>
                                                <span className="w-px h-3 bg-gray-300"></span>
                                                <span>{snap.meta.customerName || '고객사 미지정'}</span>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                                            {/* Preview Button */}
                                            <button
                                                onClick={() => onPreview && onPreview(isPreviewing ? null : snap)}
                                                className={`rounded-lg p-2 transition-colors ${isPreviewing
                                                    ? 'bg-blue-100 text-blue-600'
                                                    : 'bg-gray-100 text-gray-500 hover:bg-blue-50 hover:text-blue-600'
                                                    }`}
                                                title={isPreviewing ? "미리보기 종료" : "미리보기"}
                                            >
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                                    <circle cx="12" cy="12" r="3" />
                                                </svg>
                                            </button>

                                            {/* Restore Button */}
                                            <button
                                                className='rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-blue-700'
                                                onClick={() => {
                                                    const restore = () => {
                                                        actions.restoreSnapshot(snap.id);
                                                        toast.success('선택한 버전으로 복원되었습니다.');
                                                        if (onPreview) onPreview(null); // Exit preview mode on restore
                                                    };

                                                    if (openConfirm) {
                                                        openConfirm(
                                                            '버전 불러오기',
                                                            '현재 작업 중인 내용이 덮어씌워집니다. 이 버전을 불러오시겠습니까?',
                                                            restore,
                                                            true
                                                        );
                                                    } else if (confirm('이 버전을 불러오시겠습니까?')) {
                                                        restore();
                                                    }
                                                }}
                                            >
                                                불러오기
                                            </button>

                                            {/* Delete Button */}
                                            <button
                                                onClick={() => handleDelete(snap.id)}
                                                className="rounded-lg bg-red-50 p-2 text-red-500 hover:bg-red-100 hover:text-red-700"
                                                title="삭제"
                                            >
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <polyline points="3 6 5 6 21 6" />
                                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                                </svg>
                                            </button>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            </section>

            {/* Save as Template Section */}
            <section>
                <div className="mb-4">
                    <h2 className='section-heading mb-0'>템플릿으로 저장</h2>
                    <p className="text-xs text-[color:var(--forcs-text-muted)] mt-1">
                        현재 작성된 내용을 나중에 다시 사용할 수 있도록 템플릿으로 저장합니다.
                    </p>
                </div>
                <div className='rounded-2xl border border-[var(--forcs-border)] bg-white p-5 shadow-sm'>
                    <div className='flex gap-2'>
                        <input
                            className='input-field flex-1'
                            placeholder='템플릿 이름 (예: SaaS 기본 견적)'
                            value={templateName}
                            onChange={e => setTemplateName(e.target.value)}
                            onKeyDown={e => {
                                if (e.key === 'Enter' && templateName.trim()) {
                                    actions.savePreset(templateName);
                                    setTemplateName('');
                                    toast.success('템플릿이 저장되었습니다.');
                                }
                            }}
                        />
                        <button
                            className='px-4 py-2 bg-purple-600 text-white text-sm font-bold rounded-lg shadow-sm hover:bg-purple-700 transition-colors whitespace-nowrap flex items-center gap-1.5'
                            onClick={() => {
                                if (!templateName.trim()) {
                                    toast.error('템플릿 이름을 입력해 주세요.');
                                    return;
                                }
                                actions.savePreset(templateName);
                                setTemplateName('');
                                toast.success('템플릿이 저장되었습니다.');
                            }}
                        >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                <polyline points="14 2 14 8 20 8" />
                            </svg>
                            템플릿 저장
                        </button>
                    </div>

                    {/* 저장된 템플릿 목록 */}
                    {presets && presets.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-gray-100">
                            <h3 className="text-xs font-bold text-gray-500 mb-3">저장된 템플릿 ({presets.length})</h3>
                            <div className="space-y-2">
                                {presets.map(preset => (
                                    <div
                                        key={preset.id}
                                        className="group flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 hover:border-blue-300 hover:bg-blue-50/50 transition-all"
                                    >
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-purple-500 shrink-0">
                                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                                    <polyline points="14 2 14 8 20 8" />
                                                </svg>
                                                <span className="font-medium text-sm text-gray-800 truncate">{preset.name}</span>
                                            </div>
                                            <div className="flex items-center gap-2 mt-1 text-[10px] text-gray-400">
                                                <span>항목 {preset.items.length}개</span>
                                                <span>•</span>
                                                <span>{new Date(preset.createdAt).toLocaleDateString('ko-KR')}</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => {
                                                    if (openConfirm) {
                                                        openConfirm(
                                                            '템플릿 불러오기',
                                                            '현재 작업 중인 내용이 덮어씌워집니다. 이 템플릿을 불러오시겠습니까?',
                                                            () => {
                                                                actions.loadPreset(preset.id);
                                                                toast.success('템플릿이 적용되었습니다.');
                                                            },
                                                            true
                                                        );
                                                    } else {
                                                        actions.loadPreset(preset.id);
                                                        toast.success('템플릿이 적용되었습니다.');
                                                    }
                                                }}
                                                className="rounded-lg bg-blue-600 px-2.5 py-1 text-[10px] font-bold text-white hover:bg-blue-700"
                                            >
                                                적용
                                            </button>
                                            <button
                                                onClick={() => {
                                                    if (openConfirm) {
                                                        openConfirm(
                                                            '템플릿 삭제',
                                                            `"${preset.name}" 템플릿을 삭제하시겠습니까?`,
                                                            () => {
                                                                actions.deletePreset(preset.id);
                                                                toast.success('템플릿이 삭제되었습니다.');
                                                            },
                                                            true
                                                        );
                                                    } else {
                                                        actions.deletePreset(preset.id);
                                                        toast.success('템플릿이 삭제되었습니다.');
                                                    }
                                                }}
                                                className="rounded-lg bg-red-50 p-1.5 text-red-500 hover:bg-red-100 hover:text-red-700"
                                                title="템플릿 삭제"
                                            >
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                                                </svg>
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
};
