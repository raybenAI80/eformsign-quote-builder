import React from 'react';
import { motion } from 'framer-motion';

export type TabId = 'basic' | 'items' | 'options' | 'history';

interface SidebarProps {
    activeTab: TabId;
    onTabChange: (tab: TabId) => void;
}

// 뱃지 상태 타입 정의 (추후 실제 데이터 연동 시 확장 가능)
type BadgeStatus = 'complete' | 'incomplete' | 'error' | 'none';

interface TabItem {
    id: TabId;
    label: string;
    description: string;
    icon: React.ReactNode;
    badge?: BadgeStatus;
}

const TABS: TabItem[] = [
    {
        id: 'basic',
        label: '기본 정보',
        description: '수신처 및 날짜 설정',
        icon: (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
            </svg>
        ),
        badge: 'complete', // 예시 상태
    },
    {
        id: 'items',
        label: '항목 관리',
        description: '견적 항목 추가/수정',
        icon: (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <path d="M16 10a4 4 0 0 1-8 0" />
            </svg>
        ),
        badge: 'incomplete', // 예시 상태
    },
    {
        id: 'options',
        label: '옵션 설정',
        description: '프리셋 및 고급 설정',
        icon: (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
        ),
        badge: 'none',
    },
    {
        id: 'history',
        label: '기록',
        description: '저장된 견적 목록',
        icon: (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
            </svg>
        ),
        badge: 'none',
    },
];

const Badge: React.FC<{ status: BadgeStatus }> = ({ status }) => {
    if (status === 'none') return null;

    const styles = {
        complete: 'bg-green-100 text-green-700',
        incomplete: 'bg-amber-100 text-amber-700',
        error: 'bg-red-100 text-red-700',
    };

    const labels = {
        complete: '완료',
        incomplete: '작성 중',
        error: '오류',
    };

    return (
        <span className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold ${styles[status]}`}>
            {labels[status]}
        </span>
    );
};

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, onTabChange }) => {
    return (
        <nav className="flex h-full w-[240px] flex-col border-r border-[var(--forcs-border)] bg-white">
            {/* Logo Area */}
            <div className="flex h-16 items-center px-6 border-b border-[var(--forcs-border)] bg-white/50 backdrop-blur-sm">
                <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--forcs-blue)] text-white font-bold">
                        Q
                    </div>
                    <div>
                        <h1 className="text-sm font-bold text-[var(--forcs-text)] tracking-tight leading-none">
                            Quote Builder
                        </h1>
                        <span className="text-[10px] text-[var(--forcs-text-muted)]">for eformsign</span>
                    </div>
                </div>
            </div>

            {/* Navigation Items */}
            <div className="flex-1 py-6 px-3 space-y-1 overflow-y-auto">
                <div className="mb-2 px-3 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    Editor Steps
                </div>
                {TABS.map((tab) => {
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => onTabChange(tab.id)}
                            className={`group relative flex w-full flex-col items-start gap-1 rounded-xl px-3 py-3 text-left transition-all duration-200 ${isActive
                                ? 'bg-[var(--forcs-blue-light)]'
                                : 'hover:bg-gray-50'
                                }`}
                        >
                            {isActive && (
                                <motion.div
                                    layoutId="activeTabIndicator"
                                    className="absolute left-0 top-3 bottom-3 w-1 rounded-r-full bg-[var(--forcs-blue)]"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                />
                            )}

                            <div className="flex w-full items-center gap-3">
                                <span className={`transition-colors ${isActive ? 'text-[var(--forcs-blue)]' : 'text-gray-400 group-hover:text-gray-600'}`}>
                                    {tab.icon}
                                </span>
                                <span className={`text-sm font-bold ${isActive ? 'text-[var(--forcs-blue-dark)]' : 'text-[var(--forcs-text)]'}`}>
                                    {tab.label}
                                </span>
                                {/* Badge Placeholder - 추후 실제 데이터 연동 필요 */}
                                {tab.id === 'basic' && <Badge status="complete" />}
                                {tab.id === 'items' && <Badge status="incomplete" />}
                            </div>

                            <span className={`pl-8 text-xs ${isActive ? 'text-[var(--forcs-blue)]/80' : 'text-gray-400'}`}>
                                {tab.description}
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* Footer / Version Info */}
            <div className="p-6 border-t border-[var(--forcs-border)] bg-gray-50/50">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-xs font-medium text-[var(--forcs-text)]">
                            v2.1.0 (Beta)
                        </p>
                        <p className="text-[10px] text-gray-400 mt-0.5">
                            Updated just now
                        </p>
                    </div>
                    <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" title="Online"></div>
                </div>
            </div>
        </nav>
    );
};
