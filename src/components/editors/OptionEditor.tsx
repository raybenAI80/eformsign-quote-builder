import React, { useState } from 'react';
import { QuoteMeta, QuotePreset } from '../../types';
import { toast } from 'sonner';

interface OptionEditorProps {
  meta: QuoteMeta;
  setMeta: React.Dispatch<React.SetStateAction<QuoteMeta>>;
  presets: QuotePreset[];
  actions: {
    savePreset: (name: string) => void;
    applyPreset: (id: string) => void;
    applyPresetAsNew: (id: string) => void;
    deletePreset: (id: string) => void;
  };
  isEditing: boolean;
  openConfirm: (title: string, message: string, onConfirm: () => void, isDestructive?: boolean) => void;
  onTabChange: (tab: 'basic') => void;
}

const BRANDING_OPTIONS: Array<{
  id: QuoteMeta['brandingMode'];
  label: string;
  desc: string;
  icon: string;
}> = [
    { id: 'ai', label: 'AI 견적서', desc: 'AI 초거대 지원과제', icon: '🤖' },
    { id: 'default', label: '일반 견적서', desc: '이폼사인 SaaS', icon: '📄' },
    { id: 'public', label: '공공 견적서', desc: '이폼사인 CSAP', icon: '🏛️' },
  ];

