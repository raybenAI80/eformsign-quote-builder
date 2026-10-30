import React, { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { toKRW, nf } from '../../utils/formatters';
import type { CalculatedRow } from '../../types';
import { SUPPLIER_PROFILE } from '../../constants';
import { renderReferenceNote } from '../../utils/referenceNotes';
import {
  PreviewPanelProps,
  CategoryGroup,
  LABELS,
  normalizeRichText,
  discountedUnitPrice,
  isAmountBlank,
  getDayName,
  getPreviewModel,
} from './previewModel';
import { QuoteFooterD } from './QuoteFooterD';
import { selectFooterKind } from './quoteFooterKind';
import { getQuoteTitleText } from './quoteTitle';
import { paginate, measureFlowPaper, type PageSpec } from './pagination';
import './quotePreviewD.css';

/** 표 한 행의 그리기 단위. 구분 행(cat)과 품목 행(item)을 한 줄로 편 것이다. */
type RenderRow =
  | { key: string; type: 'cat'; label: string; cont?: boolean }
  | { key: string; type: 'item'; row: CalculatedRow };

const flattenGroups = (groups: CategoryGroup[]): RenderRow[] =>
  groups.flatMap(({ section, label, rows }): RenderRow[] => [
    { key: `cat-${section}`, type: 'cat', label },
    ...rows.map((row): RenderRow => ({ key: row.id, type: 'item', row })),
  ]);

interface QuotePaperProps extends PreviewPanelProps {
  id?: string;
  className?: string;
  /** 이 용지에 그릴 표 행. 생략하면 전부 */
  rows?: RenderRow[];
  /** 'full' = 로고·제목·거래 정보 3칸, 'thin' = 2쪽부터의 얇은 연속 머리 */
  head?: 'full' | 'thin';
  /** 합계·결제정보·비고·하단. 마지막 쪽(또는 한 장)에만 true */
  showTail?: boolean;
  /** 쪽 번호. 쪽이 하나뿐이면 넘기지 않는다 */
  pageNo?: { n: number; total: number };
}

/**
 * 차분한 비즈니스형 견적서 용지 한 장. 한 장 모드는 이것 하나, 여러 쪽 모드는 쪽마다 하나를 그린다.
 * 시안: docs/design-mode/mock-d-business.html. 표시 항목과 규칙은 getPreviewModel 이 정한다.
 */
const QuotePaper: React.FC<QuotePaperProps> = ({
  meta,
  calculation,
  categoryLabels,
  id,
  className,
  rows: rowsProp,
  head = 'full',
  showTail = true,
  pageNo,
}) => {
  const {
    isStamped,
    isSubsidy,
    discountLabel,
    discountAmountLabel,
    showRowDiscount,
    validityMonths,
    dueDateStr,
    hasEnterprise,
    groups,
    showDiscountLines,
    showSubsidyLine,
    showRoundingLine,
    contactEmailText,
    hasContactPhone,
  } = getPreviewModel(meta, calculation, categoryLabels);
  const renderRows = rowsProp ?? flattenGroups(groups);

  const colSpan = showRowDiscount ? 5 : 4;
  const sealSize = meta.sealSize ?? 48;

  const renderTitle = () => {
    if (meta.brandingMode === 'ai') {
      return (
        <>
          이폼사인 <img src="/ai-icon.png" alt="AI" /> 견적서
        </>
      );
    }
    return getQuoteTitleText(meta.brandingMode);
  };

  const renderDate = (dateStr: string) => (
    <>
      <span className="qd-nb">{dateStr}</span> <small>{`(${getDayName(dateStr)})`}</small>
    </>
  );

  const renderSeal = () => {
    if (isStamped) {
      return meta.sealImage ? (
        <img
          className="qd-seal-img"
          src={meta.sealImage}
          alt="직인"
          style={{
            width: `${sealSize}px`,
            height: `${sealSize}px`,
            marginLeft: `${meta.sealOffsetX ?? 0}px`,
            marginTop: `${meta.sealOffsetY ?? 0}px`,
          }}
        />
      ) : (
        <span className="qd-seal">
          주식회사<br />포시에스<br />인
        </span>
      );
    }
    return meta.sealMode === 'omitted' ? <span className="qd-ceo-omit">(직인 생략)</span> : null;
  };

  return (
    <div id={id} className={`paper qd-paper${className ? ` ${className}` : ''}`}>
      <div className="qd-body">
        {head === 'thin' ? (
          <div className="qd-thin">
            <div className="qd-thin-l">
              <img className="qd-logo-e" src="/design-d/eformsign-logo-blue.png" alt="eformsign 로고" />
              <span className="qd-thin-vr" />
              <p className="qd-thin-t">{renderTitle()}</p>
            </div>
            <div className="qd-thin-r">
              <span>
                <span className="qd-k">{LABELS.quoteNo}</span>
                <span className="qd-v qd-num">{meta.quoteNo || 'FORCS-EFS-XX-0000000'}</span>
              </span>
              <span>
                <span className="qd-k">{LABELS.billTo}</span>
                <span className="qd-v qd-cust">{meta.customerName || '고객사명'}</span>
              </span>
            </div>
          </div>
        ) : (
        <>
        <div className="qd-logos">
          <img className="qd-logo-e" src="/design-d/eformsign-logo-blue.png" alt="eformsign 로고" />
          <img className="qd-logo-f" src="/design-d/forcs-ci-en-original.png" alt="FORCS 로고" />
        </div>

        <div className="qd-titlebar">
          <h1 className="qd-title">{renderTitle()}</h1>
          <div className="qd-meta">
            <span className="qd-k">{LABELS.quoteNo}</span>
            <span className="qd-k">{LABELS.quoteDate}</span>
            <span className="qd-k">
              {`${LABELS.validity} `}<span>{`(견적일로부터 ${validityMonths}개월)`}</span>
            </span>
            <span className="qd-v qd-num">{meta.quoteNo || 'FORCS-EFS-XX-0000000'}</span>
            <span className="qd-v qd-num">{meta.quoteDate ? renderDate(meta.quoteDate) : '-'}</span>
            <span className="qd-v qd-num">{renderDate(dueDateStr)}</span>
          </div>
        </div>

        <div className="qd-three">
          <div>
            <h3>{LABELS.supplier}</h3>
            <div className="qd-bd">
              <p className="qd-nm">{SUPPLIER_PROFILE.companyName}</p>
              <p>
                {SUPPLIER_PROFILE.address} {SUPPLIER_PROFILE.addressBuilding}
              </p>
              <p>
                {'사업자등록번호 '}<span className="qd-nb qd-num">{SUPPLIER_PROFILE.bizNo}</span>
              </p>
              <p>
                {`${SUPPLIER_PROFILE.email} · `}<span className="qd-nb qd-num">{SUPPLIER_PROFILE.tel}</span>
              </p>
              <div className="qd-ceo">
                <span className="qd-nb">{`대표이사 ${SUPPLIER_PROFILE.ceoName}`}</span>
                {renderSeal()}
              </div>
            </div>
          </div>
          <div>
            <h3>{LABELS.billTo}</h3>
            <div className="qd-bd">
              <p className="qd-nm">{meta.customerName || '고객사명'}</p>
              {meta.customerManager && <p>{meta.customerManager}</p>}
              {meta.customerEmail && <p>{meta.customerEmail}</p>}
              {meta.customerContact && <p className="qd-num">{meta.customerContact}</p>}
            </div>
          </div>
          <div>
            <h3>{LABELS.contact}</h3>
            <div className="qd-bd">
              <p className="qd-nm">
                {meta.contactName || SUPPLIER_PROFILE.salesManager}
                {meta.contactTitle && <> <small>{meta.contactTitle}</small></>}
              </p>
              <p>{contactEmailText}</p>
              {meta.contactMobile && <p className="qd-num">{`휴대전화 ${meta.contactMobile}`}</p>}
              {meta.contactDirect && <p className="qd-num">{`직통 ${meta.contactDirect}`}</p>}
              {!hasContactPhone && <p className="qd-num">{SUPPLIER_PROFILE.salesContact}</p>}
            </div>
          </div>
        </div>
        </>
        )}

        <table className="qd-items">
          <colgroup>
            <col />
            <col style={{ width: '90px' }} />
            <col style={{ width: '130px' }} />
            {showRowDiscount && <col style={{ width: '90px' }} />}
            <col style={{ width: '170px' }} />
          </colgroup>
          <thead>
            <tr>
              <th>{LABELS.itemDesc}</th>
              <th>{LABELS.qty}</th>
              <th>{LABELS.price}</th>
              {showRowDiscount && <th>{discountLabel}</th>}
              <th>{LABELS.amount}</th>
            </tr>
          </thead>
          <tbody>
            {renderRows.map(r =>
              r.type === 'cat' ? (
                <tr key={r.key} className="qd-cat">
                  <td colSpan={colSpan}>
                    {r.label}
                    {r.cont && <span className="qd-cont">{' (계속)'}</span>}
                  </td>
                </tr>
              ) : (
                (() => {
                  const row = r.row;
                  const noteHtml = row.notes || row.note || '';
                  return (
                    <tr key={r.key}>
                      <td className="qd-item">
                        <b>{row.item}</b>
                        {noteHtml && (
                          <div
                            className="qd-note"
                            dangerouslySetInnerHTML={{ __html: normalizeRichText(noteHtml) }}
                          />
                        )}
                      </td>
                      <td className="qd-r qd-num">{nf.format(row.qty)}</td>
                      <td className="qd-r qd-num">
                        {typeof row.unitPrice === 'number' ? (
                          <>
                            {nf.format(row.unitPrice)}
                            {showRowDiscount && row.discountPct > 0 && (
                              <em>{`→ ${nf.format(discountedUnitPrice(row.unitPrice, row.discountPct))}`}</em>
                            )}
                          </>
                        ) : (
                          row.unitPrice
                        )}
                      </td>
                      {showRowDiscount && (
                        <td className="qd-r qd-num">{row.discountPct > 0 ? `${Math.round(row.discountPct)}%` : '-'}</td>
                      )}
                      <td className="qd-r qd-num qd-amt">
                        {isAmountBlank(row) ? (
                          '-'
                        ) : showRowDiscount && row.discountPct > 0 ? (
                          <>
                            <small>{`(정가 ${nf.format(row.price)})`}</small>
                            <b>{nf.format(row.offerPrice)}</b>
                          </>
                        ) : (
                          <b>{nf.format(row.offerPrice)}</b>
                        )}
                      </td>
                    </tr>
                  );
                })()
              )
            )}
            {renderRows.length === 0 && (
              <tr className="qd-empty">
                <td colSpan={colSpan}>항목이 없습니다.</td>
              </tr>
            )}
          </tbody>
        </table>

        {showTail && (
        <>
        <div className="qd-sumrow">
          {hasEnterprise && (
            <div className="qd-pay">
              <h3>{LABELS.payment}</h3>
              <p>
                <b>{SUPPLIER_PROFILE.bankName}</b> <span className="qd-num">{SUPPLIER_PROFILE.accountNo}</span>
              </p>
              <p>{`예금주 ${SUPPLIER_PROFILE.depositor}`}</p>
              <p>{SUPPLIER_PROFILE.paymentTerms}</p>
              <p>
                <a
                  href={meta.bizNoLink || SUPPLIER_PROFILE.bizNoLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="pdf-target-link"
                >
                  사업자등록증
                </a>{' '}
                &nbsp;{' '}
                <a
                  href={meta.bankAccountLink || SUPPLIER_PROFILE.bankAccountLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="pdf-target-link"
                >
                  통장사본
                </a>
              </p>
            </div>
          )}
          <div className="qd-sm">
            {isSubsidy ? (
              <>
                <div className="qd-row">
                  <span>정가 합계</span>
                  <b className="qd-num">{toKRW(calculation.msrpSum)}</b>
                </div>
                <div className="qd-row">
                  <span>{`${LABELS.tax} (${calculation.vatRate}%)`}</span>
                  <b className="qd-num">{toKRW(calculation.vat)}</b>
                </div>
                {showSubsidyLine && (
                  <div className="qd-row qd-dc">
                    <span>{`${discountAmountLabel} (${Math.round(calculation.subsidyRate)}%)`}</span>
                    <b className="qd-num">-{toKRW(calculation.subsidyAmount)}</b>
                  </div>
                )}
              </>
            ) : (
              <>
                {showDiscountLines && (
                  <>
                    <div className="qd-row">
                      <span>정가 합계</span>
                      <b className="qd-num">{toKRW(calculation.msrpSum)}</b>
                    </div>
                    <div className="qd-row qd-dc">
                      <span>{`${discountAmountLabel} (${Math.round(calculation.totalDiscountPct)}%)`}</span>
                      <b className="qd-num">-{toKRW(calculation.discountAmount)}</b>
                    </div>
                  </>
                )}
                <div className="qd-row">
                  <span>{LABELS.subtotal}</span>
                  <b className="qd-num">{toKRW(calculation.offerSum)}</b>
                </div>
                <div className="qd-row">
                  <span>{`${LABELS.tax} (${calculation.vatRate}%)`}</span>
                  <b className="qd-num">{toKRW(calculation.vat)}</b>
                </div>
                {showRoundingLine && (
                  <div className="qd-row qd-dc">
                    <span>단수 절사</span>
                    <b className="qd-num">-{toKRW(calculation.roundingCut)}</b>
                  </div>
                )}
              </>
            )}
            <div className="qd-gt">
              <span>{LABELS.grandTotal}</span>
              <span className="qd-num">{toKRW(calculation.grand)}</span>
            </div>
            <div className="qd-tp">
              <span>{LABELS.total}</span>
              <b className="qd-num">{toKRW(calculation.grand)}</b>
            </div>
          </div>
        </div>

        {meta.referenceNotes && meta.referenceNotes.length > 0 && (
          <div className="qd-notes">
            <h3>{LABELS.notes}</h3>
            {meta.referenceNotes.map((note, i) => {
              const displayNote = renderReferenceNote(note, meta.customerName);
              return (
                displayNote.trim() && (
                  <p key={i}>
                    <i className="qd-num">{i + 1}.</i>
                    <span>{displayNote}</span>
                  </p>
                )
              );
            })}
          </div>
        )}
        </>
        )}
      </div>

      {showTail && <QuoteFooterD kind={selectFooterKind(meta)} />}
      {pageNo && <div className="qd-pageno">{`${pageNo.n} / ${pageNo.total}`}</div>}
    </div>
  );
};

/**
 * 여러 쪽 모드. 보이지 않는 "측정용 용지"(한 장짜리 전체)의 행 높이를 읽어 쪽을 나누고, 쪽마다 용지를 하나씩 그린다.
 * 측정용 용지에는 id 가 없고(중복 id 방지), 쪽 용지는 `.qd-page` 클래스로 찾는다(캡처 대상).
 * 쪽이 하나뿐이면 쪽 번호 없이 한 장 모드와 같은 모양이다.
 */
const PagedQuotePreview: React.FC<PreviewPanelProps> = props => {
  const { meta, calculation, categoryLabels, forExport } = props;
  const measurerRef = useRef<HTMLDivElement>(null);
  const model = getPreviewModel(meta, calculation, categoryLabels);
  const rows = useMemo(() => flattenGroups(model.groups), [model.groups]);
  const [layout, setLayout] = useState<{ specs: PageSpec[]; rowCount: number } | null>(null);

  const measure = useCallback(() => {
    const paper = measurerRef.current?.querySelector<HTMLElement>('.qd-paper');
    if (!paper) return;
    const m = measureFlowPaper(paper);
    if (!m) return;
    const specs = paginate(m);
    setLayout(prev => {
      const same =
        prev &&
        prev.rowCount === m.rows.length &&
        prev.specs.length === specs.length &&
        prev.specs.every((p, i) => p.start === specs[i].start && p.end === specs[i].end && p.carry === specs[i].carry);
      return same ? prev : { specs, rowCount: m.rows.length };
    });
  }, []);

  // 내용이 바뀐 렌더 직후(그리기 전)에 다시 잰다. 글꼴 로드·행 높이 변화는 관찰자가 다시 알려 준다.
  useLayoutEffect(() => {
    measure();
  });
  useLayoutEffect(() => {
    const paper = measurerRef.current?.querySelector<HTMLElement>('.qd-paper');
    const table = paper?.querySelector('table.qd-items');
    if (!paper || !table) return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(paper);
    ro.observe(table);
    const fonts = document.fonts;
    const onFonts = () => measure();
    fonts?.addEventListener?.('loadingdone', onFonts);
    void fonts?.ready.then(onFonts);
    return () => {
      ro.disconnect();
      fonts?.removeEventListener?.('loadingdone', onFonts);
    };
  }, [measure]);

  // 측정이 끝나기 전·행 수가 어긋난 한 순간에는 한 장으로 그린다
  const specs: PageSpec[] =
    layout && layout.rowCount === rows.length ? layout.specs : [{ start: 0, end: rows.length, carry: null }];
  const total = specs.length;

  return (
    <div className={`qd-pages${forExport ? '' : ' qd-pages-screen'}`}>
      <div ref={measurerRef} className="qd-measurer" aria-hidden="true">
        <QuotePaper {...props} />
      </div>
      {specs.map((spec, idx) => {
        const pageRows: RenderRow[] = rows.slice(spec.start, spec.end);
        if (spec.carry !== null) {
          const c = rows[spec.carry];
          if (c.type === 'cat') pageRows.unshift({ ...c, key: `${c.key}-cont-${idx}`, cont: true });
        }
        return (
          <QuotePaper
            key={idx}
            {...props}
            className="qd-page"
            rows={pageRows}
            head={idx === 0 ? 'full' : 'thin'}
            showTail={idx === total - 1}
            pageNo={total > 1 ? { n: idx + 1, total } : undefined}
          />
        );
      })}
    </div>
  );
};

/**
 * 견적서 출력물 (출력물은 이 디자인 하나다).
 * - 한 장 모드(기본): 용지 하나. 루트 id 는 `preview-panel` 이다 (이미지 저장이 이 id 를 캡처한다).
 * - 여러 쪽 모드(pageMode="paged"): 쪽 용지 여러 장. PDF 저장이 `.qd-page` 를 쪽마다 캡처한다.
 */
export const QuotePreviewD: React.FC<PreviewPanelProps> = props =>
  props.pageMode === 'paged' ? <PagedQuotePreview {...props} /> : <QuotePaper {...props} id="preview-panel" />;
