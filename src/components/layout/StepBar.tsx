import React from 'react';


export type TabId = 'basic' | 'items' | 'options' | 'history';

interface StepBarProps {
    activeTab: TabId;
    onTabChange: (id: TabId) => void;
    itemsCount: number;
    historyCount: number;
    stepStates: Record<TabId, 'ok' | 'pending' | 'error'>;
}

// 옵션 설정 - 슬라이더 조절 아이콘
const stepOptionsIcon = (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
        <line x1="4" y1="6" x2="20" y2="6" />
        <circle cx="8" cy="6" r="2" fill="currentColor" stroke="none" />
        <line x1="4" y1="12" x2="20" y2="12" />
        <circle cx="16" cy="12" r="2" fill="currentColor" stroke="none" />
        <line x1="4" y1="18" x2="20" y2="18" />
        <circle cx="12" cy="18" r="2" fill="currentColor" stroke="none" />
    </svg>
);

// 기본 정보 - 사용자/프로필 아이콘
const stepBasicIcon = (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
    </svg>
);

// 항목 - 리스트/체크리스트 아이콘
const stepItemsIcon = (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <line x1="14" y1="6" x2="21" y2="6" />
        <line x1="14" y1="12" x2="21" y2="12" />
        <line x1="14" y1="18" x2="21" y2="18" />
    </svg>
);

// 기록 - 시계/히스토리 아이콘
const stepHistoryIcon = (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
        <path d="M3 3v5h5" />
        <path d="M12 7v5l4 2" />
    </svg>
);

export const StepBar: React.FC<StepBarProps> = ({
    activeTab,
    onTabChange,
    itemsCount,
    historyCount,
    stepStates,
}) => {
    const steps = [
        { id: 'options', label: '옵션 설정', icon: stepOptionsIcon, num: 1 },
        { id: 'basic', label: '기본 정보', icon: stepBasicIcon, num: 2 },
        { id: 'items', label: '항목', badge: `${itemsCount || 0}건`, icon: stepItemsIcon, num: 3 },
        { id: 'history', label: '기록', badge: `${historyCount || 0}개`, icon: stepHistoryIcon, num: 4 },
    ];

    // 현재 탭의 인덱스
    const currentIndex = steps.findIndex(s => s.id === activeTab);

    // 반응형 처리를 위한 ResizeObserver, Header.tsx와 동일한 방식
    const containerRef = React.useRef<HTMLDivElement>(null);
    const [width, setWidth] = React.useState(1000);

    React.useEffect(() => {
        if (!containerRef.current) return;

        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                setWidth(entry.contentRect.width);
            }
        });

        observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, []);

    const showFullLabel = width > 480;
    const showBadge = width > 550;

    return (
        <div className="w-full" ref={containerRef} data-tour="step-bar">
            <div className={`flex w-full items-center gap-1 rounded-[24px] bg-[#f7fbfa] shadow-lg shadow-[rgba(0,0,0,0.04)] ${showFullLabel ? 'px-3 py-2.5' : 'px-1.5 py-2'}`}>
                {steps.map((step, index) => {
                    const active = activeTab === step.id;
                    const state = stepStates[step.id as TabId];
                    const dotClass = state === 'ok' ? 'bg-[var(--forcs-blue)]' : 'bg-gray-300';

                    // 이전 단계가 완료되었고, 현재 탭이 아닌 경우 펄스 애니메이션
                    const prevStepCompleted = index > 0 && stepStates[steps[index - 1].id as TabId] === 'ok';
                    const shouldPulse = !active && prevStepCompleted && state !== 'ok';

                    // 아주 좁을 때(showFullLabel false)는 활성화된 탭만 라벨을 보여줄지, 아예 다 숨길지 결정
                    // 여기서는 깔끔하게 선택된 탭은 라벨을 보여주고, 나머지는 아이콘만 보여주는 하이브리드 방식 시도
                    // 공간이 너무 좁으면(350px 이하) 선택된 탭도 라벨 숨김
                    const isVeryNarrow = width < 350;
                    const shouldShowLabel = showFullLabel || (active && !isVeryNarrow);

                    return (
                        <React.Fragment key={step.id}>
                            {/* 화살표 (첫 번째 탭 제외) */}
                            {index > 0 && (
                                <span className={`text-gray-300 text-sm font-light ${showFullLabel ? 'px-0.5' : 'px-0'}`}>→</span>
                            )}
                            <button
                                className={`group relative flex flex-1 items-center justify-center rounded-xl transition-all shadow-sm ${active
                                    ? 'bg-white text-[var(--forcs-blue)] shadow-md ring-1 ring-[var(--forcs-blue)]'
                                    : 'bg-white/90 text-[color:var(--forcs-text-muted)] hover:shadow hover:ring-1 hover:ring-[var(--forcs-border)]'
                                    } ${shouldPulse ? 'animate-pulse-ring' : ''} ${showFullLabel ? 'px-3 py-2 gap-2' : 'px-1.5 py-1.5 gap-1.5'}`}
                                onClick={() => onTabChange(step.id as TabId)}
                                title={!shouldShowLabel ? step.label : undefined}
                            >
                                <span className={`flex shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${active ? 'bg-[var(--forcs-blue-light)] text-[var(--forcs-blue)]' : 'bg-gray-100 text-gray-500'} ${showFullLabel ? 'h-7 w-7' : 'h-6 w-6'}`}>
                                    {state === 'ok' ? (
                                        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--forcs-blue)]">
                                            <polyline points="20 6 9 17 4 12" />
                                        </svg>
                                    ) : active ? step.num : step.icon}
                                </span>

                                {shouldShowLabel && (
                                    <span className="flex flex-col items-start leading-tight overflow-hidden">
                                        <span className={`text-[11px] font-bold whitespace-nowrap ${active ? 'text-[var(--forcs-blue)]' : 'text-gray-700'}`}>
                                            {step.label}
                                        </span>
                                        {step.badge && showBadge && (
                                            <span className={`text-[10px] font-medium ${active ? 'text-[var(--forcs-blue)]/70' : 'text-gray-400'}`}>
                                                {step.badge}
                                            </span>
                                        )}
                                    </span>
                                )}

                                {showFullLabel && (
                                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dotClass} ${active ? 'ring-2 ring-[var(--forcs-blue-light)]' : ''}`} />
                                )}
                            </button>
                        </React.Fragment>
                    );
                })}
            </div>
        </div>
    );
};