export const OptionEditor: React.FC<OptionEditorProps> = ({
  meta,
  setMeta,
  presets,
  actions,
  isEditing,
  openConfirm,
  onTabChange,
}) => {
  const [loadModal, setLoadModal] = useState<{ isOpen: boolean; presetId: string | null }>({
    isOpen: false,
    presetId: null,
  });

  const handleLoadClick = (id: string) => {
    setLoadModal({ isOpen: true, presetId: id });
  };

  const handleLoadConfirm = (mode: 'continue' | 'new') => {
    if (!loadModal.presetId) return;

    if (mode === 'continue') {
      actions.applyPreset(loadModal.presetId);
      toast.success('템플릿을 불러왔습니다.');
    } else {
      actions.applyPresetAsNew(loadModal.presetId);
      toast.success('템플릿으로 새로 작성을 시작합니다.');
    }
    setLoadModal({ isOpen: false, presetId: null });
    onTabChange('basic');
  };

  return (
    <div className="space-y-8">
      {/* Branding Settings */}
      <section className={!isEditing ? 'opacity-60 pointer-events-none' : ''}>
        <h2 className="section-heading mb-4">브랜딩 설정</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {BRANDING_OPTIONS.map(option => (
            <button
              key={option.id}
              type="button"
              onClick={() => setMeta(prev => ({ ...prev, brandingMode: option.id }))}
              className={`relative flex flex-col items-center justify-center rounded-xl border-2 p-4 text-center transition-all ${meta.brandingMode === option.id
                ? 'border-[var(--forcs-blue)] bg-[var(--forcs-blue-light)] text-[var(--forcs-blue)] ring-1 ring-[var(--forcs-blue)]'
                : 'border-transparent bg-white text-gray-500 hover:bg-gray-50 hover:text-gray-900 shadow-sm'
                }`}
            >
              <div className="mb-2 text-2xl h-8 flex items-center justify-center">
                {option.id === 'ai' ? (
                  <img src="/ai-icon.png" alt="AI" className="h-8 w-auto" />
                ) : (
                  option.icon
                )}
              </div>
              <div className="text-sm font-bold">{option.label}</div>
              <div className="text-[11px] opacity-80">{option.desc}</div>

              {meta.brandingMode === option.id && (
                <div className="absolute right-2 top-2 text-[var(--forcs-blue)]">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
            </button>
          ))}
        </div>
      </section>

      {/* 표시 설정 */}
      <section className={!isEditing ? 'opacity-60 pointer-events-none' : ''}>
        <h2 className="section-heading mb-4">표시 설정</h2>
        <div className="rounded-2xl border border-[var(--forcs-border)] bg-white p-5 shadow-sm">
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <span className="text-sm font-bold text-gray-800">할인율 컬럼 표시</span>
              <p className="text-xs text-gray-500 mt-0.5">
                견적서에서 할인율 열을 표시합니다. 숨겨도 할인 계산은 그대로 적용됩니다.
              </p>
            </div>
            <div className="relative ml-4 shrink-0">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={meta.showDiscount !== false}
                onChange={(e) => setMeta(prev => ({ ...prev, showDiscount: e.target.checked }))}
              />
              <div className="w-11 h-6 bg-gray-200 rounded-full peer-checked:bg-[var(--forcs-blue)] transition-colors"></div>
              <div className="absolute left-[2px] top-[2px] w-5 h-5 bg-white rounded-full shadow transition-transform peer-checked:translate-x-5"></div>
            </div>
          </label>

          {/* 직인 표시 설정 */}
          <div className="mt-5 pt-5 border-t border-gray-100">
            <div className="mb-2">
              <span className="text-sm font-bold text-gray-800">직인 표시</span>
              <p className="text-xs text-gray-500 mt-0.5">
                대표이사명 옆 직인 영역의 표시 방식을 선택합니다.
              </p>
            </div>
            <div className="flex gap-2 mt-2">
              {([
                { id: 'stamped' as const, label: '직인 표시', icon: '🔴' },
                { id: 'omitted' as const, label: '직인 생략', icon: '📝' },
                { id: 'hidden' as const, label: '숨김', icon: '👁️‍🗨️' },
              ]).map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setMeta(prev => ({ ...prev, sealMode: opt.id }))}
                  className={`flex-1 rounded-xl border-2 px-3 py-2.5 text-center transition-all ${
                    meta.sealMode === opt.id
                      ? 'border-[var(--forcs-blue)] bg-blue-50 text-[var(--forcs-blue)] shadow-sm'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                  }`}
                >
                  <div className="text-lg mb-0.5">{opt.icon}</div>
                  <div className="text-xs font-bold">{opt.label}</div>
                </button>
              ))}
            </div>

            {/* 직인 이미지 업로드 (직인 표시 모드일 때만) */}
            {meta.sealMode === 'stamped' && (
              <div className="mt-3 rounded-lg border border-dashed border-gray-300 bg-gray-50 p-3">
                {meta.sealImage ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <img src={meta.sealImage} alt="직인 미리보기" className="object-contain rounded border border-gray-200 bg-white p-1" style={{ width: `${meta.sealSize ?? 48}px`, height: `${meta.sealSize ?? 48}px` }} />
                      <div className="flex-1">
                        <p className="text-xs font-bold text-gray-700">직인 이미지 등록됨</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">PNG/JPG 투명 배경 권장</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setMeta(prev => ({ ...prev, sealImage: undefined, sealSize: undefined, sealOffsetX: undefined, sealOffsetY: undefined }))}
                        className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-100 transition-colors"
                      >
                        삭제
                      </button>
                    </div>
                    {/* 크기/위치 조절 */}
                    <div className="grid grid-cols-3 gap-3 pt-2 border-t border-gray-200">
                      <label className="block">
                        <span className="text-[10px] font-bold text-gray-500 block mb-1">크기 ({meta.sealSize ?? 48}px)</span>
                        <input type="range" min={20} max={120} step={2} value={meta.sealSize ?? 48}
                          onChange={(e) => setMeta(prev => ({ ...prev, sealSize: Number(e.target.value) }))}
                          className="w-full accent-[var(--forcs-blue)]" />
                      </label>
                      <label className="block">
                        <span className="text-[10px] font-bold text-gray-500 block mb-1">가로 ({meta.sealOffsetX ?? 0}px)</span>
                        <input type="range" min={-40} max={40} step={1} value={meta.sealOffsetX ?? 0}
                          onChange={(e) => setMeta(prev => ({ ...prev, sealOffsetX: Number(e.target.value) }))}
                          className="w-full accent-[var(--forcs-blue)]" />
                      </label>
                      <label className="block">
                        <span className="text-[10px] font-bold text-gray-500 block mb-1">세로 ({meta.sealOffsetY ?? 0}px)</span>
                        <input type="range" min={-40} max={40} step={1} value={meta.sealOffsetY ?? 0}
                          onChange={(e) => setMeta(prev => ({ ...prev, sealOffsetY: Number(e.target.value) }))}
                          className="w-full accent-[var(--forcs-blue)]" />
                      </label>
                    </div>
                  </div>
                ) : (
                  <label className="flex flex-col items-center gap-2 cursor-pointer py-2">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-200 text-gray-500">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="17 8 12 3 7 8" />
                        <line x1="12" y1="3" x2="12" y2="15" />
                      </svg>
                    </div>
                    <span className="text-xs font-bold text-gray-600">직인 이미지 업로드</span>
                    <span className="text-[10px] text-gray-400">PNG/JPG · 투명 배경 권장 · 최대 500KB</span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        if (file.size > 500 * 1024) {
                          toast.error('직인 이미지는 500KB 이하만 가능합니다.');
                          return;
                        }
                        const reader = new FileReader();
                        reader.onload = () => {
                          const result = reader.result as string;
                          setMeta(prev => ({ ...prev, sealImage: result }));
                          toast.success('직인 이미지가 등록되었습니다.');
                        };
                        reader.readAsDataURL(file);
                        e.target.value = ''; // reset for re-upload
                      }}
                    />
                  </label>
                )}
              </div>
            )}
          </div>

          {/* 끝전 절사 설정 */}
          <div className="mt-5 pt-5 border-t border-gray-100">
            <div className="mb-2">
              <span className="text-sm font-bold text-gray-800">끝전 절사</span>
              <p className="text-xs text-gray-500 mt-0.5">
                합계 금액을 선택한 단위로 내림합니다.
              </p>
            </div>
            <div className="flex gap-2 mt-2">
              {([
                { id: 0, label: '사용 안 함' },
                { id: 10000, label: '만원' },
                { id: 100000, label: '십만원' },
                { id: 1000000, label: '백만원' },
              ]).map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setMeta(prev => ({ ...prev, roundingUnit: opt.id }))}
                  className={`flex-1 rounded-xl border-2 px-3 py-2.5 text-center transition-all ${
                    (meta.roundingUnit ?? 0) === opt.id
                      ? 'border-[var(--forcs-blue)] bg-blue-50 text-[var(--forcs-blue)] shadow-sm'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                  }`}
                >
                  <div className="text-xs font-bold">{opt.label}</div>
                </button>
              ))}
            </div>
            <p className="text-[11px] text-gray-400 mt-2 leading-relaxed">
              깎인 금액은 견적서에 &lsquo;단수 절사&rsquo; 항목으로 부가세 아래에 표시되며, 공급가액과 부가세는 절사 전 금액이 그대로 유지됩니다.
              지원사업용 모드에서는 적용되지 않습니다.
            </p>
          </div>
        </div>
      </section>

      {/* Presets */}
      <section className={!isEditing ? 'opacity-60 pointer-events-none' : ''}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="section-heading mb-0">견적 템플릿</h2>
          <span className="text-xs text-[color:var(--forcs-text-muted)]">
            자주 쓰는 견적 양식을 템플릿으로 저장하고 시작할 때 불러오세요.
          </span>
        </div>

        <div className="rounded-2xl border border-[var(--forcs-border)] bg-white p-5 shadow-sm">
          <div className="space-y-3">
            {presets.length === 0 ? (
              <div className="flex h-40 flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50 text-gray-400">
                <span className="text-2xl mb-2">💾</span>
                <p className="text-sm mb-3">저장된 템플릿이 없습니다.</p>
                <button
                  onClick={() => onTabChange('basic')}
                  className="rounded-lg bg-white border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50 hover:text-gray-900 transition-colors"
                >
                  기본 정보 입력하러 가기 →
                </button>
              </div>
            ) : (
              presets.map(preset => (
                <div
                  key={preset.id}
                  onClick={() => handleLoadClick(preset.id)}
                  className="group relative flex cursor-pointer items-center justify-between rounded-xl border border-[var(--forcs-border)] bg-white p-4 transition-all hover:border-[var(--forcs-blue)] hover:shadow-md"
                >
                  <div className="flex-1 min-w-0 mr-4">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-[var(--forcs-text)] truncate">
                        {preset.name}
                      </span>
                      <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500">
                        {new Date(preset.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-[color:var(--forcs-text-muted)]">
                      <span>항목 {preset.items.length}개</span>
                      <span className="w-px h-3 bg-gray-300"></span>
                      <span>
                        {preset.summary
                          ? `${preset.summary.grand.toLocaleString()}원`
                          : '금액 정보 없음'}
                      </span>
                      <span className="w-px h-3 bg-gray-300"></span>
                      <span>{preset.meta.customerName || '고객사 미지정'}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      className="rounded-lg bg-[var(--forcs-blue)] px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-[var(--forcs-blue-dark)]"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleLoadClick(preset.id);
                      }}
                    >
                      불러오기
                    </button>
                    <button
                      className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50 hover:border-red-200"
                      onClick={(e) => {
                        e.stopPropagation();
                        openConfirm(
                          '템플릿 삭제',
                          '정말 이 템플릿을 삭제하시겠습니까?',
                          () => {
                            actions.deletePreset(preset.id);
                            toast.success('템플릿이 삭제되었습니다.');
                          },
                          true
                        );
                      }}
                    >
                      삭제
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* Load Option Modal */}
      {loadModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-gray-900 mb-2">템플릿 불러오기</h3>
            <p className="text-sm text-gray-500 mb-6 leading-relaxed">
              선택한 템플릿을 어떻게 불러오시겠습니까?
            </p>

            <div className="grid grid-cols-1 gap-3">
              <button
                onClick={() => handleLoadConfirm('new')}
                className="flex items-center gap-3 rounded-xl border border-[var(--forcs-blue)] bg-[var(--forcs-blue-light)] p-4 text-left transition-colors hover:bg-blue-100"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--forcs-blue)] text-white">
                  ✨
                </div>
                <div>
                  <div className="font-bold text-[var(--forcs-blue)]">새로 작성하기</div>
                  <div className="text-xs text-[var(--forcs-blue)] opacity-80">
                    항목과 정보만 가져오고, 날짜와 번호는 새로 생성합니다.
                  </div>
                </div>
              </button>

              <button
                onClick={() => handleLoadConfirm('continue')}
                className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 text-left transition-colors hover:bg-gray-50"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500">
                  📄
                </div>
                <div>
                  <div className="font-bold text-gray-900">이어서 작성하기</div>
                  <div className="text-xs text-gray-500">
                    저장된 시점의 모든 내용(날짜, 번호 포함)을 그대로 불러옵니다.
                  </div>
                </div>
              </button>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setLoadModal({ isOpen: false, presetId: null })}
                className="text-sm font-medium text-gray-500 hover:text-gray-700"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
