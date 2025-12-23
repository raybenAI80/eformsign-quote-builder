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
    return (
        <div className="w-full">
            <div className="flex w-full items-center gap-2 rounded-[24px] bg-[#f7fbfa] px-3 py-2.5 shadow-lg shadow-[rgba(0,0,0,0.04)]">
                {[
                    { id: 'options', label: '옵션 설정', icon: stepOptionsIcon, num: 1 },
                    { id: 'basic', label: '기본 정보', icon: stepBasicIcon, num: 2 },
                    { id: 'items', label: '항목', badge: `${itemsCount || 0}건`, icon: stepItemsIcon, num: 3 },
                    { id: 'history', label: '기록', badge: `${historyCount || 0}개`, icon: stepHistoryIcon, num: 4 },
                ].map(step => {
                    const active = activeTab === step.id;
                    const state = stepStates[step.id as TabId];
                    const dotClass = state === 'ok' ? 'bg-[var(--forcs-blue)]' : 'bg-gray-300';
                    return (
                        <button
                            key={step.id}
                            className={`group relative flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2 text-center transition-all shadow-sm ${active
                                ? 'bg-white text-[var(--forcs-blue)] shadow-md ring-1 ring-[var(--forcs-blue)]'
                                : 'bg-white/90 text-[color:var(--forcs-text-muted)] hover:shadow hover:ring-1 hover:ring-[var(--forcs-border)]'
                                }`}
                            onClick={() => onTabChange(step.id as TabId)}
                        >
                            <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${active ? 'bg-[var(--forcs-blue-light)] text-[var(--forcs-blue)]' : 'bg-gray-100 text-gray-500'}`}>
                                {active ? step.num : step.icon}
                            </span>
                            <span className="flex flex-col items-start leading-tight">
                                <span className={`text-[11px] font-bold whitespace-nowrap ${active ? 'text-[var(--forcs-blue)]' : 'text-gray-700'}`}>
                                    {step.label}
                                </span>
                                {step.badge && (
                                    <span className={`text-[10px] font-medium ${active ? 'text-[var(--forcs-blue)]/70' : 'text-gray-400'}`}>
                                        {step.badge}
                                    </span>
                                )}
                            </span>
                            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dotClass} ${active ? 'ring-2 ring-[var(--forcs-blue-light)]' : ''}`} />
                        </button>
                    );
                })}
            </div>
        </div>
    );
};
