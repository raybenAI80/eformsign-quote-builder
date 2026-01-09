import React, { useState, useEffect } from 'react';
import Joyride, { CallBackProps, STATUS, Step, ACTIONS, EVENTS } from 'react-joyride';

const ONBOARDING_KEY = 'eformsign_quote_onboarding_completed';

interface OnboardingTourProps {
    run: boolean;
    onComplete: () => void;
}

const steps: Step[] = [
    {
        target: 'body',
        content: (
            <div className="text-center">
                <h2 className="text-xl font-bold text-gray-900 mb-3">👋 eformsign 견적서 빌더에 오신 것을 환영합니다!</h2>
                <p className="text-gray-600">
                    이 가이드를 통해 견적서 작성 방법을 빠르게 알아보세요.
                </p>
            </div>
        ),
        placement: 'center',
        disableBeacon: true,
    },
    {
        target: '[data-tour="step-bar"]',
        content: (
            <div>
                <h3 className="font-bold text-gray-900 mb-2">📋 작업 단계</h3>
                <p className="text-gray-600 text-sm">
                    견적서 작성은 4단계로 진행됩니다:
                </p>
                <ul className="mt-2 text-sm text-gray-600 space-y-1">
                    <li>• <strong>기본 정보</strong>: 견적 일자, 고객사, 담당자 정보</li>
                    <li>• <strong>항목</strong>: 서비스 및 옵션 추가</li>
                    <li>• <strong>옵션</strong>: 브랜딩, 프리셋 관리</li>
                    <li>• <strong>기록</strong>: 스냅샷 및 히스토리</li>
                </ul>
            </div>
        ),
        placement: 'bottom',
    },
    {
        target: '[data-tour="workspace"]',
        content: (
            <div>
                <h3 className="font-bold text-gray-900 mb-2">✏️ 작업 영역</h3>
                <p className="text-gray-600 text-sm">
                    선택한 탭에 따라 이 영역에서 정보를 입력하고 수정할 수 있습니다.
                    각 필드를 채워가며 견적서를 완성하세요.
                </p>
            </div>
        ),
        placement: 'right',
    },
    {
        target: '[data-tour="step-bar"]',
        content: (
            <div>
                <h3 className="font-bold text-gray-900 mb-2">📦 항목 관리</h3>
                <p className="text-gray-600 text-sm mb-2">
                    상단의 <strong>"항목"</strong> 탭을 클릭하면 다양한 <strong>프리셋</strong>을 확인할 수 있습니다.
                </p>
                <ul className="text-sm text-gray-600 space-y-1">
                    <li>• 프리셋 버튼을 클릭하여 항목 추가</li>
                    <li>• 목적에 맞게 수량, 단가, 할인율 수정</li>
                    <li>• 드래그하여 항목 순서 변경 가능</li>
                </ul>
            </div>
        ),
        placement: 'bottom',
    },
    {
        target: '[data-tour="preview-panel"]',
        content: (
            <div>
                <h3 className="font-bold text-gray-900 mb-2">👁️ 실시간 미리보기</h3>
                <p className="text-gray-600 text-sm">
                    입력한 내용이 실제 견적서에 어떻게 보이는지 실시간으로 확인할 수 있습니다.
                    최종 출력물과 동일한 형태로 미리 확인하세요.
                </p>
            </div>
        ),
        placement: 'left',
    },
    {
        target: '[data-tour="header-actions"]',
        content: (
            <div>
                <h3 className="font-bold text-gray-900 mb-2">📤 내보내기 & 저장</h3>
                <p className="text-gray-600 text-sm">
                    견적서 작성이 완료되면 여기서 PDF로 내보낼 수 있습니다.
                    임시 저장도 가능합니다.
                </p>
            </div>
        ),
        placement: 'bottom',
    },
    {
        target: 'body',
        content: (
            <div className="text-center">
                <h2 className="text-xl font-bold text-gray-900 mb-3">🎉 준비 완료!</h2>
                <p className="text-gray-600">
                    이제 견적서를 작성해보세요.<br />
                    언제든지 헤더의 <strong>사용가이드</strong> 버튼을 클릭하면<br />
                    이 가이드를 다시 볼 수 있습니다.
                </p>
            </div>
        ),
        placement: 'center',
    },
];

// 한글 locale 설정
const koreanLocale = {
    back: '이전',
    close: '닫기',
    last: '완료',
    next: '다음',
    nextLabelWithProgress: '다음',
    open: '열기',
    skip: '건너뛰기',
};

// 항목 관리 단계의 인덱스 (0부터 시작)
const ITEM_MANAGEMENT_STEP_INDEX = 3;

interface OnboardingTourPropsWithTab {
    run: boolean;
    onComplete: () => void;
    onTabChange?: (tab: string) => void;
}

export const OnboardingTour: React.FC<OnboardingTourPropsWithTab> = ({ run, onComplete, onTabChange }) => {
    const handleJoyrideCallback = (data: CallBackProps) => {
        const { status, action, index, type } = data;
        const finishedStatuses: string[] = [STATUS.FINISHED, STATUS.SKIPPED];

        // 항목 관리 단계에 도달했을 때 "항목" 탭으로 전환
        if (type === EVENTS.STEP_AFTER && index === ITEM_MANAGEMENT_STEP_INDEX - 1 && action === ACTIONS.NEXT) {
            onTabChange?.('items');
        }

        // 이전 버튼으로 돌아갈 때 적절한 탭으로 복귀
        if (type === EVENTS.STEP_AFTER && index === ITEM_MANAGEMENT_STEP_INDEX && action === ACTIONS.PREV) {
            onTabChange?.('basic');
        }

        if (finishedStatuses.includes(status)) {
            localStorage.setItem(ONBOARDING_KEY, 'true');
            onComplete();
        }
    };

    return (
        <Joyride
            steps={steps}
            run={run}
            continuous
            showSkipButton
            scrollToFirstStep
            disableOverlayClose
            hideCloseButton={false}
            callback={handleJoyrideCallback}
            locale={koreanLocale}
            styles={{
                options: {
                    primaryColor: '#0070B0',
                    zIndex: 10000,
                },
                tooltip: {
                    borderRadius: 12,
                    padding: 20,
                },
                buttonNext: {
                    borderRadius: 8,
                    padding: '10px 20px',
                    fontWeight: 600,
                },
                buttonBack: {
                    borderRadius: 8,
                    padding: '10px 20px',
                    marginRight: 8,
                },
                buttonSkip: {
                    color: '#999',
                },
            }}
        />
    );
};

// Helper function to check if onboarding has been completed
export const hasCompletedOnboarding = (): boolean => {
    return localStorage.getItem(ONBOARDING_KEY) === 'true';
};

// Helper function to reset onboarding (for "도움말" button)
export const resetOnboarding = (): void => {
    localStorage.removeItem(ONBOARDING_KEY);
};
