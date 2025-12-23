import React from 'react';
import {
    Document,
    Page,
    View,
    Text,
    Link,
    Image,
    StyleSheet,
} from '@react-pdf/renderer';
import { QuoteMeta, CalculationResult } from '../types';
import { SUPPLIER_PROFILE } from '../constants';

// Note: Using default Helvetica font for now
// For Korean text support, a local font file would need to be bundled

interface QuotePDFDocumentProps {
    meta: QuoteMeta;
    calculation: CalculationResult;
    baseUrl: string; // e.g., 'http://localhost:3002'
}

const nf = new Intl.NumberFormat('ko-KR');
const toKRW = (n: number) => `${nf.format(n)}원`;

// Color constants
const COLORS = {
    brandBlue: '#0085C8',
    brandBlueDark: '#0060A0',
    teal: '#00a99d',
    gray100: '#f3f4f6',
    gray200: '#e5e7eb',
    gray400: '#9ca3af',
    gray500: '#6b7280',
    gray800: '#1f2937',
    gray900: '#111827',
    white: '#ffffff',
};

const styles = StyleSheet.create({
    page: {
        flexDirection: 'row',
        fontSize: 10,
        color: COLORS.gray800,
    },
    // LEFT SIDEBAR
    sidebar: {
        width: '34%',
        flexDirection: 'column',
    },
    sidebarTop: {
        backgroundColor: COLORS.gray100,
        padding: 16,
        alignItems: 'center',
    },
    logo: {
        width: 140,
        marginBottom: 8,
    },
    promoImage: {
        width: '100%',
        marginBottom: 12,
    },
    badgesImage: {
        height: 32,
        marginTop: 8,
    },
    sidebarBottom: {
        flex: 1,
        padding: 20,
        color: COLORS.white,
    },
    sectionTitle: {
        fontSize: 8,
        fontWeight: 700,
        opacity: 0.6,
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 8,
    },
    sectionDivider: {
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.2)',
        paddingBottom: 12,
        marginBottom: 12,
    },
    companyName: {
        fontSize: 16,
        fontWeight: 800,
        marginBottom: 4,
    },
    infoText: {
        fontSize: 9,
        opacity: 0.9,
        marginBottom: 2,
    },
    infoTextBold: {
        fontSize: 9,
        fontWeight: 700,
        opacity: 0.9,
        marginBottom: 2,
    },
    linkRow: {
        flexDirection: 'row',
        gap: 16,
        marginTop: 12,
    },
    link: {
        fontSize: 9,
        color: COLORS.white,
        textDecoration: 'underline',
    },
    totalDue: {
        fontSize: 24,
        fontWeight: 800,
        letterSpacing: -0.5,
    },
    // RIGHT MAIN CONTENT
    main: {
        flex: 1,
        padding: 28,
        backgroundColor: COLORS.white,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        borderBottomWidth: 2,
        borderBottomColor: COLORS.gray100,
        paddingBottom: 16,
        marginBottom: 24,
    },
    invoiceNumber: {
        fontSize: 18,
        fontWeight: 700,
        color: COLORS.gray800,
    },
    quoteTitle: {
        fontSize: 28,
        fontWeight: 800,
        color: COLORS.gray900,
    },
    datesRow: {
        flexDirection: 'row',
        gap: 48,
        marginBottom: 24,
    },
    dateLabel: {
        fontSize: 8,
        fontWeight: 700,
        color: COLORS.gray400,
        textTransform: 'uppercase',
        marginBottom: 4,
    },
    dateValue: {
        fontSize: 14,
        fontWeight: 700,
        color: COLORS.gray800,
    },
    // TABLE
    table: {
        marginBottom: 20,
    },
    tableHeader: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: COLORS.gray100,
        paddingBottom: 8,
        marginBottom: 4,
    },
    tableHeaderCell: {
        fontSize: 8,
        fontWeight: 700,
        color: COLORS.gray400,
        textTransform: 'uppercase',
    },
    tableRow: {
        flexDirection: 'row',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.gray100,
    },
    colItem: { width: '45%', paddingRight: 8 },
    colQty: { width: '10%', textAlign: 'right' },
    colPrice: { width: '20%', textAlign: 'right' },
    colTotal: { width: '25%', textAlign: 'right' },
    itemName: {
        fontSize: 10,
        fontWeight: 700,
        color: COLORS.gray800,
    },
    itemNotes: {
        fontSize: 8,
        color: COLORS.gray400,
        marginTop: 4,
    },
    cellText: {
        fontSize: 10,
        color: COLORS.gray500,
    },
    cellTextBold: {
        fontSize: 10,
        fontWeight: 700,
        color: COLORS.gray800,
    },
    // SUMMARY
    summaryContainer: {
        alignItems: 'flex-end',
        marginTop: 16,
    },
    summaryBox: {
        width: '60%',
        backgroundColor: '#fafafa',
        borderRadius: 8,
        padding: 16,
    },
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    summaryLabel: {
        fontSize: 10,
        color: COLORS.gray500,
    },
    summaryValue: {
        fontSize: 10,
        fontWeight: 700,
        color: COLORS.gray800,
    },
    summaryTotalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        borderTopWidth: 1,
        borderTopColor: COLORS.gray200,
        paddingTop: 8,
        marginTop: 4,
    },
    summaryTotalLabel: {
        fontSize: 14,
        fontWeight: 700,
        color: COLORS.brandBlue,
    },
    summaryTotalValue: {
        fontSize: 16,
        fontWeight: 800,
        color: COLORS.brandBlue,
    },
    // FOOTER
    footer: {
        marginTop: 24,
        borderWidth: 1,
        borderColor: COLORS.gray100,
        borderRadius: 8,
        padding: 16,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
    },
    footerLeft: {
        flex: 1,
    },
    footerLogo: {
        width: 120,
        marginBottom: 8,
        opacity: 0.7,
    },
    footerNotes: {
        fontSize: 8,
        color: COLORS.gray500,
    },
    footerRight: {
        alignItems: 'flex-end',
    },
    footerCompany: {
        fontSize: 10,
        fontWeight: 700,
        color: COLORS.gray800,
    },
    footerCeo: {
        fontSize: 9,
        color: COLORS.gray500,
    },
    sealContainer: {
        marginTop: 4,
    },
    sealStamped: {
        width: 48,
        height: 48,
        borderWidth: 2,
        borderColor: '#dc2626',
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
    },
    sealText: {
        fontSize: 7,
        color: '#dc2626',
        fontWeight: 700,
        textAlign: 'center',
    },
    sealOmitted: {
        fontSize: 8,
        color: COLORS.gray400,
    },
});

