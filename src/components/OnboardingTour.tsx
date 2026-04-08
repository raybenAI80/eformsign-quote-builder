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
                    <li>• <strong>옵션 설정</strong>: 견적서 모드, 할인율 표시 설정, 템플릿 관리</li>
                    <li>• <strong>기본 정보</strong>: 견적 일자, 고객사, 담당자 정보 입력</li>
                    <li>• <strong>항목</strong>: 서비스 및 옵션 항목 구성 (프리셋 활용)</li>
                    <li>• <strong>기록</strong>: 견적서 저장 내역 및 버전 관리</li>
                </ul>
            </div>
        ),
        placement: 'bottom',
        disableBeacon: true,
    },
    {
        target: '[data-tour="workspace"]',
        content: (
            <div>
                <h3 className="font-bold text-gray-900 mb-2">📝 기본 정보 입력</h3>
                <p className="text-gray-600 text-sm">
                    견적 일자, 고객사, 영업 담당자 정보 등 핵심 정보를 입력하세요.
                    로그인 시 담당자 정보는 자동으로 채워집니다.
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
                <h3 className="font-bold text-gray-900 mb-2">📦 항목 관리</h3>
                <p className="text-gray-600 text-sm mb-2">
                    다양한 <strong>프리셋</strong>으로 견적서를 빠르게 구성하세요.
                </p>
                <ul className="text-sm text-gray-600 space-y-1">
                    <li>• <strong>일반 기업용 / 공공기관용 / 지원사업용</strong> 탭으로 섹터 전환</li>
                    <li>• <strong>문서 유형</strong>: Enterprise, 충전형, 구독형(Business/Personal) 프리셋 제공</li>
                    <li>• 충전형은 수량에 따라 단가가 자동 조정됩니다 (10건 이하 1,000원, 11건+ 800원)</li>
                    <li>• 단가에 <strong>"별도", "무료"</strong> 등 텍스트도 입력 가능</li>
                    <li>• 수량, 단가, 할인율 자유 수정 / 드래그로 순서 변경</li>
                    <li>• 지원사업 모드에서는 할인 → <strong>지원금액</strong>으로 표기</li>
                </ul>
            </div>
        ),
        placement: 'bottom',
        disableBeacon: true,
    },
    {
        target: '[data-tour="preview-panel"]',
        content: (
            <div>
                <h3 className="font-bold text-gray-900 mb-2">👁️ 실시간 미리보기</h3>
                <p className="text-gray-600 text-sm mb-2">
                    입력 내용이 실제 견적서에 어떻게 보이는지 실시간으로 확인하세요.
                </p>
                <ul className="text-sm text-gray-600 space-y-1">
                    <li>• 할인 적용 시 <strong className="text-red-500">건당 할인가</strong>가 빨간색으로 표시됩니다</li>
                    <li>• Enterprise 외 견적은 결제 정보가 자동으로 숨겨집니다</li>
                </ul>
            </div>
        ),
        placement: 'left',
        disableBeacon: true,
    },
    {
        target: '[data-tour="header-actions"]',
        content: (
            <div>
                <h3 className="font-bold text-gray-900 mb-2">📤 내보내기 & 저장</h3>
                <ul className="text-sm text-gray-600 space-y-1">
                    <li>• <strong>PDF</strong>: 현재 견적서를 PDF로 내보내기</li>
                    <li>• <strong>임시저장</strong>: 작성 중인 내용 저장</li>
                    <li>• <strong className="text-indigo-600">멀티 견적</strong>: 여러 견적서를 저장하고, 선택한 것들을 하나의 PDF로 병합 다운로드</li>
                </ul>
            </div>
        ),
        placement: 'bottom',
        disableBeacon: true,
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
        disableBeacon: true,
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
    const [stepIndex, setStepIndex] = useState(0);

    useEffect(() => {
        if (run) {
            setStepIndex(0);
        }
    }, [run]);

    const handleJoyrideCallback = (data: CallBackProps) => {
        const { action, index, status, type } = data;
        const finishedStatuses: string[] = [STATUS.FINISHED, STATUS.SKIPPED];

        if (finishedStatuses.includes(status)) {
            localStorage.setItem(ONBOARDING_KEY, 'true');
            onComplete();
        } else if (type === EVENTS.STEP_AFTER || type === EVENTS.TARGET_NOT_FOUND) {
            const nextStepIndex = index + (action === ACTIONS.PREV ? -1 : 1);

            if (index === 1 && action === ACTIONS.NEXT) {
                onTabChange?.('basic');
                setTimeout(() => setStepIndex(nextStepIndex), 100);
            } else if (index === ITEM_MANAGEMENT_STEP_INDEX - 1 && action === ACTIONS.NEXT) {
                onTabChange?.('items');
                setTimeout(() => setStepIndex(nextStepIndex), 100);
            } else if (index === ITEM_MANAGEMENT_STEP_INDEX && action === ACTIONS.PREV) {
                onTabChange?.('basic');
                setTimeout(() => setStepIndex(nextStepIndex), 100);
            } else {
                setStepIndex(nextStepIndex);
            }
        }
    };

    return (
        <Joyride
            steps={steps}
            run={run}
            stepIndex={stepIndex}
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
