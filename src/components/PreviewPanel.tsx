import React from 'react';
import { QuotePreviewD } from './preview/QuotePreviewD';
import type { PreviewPanelProps } from './preview/previewModel';

/**
 * 견적서 출력물 미리보기. 출력물은 비즈니스형(QuotePreviewD) 하나다.
 * PDF·이미지 내보내기는 이 컴포넌트의 루트(#preview-panel)를 캡처한다.
 */
export const PreviewPanel: React.FC<PreviewPanelProps> = (props) => <QuotePreviewD {...props} />;
