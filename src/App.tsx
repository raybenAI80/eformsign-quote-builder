import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Toaster, toast } from 'sonner';

import { useQuote, calculateQuote, getLocalToday } from './hooks/useQuote';
import { useSavedQuotes } from './hooks/useSavedQuotes';
import { exportToImage, exportToPdf, exportMergedPdf, estimatePdfFitScale } from './utils/exportPdf';
import { readPdfLayout, writePdfLayout, type PdfLayout } from './utils/pdfLayoutPref';
import { measureFlowPaper, paginate } from './components/preview/pagination';
import type { PdfLayoutInfo } from './components/PdfSaveMenu';
import { buildPdfTitle, buildPdfKeywords } from './utils/pdfMetadata';

// Layout & Editors
import { MainLayout } from './components/layout/MainLayout';
import { StepBar, TabId } from './components/layout/StepBar';
import { QuoteSnapshot, QuoteMeta, QuoteItem, SavedQuote } from './types';
import { Header } from './components/Header';
import SavedQuotesPanel from './components/SavedQuotesPanel';
import { PreviewPanel } from './components/PreviewPanel';
import { BasicInfoEditor } from './components/editors/BasicInfoEditor';
import { ItemEditor } from './components/editors/ItemEditor';
import { OptionEditor } from './components/editors/OptionEditor';
import { HistoryEditor } from './components/editors/HistoryEditor';
import { ConfirmModal } from './components/ConfirmModal';
import { OnboardingTour, hasCompletedOnboarding, resetOnboarding } from './components/OnboardingTour';

// Auth
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { restoreCustomerPlaceholders } from './utils/referenceNotes';
import { ProtectedRoute } from './components/auth/ProtectedRoute';

