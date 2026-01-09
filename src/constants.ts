import { QuoteItem } from './types';

export const UI_KEY = 'eformsign_quote_ui_v2_ascii';
export const DATA_KEY = 'eformsign_quote_simple_contacts_v2_ascii';

// 카테고리 섹션별 라벨 정의 (수정 가능)
export type CategorySection = 'SaaS' | 'Credit' | 'Service' | 'Option';

export interface CategoryLabel {
  section: CategorySection;
  label: string;
  labelEn?: string; // 영문 라벨 (옵션)
}

export const DEFAULT_CATEGORY_LABELS: CategoryLabel[] = [
  { section: 'SaaS', label: '문서', labelEn: 'Document' },
  { section: 'Credit', label: '크레딧', labelEn: 'Credit' },
  { section: 'Service', label: '프리미엄 서비스', labelEn: 'Premium Service' },
  { section: 'Option', label: '추가 옵션', labelEn: 'Additional Options' },
];

// 섹션에서 라벨을 가져오는 헬퍼 함수
export const getCategoryLabel = (section: CategorySection, labels: CategoryLabel[] = DEFAULT_CATEGORY_LABELS): string => {
  const found = labels.find(l => l.section === section);
  return found ? found.label : section;
};

// 한글 + 영문 라벨 조합
export const getCategoryLabelFull = (section: CategorySection, labels: CategoryLabel[] = DEFAULT_CATEGORY_LABELS): string => {
  const found = labels.find(l => l.section === section);
  if (!found) return section;
  return found.labelEn ? `${found.label} (${found.labelEn})` : found.label;
};

export const SUPPLIER_PROFILE = {
  companyName: '㈜포시에스',
  ceoName: '박미경',
  bizNo: '108-81-85184',
  address: '서울특별시 강남구 논현로 646',
  addressBuilding: '(포시에스빌딩)',
  salesManager: '영업 담당자',
  salesContact: '02-6188-8200',
  salesEmail: 'sales@forcs.com',
  mainPhoneLabel: '이폼사인 대표전화',
  mainPhone: '02-6188-8200',
  supportPhoneLabel: 'eformsign 고객센터',
  supportPhone: '02-6188-8400',
  fax: '02-6188-8337',
  // New fields for Modern Layout
  email: 'eformsign@forcs.com',
  tel: '02-6188-8400',
  bankName: '신한은행',
  accountNo: '100-024-398749',
  depositor: '주식회사 포시에스',
  paymentTerms: '대금지불조건: 세금계산서 발행 후 30일이내 현금 또는 카드결제',
  bizNoLink: 'https://drive.google.com/file/d/17KxcwiN-Fw5xjKmc6XP7TiSz5yQHUnWf/view?usp=sharing',
  bankAccountLink: 'https://drive.google.com/file/d/1vZFvtIdzMLy9HbLQ10VLwEWkkH0EcpBn/view?usp=sharing',
};

type QuickAddItemFactory = () => Omit<QuoteItem, 'id'>;

export const QUICK_ADD_CATALOG: Record<
  string,
  { label: string; section: 'SaaS' | 'Credit' | 'Service' | 'Option'; factory: QuickAddItemFactory; style: string }