export const QuotePDFDocument: React.FC<QuotePDFDocumentProps> = ({ meta, calculation, baseUrl }) => {
    const isStamped = meta.sealMode === 'stamped';

    // Calculate Due Date
    const quoteDateObj = new Date(meta.quoteDate || new Date());
    const dueDateObj = new Date(quoteDateObj);
    dueDateObj.setDate(quoteDateObj.getDate() + (meta.validityDays || 14));
    const dueDateStr = dueDateObj.toISOString().split('T')[0];

    const quoteTitle = meta.brandingMode === 'ai' ? 'AI 견적서' :
        meta.brandingMode === 'public' ? '공공 견적서' : '견적서';

    return (
        <Document>
            <Page size="A4" orientation="landscape" style={styles.page}>
                {/* LEFT SIDEBAR */}
                <View style={styles.sidebar}>
                    {/* Top Section - Light Gray */}
                    <View style={styles.sidebarTop}>
                        <Image src={`${baseUrl}/eformsign-logo.png`} style={styles.logo} />
                        <Image src={`${baseUrl}/promo-full.png`} style={styles.promoImage} />
                        <View style={{ borderTopWidth: 1, borderTopColor: COLORS.gray200, width: '100%' }} />
                        <Image src={`${baseUrl}/badges/logo.png`} style={styles.badgesImage} />
                    </View>

                    {/* Bottom Section - Brand Blue */}
                    <View style={[styles.sidebarBottom, { backgroundColor: COLORS.brandBlue }]}>
                        {/* FROM Section */}
                        <View style={styles.sectionDivider}>
                            <Text style={styles.sectionTitle}>FROM</Text>
                            <Text style={styles.companyName}>{SUPPLIER_PROFILE.companyName}</Text>
                            <Text style={styles.infoText}>{SUPPLIER_PROFILE.address}</Text>
                            <Text style={styles.infoText}>{SUPPLIER_PROFILE.addressBuilding}</Text>
                            <Text style={[styles.infoText, { fontSize: 8 }]}>사업자등록번호: {SUPPLIER_PROFILE.bizNo}</Text>
                            <Text style={styles.infoTextBold}>{SUPPLIER_PROFILE.email}</Text>
                            <Text style={styles.infoTextBold}>{SUPPLIER_PROFILE.tel}</Text>
                        </View>

                        {/* BILL TO Section */}
                        <View style={styles.sectionDivider}>
                            <Text style={styles.sectionTitle}>BILL TO</Text>
                            <Text style={styles.companyName}>{meta.customerName || '고객사명'}</Text>
                            {meta.customerManager && <Text style={styles.infoTextBold}>{meta.customerManager}</Text>}
                            {meta.customerEmail && <Text style={styles.infoText}>{meta.customerEmail}</Text>}
                            {meta.customerContact && <Text style={styles.infoText}>{meta.customerContact}</Text>}
                        </View>

                        {/* CONTACT Section */}
                        <View style={styles.sectionDivider}>
                            <Text style={styles.sectionTitle}>CONTACT</Text>
                            <Text style={[styles.infoTextBold, { fontSize: 12 }]}>{meta.contactName || SUPPLIER_PROFILE.salesManager}</Text>
                            <Text style={styles.infoText}>{meta.contactEmail || SUPPLIER_PROFILE.salesEmail}</Text>
                            {meta.contactMobile && <Text style={styles.infoText}>{meta.contactMobile}</Text>}
                            {meta.contactDirect && <Text style={styles.infoText}>{meta.contactDirect}</Text>}
                        </View>

                        {/* PAYMENT INFO Section */}
                        <View style={styles.sectionDivider}>
                            <Text style={styles.sectionTitle}>PAYMENT INFO</Text>
                            <Text style={[styles.infoTextBold, { fontSize: 11 }]}>{SUPPLIER_PROFILE.bankName}</Text>
                            <Text style={styles.infoText}>{SUPPLIER_PROFILE.accountNo}</Text>
                            <Text style={styles.infoText}>예금주: {SUPPLIER_PROFILE.depositor}</Text>
                            <View style={styles.linkRow}>
                                <Link src={meta.bizNoLink || SUPPLIER_PROFILE.bizNoLink} style={styles.link}>📋 사업자등록증</Link>
                                <Link src={meta.bankAccountLink || SUPPLIER_PROFILE.bankAccountLink} style={styles.link}>🏦 통장사본</Link>
                            </View>
                        </View>

                        {/* TOTAL DUE */}
                        <View>
                            <Text style={styles.sectionTitle}>TOTAL DUE</Text>
                            <Text style={styles.totalDue}>{nf.format(calculation.grand)}원</Text>
                        </View>
                    </View>
                </View>

                {/* RIGHT MAIN CONTENT */}
                <View style={styles.main}>
                    {/* Header */}
                    <View style={styles.header}>
                        <View>
                            <Text style={styles.dateLabel}>INVOICE NUMBER</Text>
                            <Text style={styles.invoiceNumber}>{meta.quoteNo || 'INV-0000-000'}</Text>
                        </View>
                        <Text style={styles.quoteTitle}>{quoteTitle}</Text>
                    </View>

                    {/* Dates */}
                    <View style={styles.datesRow}>
                        <View>
                            <Text style={styles.dateLabel}>DATE ISSUED</Text>
                            <Text style={styles.dateValue}>{meta.quoteDate || '-'}</Text>
                        </View>
                        <View>
                            <Text style={styles.dateLabel}>DUE DATE</Text>
                            <Text style={styles.dateValue}>{dueDateStr}</Text>
                        </View>
                    </View>

                    {/* Items Table */}
                    <View style={styles.table}>
                        <View style={styles.tableHeader}>
                            <Text style={[styles.tableHeaderCell, styles.colItem]}>ITEM DESCRIPTION</Text>
                            <Text style={[styles.tableHeaderCell, styles.colQty]}>QTY</Text>
                            <Text style={[styles.tableHeaderCell, styles.colPrice]}>PRICE</Text>
                            <Text style={[styles.tableHeaderCell, styles.colTotal]}>TOTAL</Text>
                        </View>
                        {calculation.rows.map((row) => (
                            <View key={row.id} style={styles.tableRow}>
                                <View style={styles.colItem}>
                                    <Text style={styles.itemName}>{row.item}</Text>
                                    {(row.notes || row.note) && <Text style={styles.itemNotes}>{row.notes || row.note}</Text>}
                                </View>
                                <Text style={[styles.cellText, styles.colQty]}>{nf.format(row.qty)}</Text>
                                <Text style={[styles.cellText, styles.colPrice]}>{nf.format(row.unitPrice)}</Text>
                                <Text style={[styles.cellTextBold, styles.colTotal]}>{nf.format(row.offerPrice)}</Text>
                            </View>
                        ))}
                    </View>

                    {/* Summary */}
                    <View style={styles.summaryContainer}>
                        <View style={styles.summaryBox}>
                            <View style={styles.summaryRow}>
                                <Text style={styles.summaryLabel}>Subtotal</Text>
                                <Text style={styles.summaryValue}>{toKRW(calculation.offerSum)}</Text>
                            </View>
                            <View style={styles.summaryRow}>
                                <Text style={styles.summaryLabel}>Tax ({calculation.vatRate}%)</Text>
                                <Text style={styles.summaryValue}>{toKRW(calculation.vat)}</Text>
                            </View>
                            <View style={styles.summaryTotalRow}>
                                <Text style={styles.summaryTotalLabel}>Total</Text>
                                <Text style={styles.summaryTotalValue}>{toKRW(calculation.grand)}</Text>
                            </View>
                        </View>
                    </View>

                    {/* Footer */}
                    <View style={styles.footer}>
                        <View style={styles.footerLeft}>
                            <Image src={`${baseUrl}/Slogan_Original.png`} style={styles.footerLogo} />
                            <Text style={[styles.dateLabel, { marginBottom: 0 }]}>비고 (NOTES)</Text>
                            <Text style={styles.footerNotes}>본 견적서는 {meta.validityDays}일간 유효합니다.</Text>
                        </View>
                        <View style={styles.footerRight}>
                            <Text style={styles.footerCompany}>{SUPPLIER_PROFILE.companyName}</Text>
                            <Text style={styles.footerCeo}>대표이사 {SUPPLIER_PROFILE.ceoName}</Text>
                            <View style={styles.sealContainer}>
                                {isStamped ? (
                                    <View style={styles.sealStamped}>
                                        <Text style={styles.sealText}>주식회사{'\n'}포시에스{'\n'}인</Text>
                                    </View>
                                ) : (
                                    <Text style={styles.sealOmitted}>(직인 생략)</Text>
                                )}
                            </View>
                        </View>
                    </View>
                </View>
            </Page>
        </Document>
    );
};