function QuoteBuilder() {
  const { user } = useAuth();
  const { meta, items, calculation, presets, history, categoryLabels, actions } = useQuote();
  const { savedQuotes, saveQuote, removeSavedQuote, getSavedQuote } = useSavedQuotes();
  const [activeTab, setActiveTab] = useState<TabId>('options');
  const [showPreview, setShowPreview] = useState(true);
  const [previewSnapshot, setPreviewSnapshot] = useState<QuoteSnapshot | null>(null);
  const [showSavedPanel, setShowSavedPanel] = useState(false);
  const [mergeRenderData, setMergeRenderData] = useState<{ meta: QuoteMeta; items: QuoteItem[] } | null>(null);
  const [isMerging, setIsMerging] = useState(false);
  // PDF 저장 방식: 마지막으로 고른 방식을 사용자 기기에 기억한다 (기본 = A4 한 장에 맞춤)
  const [pdfLayout, setPdfLayout] = useState<PdfLayout>(readPdfLayout);

  // Onboarding Tour State
  const [runTour, setRunTour] = useState(false);

  // 첫 방문 시 자동으로 투어 시작
  useEffect(() => {
    // 약간의 딜레이를 주어 UI가 렌더링된 후 투어 시작
    const timer = setTimeout(() => {
      if (!hasCompletedOnboarding()) {
        setRunTour(true);
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  const handleStartTour = useCallback(() => {
    resetOnboarding();
    setRunTour(true);
  }, []);

  const handleTourComplete = useCallback(() => {
    setRunTour(false);
  }, []);

  // 로그인 시 사용자 정보로 영업 담당자 정보 자동 입력
  useEffect(() => {
    if (user) {
      const userName = user.user_metadata?.full_name || user.user_metadata?.name || '';
      const userEmail = user.email || '';

      // 영업 담당자 이름이 비어있으면 자동 입력
      if (!meta.contactName && userName) {
        actions.setMeta((prev: typeof meta) => ({ ...prev, contactName: userName }));
      }

      // 영업 담당자 이메일이 비어있으면 자동 입력
      if (!meta.contactEmail && userEmail) {
        // 이메일에서 @forcs.com 도메인 제거하여 로컬 부분만 저장
        const emailLocal = userEmail.replace('@forcs.com', '');
        actions.setMeta((prev: typeof meta) => ({ ...prev, contactEmail: emailLocal }));
      }
    }
  }, [user]); // user 변경 시에만 실행 (meta, actions는 의존성에서 제외하여 무한 루프 방지)

  // Confirm Modal State
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    isDestructive?: boolean;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => { },
  });

  const closeConfirmModal = useCallback(() => {
    setConfirmModal(prev => ({ ...prev, isOpen: false }));
  }, []);

  const openConfirm = useCallback(
    (title: string, message: string, onConfirm: () => void, isDestructive = false) => {
      setConfirmModal({
        isOpen: true,
        title,
        message,
        onConfirm: () => {
          onConfirm();
          closeConfirmModal();
        },
        isDestructive,
      });
    },
    [closeConfirmModal]
  );

  const validation = useMemo(() => {
    const metaErrors: string[] = [];
    if (!meta.quoteDate) metaErrors.push('[견적 정보] 견적 일자를 입력해 주세요.');
    if (!meta.contactInitials || meta.contactInitials.trim().length < 2) metaErrors.push('[견적 정보] 담당자 이니셜을 2자 이상 입력해 주세요.');
    if (!meta.issueSequence) metaErrors.push('[견적 정보] 발행 순번을 입력해 주세요.');
    if (!meta.customerName?.trim()) metaErrors.push('[고객사] 고객사명을 입력해 주세요.');
    if (!meta.customerManager?.trim()) metaErrors.push('[고객사] 고객사 담당자를 입력해 주세요.');
    if (!meta.contactName?.trim()) metaErrors.push('[영업 담당자 정보] 영업 담당자 이름을 입력해 주세요.');
    if (!meta.contactEmail?.trim()) metaErrors.push('[영업 담당자 정보] 이메일을 입력해 주세요.');
    if (!meta.contactMobile?.trim()) metaErrors.push('[영업 담당자 정보] 휴대전화 번호를 입력해 주세요.');
    if (!meta.contactDirect?.trim()) metaErrors.push('[영업 담당자 정보] 직통 번호를 입력해 주세요.');

    const itemErrors: string[] = [];
    if (items.length === 0) itemErrors.push('[항목 탭] 항목을 1개 이상 추가해 주세요.');
    items.forEach((it, idx) => {
      if (!it.item?.trim()) itemErrors.push(`[항목 탭] 항목명 누락: ${idx + 1}행`);
      if (!it.qty || it.qty <= 0) itemErrors.push(`[항목 탭] 수량이 0 이하: ${idx + 1}행`);
      if (it.unitPrice == null || it.unitPrice < 0) itemErrors.push(`[항목 탭] 단가가 비었습니다: ${idx + 1}행`);
    });

    const optionErrors: string[] = [];
    if (!meta.brandingMode) optionErrors.push('[옵션 탭] 브랜딩 모드를 선택해 주세요.');

    const ok = metaErrors.length === 0 && itemErrors.length === 0 && optionErrors.length === 0;
    return { ok, metaErrors, itemErrors, optionErrors };
  }, [meta, items]);

  const stepStates: Record<TabId, 'ok' | 'pending' | 'error'> = {
    basic: validation.metaErrors.length > 0 ? 'error' : validation.metaErrors.length === 0 ? 'ok' : 'pending',
    items: validation.itemErrors.length > 0 ? 'error' : validation.itemErrors.length === 0 && items.length > 0 ? 'ok' : 'pending',
    options: validation.optionErrors.length > 0 ? 'error' : 'ok',
    history: history.length > 0 ? 'ok' : 'pending',
  };

  const ensureValid = useCallback(() => {
    if (validation.ok) return true;
    const msg = validation.metaErrors[0] || validation.itemErrors[0] || validation.optionErrors[0] || '필수 항목을 모두 입력해 주세요.';
    toast.error(msg);
    return false;
  }, [validation]);

  const handleExportCSV = () => {
    if (!ensureValid()) return;
    const headers = ['섹션', '항목명', '수량', '단가', '금액', '할인율', '제안가', '비고'];
    const rows = items.map(item => [
      item.section,
      item.item,
      item.qty,
      item.unitPrice,
      item.qty * item.unitPrice,
      item.discountPct ?? 0,
      Math.round(item.qty * item.unitPrice * (1 - (item.discountPct ?? 0) / 100)),
      item.note || item.notes || '',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `견적서_${meta.customerName || 'draft'}_${getLocalToday()}.csv`;
    link.click();
    toast.success('CSV 파일로 내보냈습니다.');
  };

  // PDF·PNG 저장이 같은 파일 이름(확장자 제외)을 쓴다.
  const buildExportFilename = () => {
    const sanitize = (str: string) => str.replace(/[\/\\:*?"<>|]/g, '_').trim();
    const typeLabel = meta.brandingMode === 'public' ? '공공용' : '일반용';
    return `이폼사인_${typeLabel} 견적서_${sanitize(meta.customerName)}_${sanitize(meta.quoteDate)}_${sanitize(meta.contactName)}`;
  };

  const handleExportImage = async () => {
    if (!ensureValid()) return;
    // PNG 는 PDF 저장 방식과 무관하게 항상 한 장 이미지다. 여러 쪽 미리보기에는 #preview-panel 이 없으므로 PDF 용 화면 밖 한 장 사본이 잡힌다.
    // 미리보기를 끄면 #preview-panel 이 display:none 이라 캡처할 수 없다 — PDF 용 화면 밖 사본(같은 내용, 같은 297mm 폭)을 쓴다.
    const visible = (document.getElementById('preview-panel')?.offsetWidth ?? 0) > 0;
    await exportToImage(visible ? 'preview-panel' : 'pdf-preview-panel', buildExportFilename());
  };

  const runPdfExport = async (layout: PdfLayout) => {
    if (!ensureValid()) return;
    const filename = buildExportFilename();
    await exportToPdf(
      layout === 'paged' ? 'pdf-pages-panel' : 'pdf-preview-panel',
      filename,
      { title: buildPdfTitle(meta), keywords: buildPdfKeywords(meta) },
      layout
    );
  };

  // PDF 본 버튼: 기억된 방식으로 저장
  const handleExportPdf = () => runPdfExport(pdfLayout);

  // 저장 방식 메뉴 항목: 그 방식으로 저장하고 기본값으로 기억
  const handleExportPdfAs = async (layout: PdfLayout) => {
    const changed = layout !== pdfLayout;
    setPdfLayout(layout);
    writePdfLayout(layout);
    if (changed && layout === 'paged') {
      // 여러 쪽 렌더(숨김 패널)가 그려지고 쪽 나눔 측정이 끝날 때까지 기다린다 (프레임 2번, 안전 상한 400ms)
      await Promise.race([
        new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))),
        new Promise<void>(resolve => setTimeout(resolve, 400)),
      ]);
    }
    await runPdfExport(layout);
  };

  // 메뉴를 열 때 숨김 한 장 용지를 재서 쪽 수·글자 비율을 구한다
  const getPdfLayoutInfo = useCallback((): PdfLayoutInfo | null => {
    const paper = document.querySelector<HTMLElement>('#pdf-preview-panel .qd-paper');
    if (!paper) return null;
    const m = measureFlowPaper(paper);
    if (!m) return null;
    return {
      itemCount: m.rows.filter(r => r.kind === 'item').length,
      fitPct: Math.round(estimatePdfFitScale(paper.offsetWidth, paper.offsetHeight) * 100),
      pagedPages: paginate(m).length,
    };
  }, []);

  const handleSaveCurrentQuote = useCallback(
    (name: string) => {
      const summary = {
        msrpSum: calculation.msrpSum,
        offerSum: calculation.offerSum,
        grand: calculation.grand,
      };
      saveQuote(name, meta, items, summary);
      toast.success(`"${name}" 견적서가 저장되었습니다.`);
    },
    [meta, items, calculation, saveQuote]
  );

  const handleLoadSavedQuote = useCallback(
    (quote: SavedQuote) => {
      // Notes saved by the old editor may have the customer name baked in; restore the placeholder.
      actions.setMeta(() => ({
        ...quote.meta,
        referenceNotes:
          restoreCustomerPlaceholders(quote.meta.referenceNotes, quote.meta.customerName) ?? quote.meta.referenceNotes,
      }));
      actions.setItems(quote.items);
      setShowSavedPanel(false);
      toast.success(`"${quote.name}" 견적서를 불러왔습니다. 미리보기가 업데이트되었습니다.`);
    },
    [actions]
  );

  const handleMergeExport = useCallback(
    async (selected: SavedQuote[]): Promise<boolean> => {
      setIsMerging(true);
      try {
        const dateStr = getLocalToday();
        const filename = `이폼사인_병합견적서_${selected.length}건_${dateStr}`;
        const ok = await exportMergedPdf(
          selected.map(q => ({ name: q.name, meta: q.meta, items: q.items })),
          filename,
          setMergeRenderData,
          'pdf-merge-panel',
          pdfLayout
        );
        if (ok) setShowSavedPanel(false);
        return ok;
      } finally {
        setIsMerging(false);
      }
    },
    [pdfLayout]
  );

  const handleTempSave = () => {
    try {
      const dataToSave = {
        meta,
        items,
        categoryLabels,
        savedAt: new Date().toISOString(),
      };
      localStorage.setItem('eformsign_quote_temp_save', JSON.stringify(dataToSave));
      toast.success('현재 작성 내용이 임시 저장되었습니다.');
    } catch (error) {
      toast.error('임시 저장에 실패했습니다.');
    }
  };

  const handleReset = () => {
    openConfirm(
      '견적 초기화',
      '고객사 정보와 견적 항목이 초기화되고 견적일자는 오늘 날짜로 바뀝니다. 담당자 이니셜과 영업 담당자 정보는 유지됩니다. 계속할까요?',
      () => {
        actions.resetQuote();
        toast.success('견적이 초기화되었습니다.');
      },
      true
    );
  };

  const renderWorkspace = () => {
    switch (activeTab) {
      case 'basic':
        return <BasicInfoEditor meta={meta} setMeta={actions.setMeta} isEditing={true} />;
      case 'items':
        return (
          <ItemEditor
            items={items}
            calculation={calculation}
            categoryLabels={categoryLabels}
            actions={actions}
            openConfirm={openConfirm}
            isEditing={true}
            showDiscount={meta.showDiscount}
            sector={meta.sector}
            onSectorChange={(s) => actions.setMeta(prev => ({ ...prev, sector: s }))}
            subsidyRate={meta.subsidyRate}
            onSubsidyRateChange={(rate) => actions.setMeta(prev => ({ ...prev, subsidyRate: rate }))}
          />
        );
      case 'options':
        return (
          <OptionEditor
            meta={meta}
            setMeta={actions.setMeta}
            presets={presets}
            actions={actions}
            isEditing={true}
            openConfirm={openConfirm}
            onTabChange={setActiveTab}
          />
        );
      case 'history':
        return (
          <HistoryEditor
            history={history}
            presets={presets}
            actions={actions}
            openConfirm={openConfirm}
            onPreview={setPreviewSnapshot}
            previewId={previewSnapshot?.id}
          />
        );
      default:
        return null;
    }
  };

  return (
    <>
      <Toaster position="top-center" richColors />

      <MainLayout
        showPreview={showPreview}
        onTogglePreview={() => setShowPreview(!showPreview)}
        sidebar={null}
        header={
          <Header
            onExportCSV={handleExportCSV}
            onExportImage={handleExportImage}
            onExportPdf={handleExportPdf}
            onExportPdfAs={handleExportPdfAs}
            pdfLayout={pdfLayout}
            getPdfLayoutInfo={getPdfLayoutInfo}
            onReset={handleReset}
            showPreview={showPreview}
            onTogglePreview={() => setShowPreview(!showPreview)}
            onTempSave={handleTempSave}
            onStartTour={handleStartTour}
            savedQuotesCount={savedQuotes.length}
            onOpenSavedQuotes={() => setShowSavedPanel(true)}
          />
        }
        workspace={
          <div className="space-y-6" data-tour="workspace">
            <StepBar
              activeTab={activeTab}
              onTabChange={setActiveTab}
              itemsCount={items.length}
              historyCount={history.length}
              stepStates={stepStates}
            />

            {renderWorkspace()}
          </div>
        }
        preview={
          <div data-tour="preview-panel">
            <PreviewPanel
              meta={previewSnapshot ? previewSnapshot.meta : meta}
              calculation={
                previewSnapshot
                  ? calculateQuote(previewSnapshot.items, previewSnapshot.meta.vatRate, { sector: previewSnapshot.meta.sector, subsidyRate: previewSnapshot.meta.subsidyRate, roundingUnit: previewSnapshot.meta.roundingUnit })
                  : calculation
              }
              categoryLabels={categoryLabels}
              showPolicies={true}
              pageMode={pdfLayout}
            />
          </div>
        }
      />

      {/* Onboarding Tour */}
      <OnboardingTour
        run={runTour}
        onComplete={handleTourComplete}
        onTabChange={(tab: string) => setActiveTab(tab as TabId)}
      />

      {/* Hidden container for PDF export - always rendered with proper dimensions */}
      <div
        id="pdf-export-container"
        style={{
          position: 'fixed',
          left: '-9999px',
          top: 0,
          width: '297mm',
          height: 'auto',
          pointerEvents: 'none',
          overflow: 'visible',
        }}
      >
        <div id="pdf-preview-panel" style={{ width: '297mm' }}>
          <PreviewPanel
            meta={previewSnapshot ? previewSnapshot.meta : meta}
            calculation={
              previewSnapshot
                ? calculateQuote(previewSnapshot.items, previewSnapshot.meta.vatRate, { sector: previewSnapshot.meta.sector, subsidyRate: previewSnapshot.meta.subsidyRate, roundingUnit: previewSnapshot.meta.roundingUnit })
                : calculation
            }
            categoryLabels={categoryLabels}
            showPolicies={true}
          />
        </div>
        {/* 여러 쪽 저장용: 쪽 용지(.qd-page)를 쪽마다 캡처한다. 저장 방식이 '여러 쪽'일 때만 그린다 */}
        {pdfLayout === 'paged' && (
          <div id="pdf-pages-panel" style={{ width: '297mm' }}>
            <PreviewPanel
              meta={previewSnapshot ? previewSnapshot.meta : meta}
              calculation={
                previewSnapshot
                  ? calculateQuote(previewSnapshot.items, previewSnapshot.meta.vatRate, { sector: previewSnapshot.meta.sector, subsidyRate: previewSnapshot.meta.subsidyRate, roundingUnit: previewSnapshot.meta.roundingUnit })
                  : calculation
              }
              categoryLabels={categoryLabels}
              showPolicies={true}
              pageMode="paged"
              forExport
            />
          </div>
        )}
      </div>

      {/* Saved Quotes Panel */}
      {showSavedPanel && (
        <SavedQuotesPanel
          savedQuotes={savedQuotes}
          onSaveCurrent={handleSaveCurrentQuote}
          onLoad={handleLoadSavedQuote}
          onDelete={removeSavedQuote}
          onMergeExport={handleMergeExport}
          onClose={() => setShowSavedPanel(false)}
          isMerging={isMerging}
          pdfLayout={pdfLayout}
        />
      )}

      {/* Hidden merge render panel */}
      {mergeRenderData && (
        <div
          style={{
            position: 'fixed',
            left: '-9999px',
            top: 0,
            width: '297mm',
            height: 'auto',
            pointerEvents: 'none',
            overflow: 'visible',
          }}
        >
          <div id="pdf-merge-panel" style={{ width: '297mm' }}>
            <PreviewPanel
              meta={mergeRenderData.meta}
              calculation={calculateQuote(mergeRenderData.items, mergeRenderData.meta.vatRate, { sector: mergeRenderData.meta.sector, subsidyRate: mergeRenderData.meta.subsidyRate, roundingUnit: mergeRenderData.meta.roundingUnit })}
              categoryLabels={categoryLabels}
              showPolicies={true}
              pageMode={pdfLayout}
              forExport
            />
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        onConfirm={confirmModal.onConfirm}
        onCancel={closeConfirmModal}
        isDestructive={confirmModal.isDestructive}
      />
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ProtectedRoute>
        <QuoteBuilder />
      </ProtectedRoute>
    </AuthProvider>
  );
}