> = {
  // 1. Cloud Service (SaaS) - Public
  public1k: {
    label: '이폼사인 Public 1K',
    section: 'SaaS',
    factory: () => ({
      section: 'SaaS',
      category: '문서 생성',
      item: '이폼사인 Public 1K',
      unitLabel: '건',
      qty: 1000,
      unitPrice: 1000,
      discountPct: 0,
      notes: '템플릿 등록 갯수 무제한 제공\n멤버 계정 초대 무제한\n카카오톡 알림톡/SMS 알림포함\nOpen API 무료 제공',
    }),
    style: 'bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100',
  },
  // 1. Cloud Service (SaaS) - General
  enterprise2000: {
    label: 'Enterprise 2,000건',
    section: 'SaaS',
    factory: () => ({
      section: 'SaaS',
      category: '문서 생성',
      item: 'eformsign Enterprise',
      unitLabel: '건',
      qty: 2000,
      unitPrice: 800,
      discountPct: 0,
      notes: '기업용 무제한 서명, 카카오톡/문자(OTP) 인증, Open API 포함',
    }),
    style: 'bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100',
  },
  welcome100Free: {
    label: 'Welcome 100건',
    section: 'SaaS',
    factory: () => ({
      section: 'SaaS',
      category: '문서 생성',
      item: 'Welcome 문서 제공',
      unitLabel: '건',
      qty: 100,
      unitPrice: 800,
      discountPct: 100,
      notes: '신규 고객 체험용 무료 건수',
    }),
    style: 'bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100',
  },
  credit100k: {
    label: '유료 옵션 활용 가능 (10만)',
    section: 'Credit',
    factory: () => ({
      section: 'Credit',
      category: '추가 옵션',
      item: '유료 옵션 활용 가능',
      unitLabel: '-',
      qty: 1,
      unitPrice: 100000,
      discountPct: 0,
      notes: '휴대폰 본인확인(PASS) / 법인 공동인증 등\n유료 옵션 활용을 위한 크레딧\n* 옵션 비용에 따라 차감',
    }),
    style: 'bg-purple-50 text-purple-600 border border-purple-200 hover:bg-purple-100',
  },

  // 2. Professional Services (Premium Service)
  setupGeneral: {
    label: '일반 서식 세팅',
    section: 'Service',
    factory: () => ({
      section: 'Service',
      category: 'Professional Services',
      item: '일반 서식 세팅',
      unitLabel: '식',
      qty: 1,
      unitPrice: 100000,
      discountPct: 0,
      notes: '로직이 없는 단순 서식',
    }),
    style: 'bg-teal-50 text-teal-600 border border-teal-200 hover:bg-teal-100',
  },
  formSetup3Free: {
    label: '문서 세팅 3건',
    section: 'Service',
    factory: () => ({
      section: 'Service',
      category: 'Professional Services',
      item: '기본 문서 세팅(브랜딩 포함)',
      unitLabel: '건',
      qty: 3,
      unitPrice: 100000,
      discountPct: 100,
      notes: '초기 도입 컨설팅 제공',
    }),
    style: 'bg-teal-50 text-teal-600 border border-teal-200 hover:bg-teal-100',
  },
  accountSetupFree: {
    label: '계정 구성 지원',
    section: 'Service',
    factory: () => ({
      section: 'Service',
      category: 'Professional Services',
      item: '계정 구조 설정 및 기본 교육',
      unitLabel: '회',
      qty: 1,
      unitPrice: 1000000,
      discountPct: 100,
      notes: '맞춤 구성 가이드 및 지원',
    }),
    style: 'bg-teal-50 text-teal-600 border border-teal-200 hover:bg-teal-100',
  },
  training1HFree: {
    label: '사용자 교육 1H',
    section: 'Service',
    factory: () => ({
      section: 'Service',
      category: 'Professional Services',
      item: '사용자 교육(1시간)',
      unitLabel: '회',
      qty: 1,
      unitPrice: 200000,
      discountPct: 100,
      notes: '영업 담당자 집중 교육',
    }),
    style: 'bg-teal-50 text-teal-600 border border-teal-200 hover:bg-teal-100',
  },
  setupAccount: {
    label: '계정설정지원',
    section: 'Service',
    factory: () => ({
      section: 'Service',
      category: 'Professional Services',
      item: '계정설정지원',
      unitLabel: '식',
      qty: 1,
      unitPrice: 1000000,
      discountPct: 0,
      notes: '멤버 초대 및 권한 설정 가이드&지원\n초기 세팅 무료 제공\n* 유효기간 : 계약 후 1년 이내',
    }),
    style: 'bg-teal-50 text-teal-600 border border-teal-200 hover:bg-teal-100',
  },
  training1h: {
    label: '사용자 교육 (1H)',
    section: 'Service',
    factory: () => ({
      section: 'Service',
      category: 'Professional Services',
      item: '사용자 교육 (1H)',
      unitLabel: '회',
      qty: 1,
      unitPrice: 500000,
      discountPct: 0,
      notes: '실무자 온라인 교육\n사용자 교육 장소 : 서울로 한정\n* 온라인 대체 가능',
    }),
    style: 'bg-teal-50 text-teal-600 border border-teal-200 hover:bg-teal-100',
  },
  brandingKakao: {
    label: '카카오톡 브랜딩',
    section: 'Service',
    factory: () => ({
      section: 'Service',
      category: 'Professional Services',
      item: '카카오톡 브랜딩',
      unitLabel: '식',
      qty: 1,
      unitPrice: 500000,
      discountPct: 0,
      notes: '기관 카카오톡 비즈니스채널 발송 연동',
    }),
    style: 'bg-teal-50 text-teal-600 border border-teal-200 hover:bg-teal-100',
  },
  brandingSms: {
    label: 'SMS 발신 번호 변경',
    section: 'Service',
    factory: () => ({
      section: 'Service',
      category: 'Professional Services',
      item: 'SMS 발신 번호 변경',
      unitLabel: '식',
      qty: 1,
      unitPrice: 500000,
      discountPct: 0,
      notes: '기관 발신번호 연동\n최초 1회 연동 비용 발생',
    }),
    style: 'bg-teal-50 text-teal-600 border border-teal-200 hover:bg-teal-100',
  },
  brandingEmail: {
    label: '이메일 발송 주소 변경',
    section: 'Service',
    factory: () => ({
      section: 'Service',
      category: 'Professional Services',
      item: '이메일 발송 주소 변경',
      unitLabel: '식',
      qty: 1,
      unitPrice: 1000000,
      discountPct: 0,
      notes: '고객사 지정 이메일 주소 발송',
    }),
    style: 'bg-teal-50 text-teal-600 border border-teal-200 hover:bg-teal-100',
  },

  // 3. Paid Options (Unit Prices)
  addOnSmsAlert: {
    label: 'SMS 알림 (국외)',
    section: 'Option',
    factory: () => ({
      section: 'Option',
      category: '추가 옵션',
      item: 'SMS 알림 (국외)',
      unitLabel: '건',
      qty: 1,
      unitPrice: 100,
      discountPct: 0,
      notes: '',
    }),
    style: 'bg-amber-50 text-amber-600 border border-amber-200 hover:bg-amber-100',
  },
  addOnSmsEmailAuth: {
    label: 'SMS 이메일 인증',
    section: 'Option',
    factory: () => ({
      section: 'Option',
      category: '추가 옵션',
      item: 'SMS 이메일 인증',
      unitLabel: '건',
      qty: 1,
      unitPrice: 20,
      discountPct: 0,
      notes: '시도 건 수로 과금',
    }),
    style: 'bg-amber-50 text-amber-600 border border-amber-200 hover:bg-amber-100',
  },
  addOnPersonalAuth: {
    label: '개인 인증 (통신사/PASS)',
    section: 'Option',
    factory: () => ({
      section: 'Option',
      category: '추가 옵션',
      item: '개인 인증 서비스 (통신사/PASS 본인확인)',
      unitLabel: '건',
      qty: 1,
      unitPrice: 50,
      discountPct: 0,
      notes: '시도 건 수로 과금\n수신자가 PASS 앱 미설치한 경우, 문자(SMS) 인증으로 진행',
    }),
    style: 'bg-amber-50 text-amber-600 border border-amber-200 hover:bg-amber-100',
  },
  addOnCorpAuth: {
    label: '법인 인증 서비스',
    section: 'Option',
    factory: () => ({
      section: 'Option',
      category: '추가 옵션',
      item: '법인 인증 서비스 (법인 공동인증서)',
      unitLabel: '건',
      qty: 1,
      unitPrice: 50,
      discountPct: 0,
      notes: '시도 건 수로 과금',
    }),
    style: 'bg-amber-50 text-amber-600 border border-amber-200 hover:bg-amber-100',
  },
  addOnTimestamp: {
    label: '타임스탬프',
    section: 'Option',
    factory: () => ({
      section: 'Option',
      category: '추가 옵션',
      item: '타임스탬프 (시점확인 서비스 TSA)',
      unitLabel: '건',
      qty: 1,
      unitPrice: 500,
      discountPct: 0,
      notes: '',
    }),
    style: 'bg-amber-50 text-amber-600 border border-amber-200 hover:bg-amber-100',
  },
  addOnEdocStorage: {
    label: '공인전자문서보관소',
    section: 'Option',
    factory: () => ({
      section: 'Option',
      category: '추가 옵션',
      item: '공인전자문서보관소 (공전소)',
      unitLabel: '건',
      qty: 1,
      unitPrice: 100,
      discountPct: 0,
      notes: '문서 1건 당 1MB, 5년 보관 기준',
    }),
    style: 'bg-amber-50 text-amber-600 border border-amber-200 hover:bg-amber-100',
  },
  addOnKakaoBrand: {
    label: '카카오톡 브랜딩 (발송)',
    section: 'Option',
    factory: () => ({
      section: 'Option',
      category: '추가 옵션',
      item: '카카오톡 브랜딩 (고객사 지정 카카오톡 채널로 발송)',
      unitLabel: '건',
      qty: 1,
      unitPrice: 500000,
      discountPct: 0,
      notes: '미 신청 시, eformsign 카카오톡 채널에서 발송',
    }),
    style: 'bg-amber-50 text-amber-600 border border-amber-200 hover:bg-amber-100',
  },
  addOnSmsCallerId: {
    label: 'SMS 발신번호 (발송)',
    section: 'Option',
    factory: () => ({
      section: 'Option',
      category: '추가 옵션',
      item: 'SMS 발신번호 (고객사 지정 대표번호로 발송)',
      unitLabel: '건',
      qty: 1,
      unitPrice: 500000,
      discountPct: 0,
      notes: '미 신청 시, 발신번호: 02-6188-8288',
    }),
    style: 'bg-amber-50 text-amber-600 border border-amber-200 hover:bg-amber-100',
  },
  addOnEmailFrom: {
    label: '이메일 발송주소 (발송)',
    section: 'Option',
    factory: () => ({
      section: 'Option',
      category: '추가 옵션',
      item: '이메일 발송주소 (고객사 지정 이메일주소로 발송)',
      unitLabel: '건',
      qty: 1,
      unitPrice: 1000000,
      discountPct: 0,
      notes: '미 신청 시, 발신 이메일 주소: no-reply@eformsign.com',
    }),
    style: 'bg-amber-50 text-amber-600 border border-amber-200 hover:bg-amber-100',
  },
};

// 기본 참조 사항 (견적서 작성 시 기본값으로 사용)
export const DEFAULT_REFERENCE_NOTES = [
  '본 견적은 『{고객사명}의 전자계약 서비스 eformsign 도입』에 한하여 적용되는 견적입니다.',
  '계약기간: 계약 시작일로 부터 1년입니다.',
  '문서 사용기한: 계약 시작일로부터 최대 2년까지 사용할 수 있습니다.',
  '문서 소진 시, 본 견적에 포함된 사항 외에 별도로 사용된 유료 옵션은 실제 사용량에 따라 일괄 청구됩니다.',
  '클라우드 서비스 업데이트에 따라 추가된 신규 기능은 전면 무상 제공\n(일부 기능은 유상, 반영 전 공지)',
  '본 계약은 상호 신뢰를 바탕으로 계약을 체결하며, 이에 대한 분쟁이 있을 경우 상관례에 따라 상호 협의에 의하여 분쟁을 해결합니다.',
  'Trial 기간 동안 API 연동에 대한 기술지원 요청 발생 시, 유선 및 원격 지원',
  '기타 사항은 www.eformsign.com 이용약관에 따릅니다.',
];
