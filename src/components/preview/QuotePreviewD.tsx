import React from 'react';
import { toKRW, nf } from '../../utils/formatters';
import { SUPPLIER_PROFILE } from '../../constants';
import { renderReferenceNote } from '../../utils/referenceNotes';
import {
  PreviewPanelProps,
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
import './quotePreviewD.css';

/**
 * 차분한 비즈니스형 견적서 출력물 (출력물은 이 디자인 하나다).
 * 시안: docs/design-mode/mock-d-business.html. 표시 항목과 규칙은 getPreviewModel 이 정한다.
 * 루트 id 는 `preview-panel` 이다 (이미지 저장이 이 id 를 캡처한다).
 */
export const QuotePreviewD: React.FC<PreviewPanelProps> = ({ meta, calculation, categoryLabels }) => {
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
    <div id="preview-panel" className="paper qd-paper">
      <div className="qd-body">
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
            {groups.map(({ section, label, rows }) => (
              <React.Fragment key={section}>
                <tr className="qd-cat">
                  <td colSpan={colSpan}>{label}</td>
                </tr>
                {rows.map(row => {
                  const noteHtml = row.notes || row.note || '';
                  return (
                    <tr key={row.id}>
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
                })}
              </React.Fragment>
            ))}
            {calculation.rows.length === 0 && (
              <tr className="qd-empty">
                <td colSpan={colSpan}>항목이 없습니다.</td>
              </tr>
            )}
          </tbody>
        </table>

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
      </div>

      <QuoteFooterD kind={selectFooterKind(meta)} />
    </div>
  );
};
