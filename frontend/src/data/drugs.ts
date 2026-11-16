import type { InteractionStatus, Severity } from '@/components/status'

export type Source = { id: string; title: string; version: string; excerpt: string }

export const SOURCES: Record<string, Source> = {
  dtqg: {
    id: 'dtqg',
    title: 'Dược thư Quốc gia Việt Nam',
    version: '3.0',
    excerpt:
      'Các chất ức chế mạnh CYP3A4 (như clarithromycin) làm tăng đáng kể nồng độ simvastatin trong huyết tương, tăng nguy cơ bệnh cơ và tiêu cơ vân. Không phối hợp trong thời gian điều trị.',
  },
  stockley: {
    id: 'stockley',
    title: "Stockley's Drug Interactions",
    version: '13.0',
    excerpt:
      'Amlodipine modestly raises simvastatin exposure. Regulatory guidance advises limiting simvastatin to 20 mg daily when used together.',
  },
  drugbank: {
    id: 'drugbank',
    title: 'DrugBank Online',
    version: '5.1',
    excerpt: 'Clarithromycin may increase the hypotensive activities of amlodipine through CYP3A4 inhibition.',
  },
  bnf: {
    id: 'bnf',
    title: 'British National Formulary',
    version: '86.0',
    excerpt: 'Paracetamol: no clinically significant interactions recorded with the listed calcium-channel blockers or statins.',
  },
}

export type DrugInfo = { ingredient: string; uses: string; source: string }

export const DRUG_INFO: Record<string, DrugInfo> = {
  Amlodipin: { ingredient: 'Amlodipine besilate', uses: 'Điều trị tăng huyết áp và đau thắt ngực ổn định.', source: 'dtqg' },
  Simvastatin: { ingredient: 'Simvastatin', uses: 'Giảm cholesterol LDL trong máu, hỗ trợ phòng ngừa biến cố tim mạch.', source: 'dtqg' },
  Clarithromycin: {
    ingredient: 'Clarithromycin',
    uses: 'Kháng sinh nhóm macrolid, điều trị nhiễm khuẩn đường hô hấp, da và mô mềm.',
    source: 'dtqg',
  },
  Paracetamol: { ingredient: 'Paracetamol (acetaminophen)', uses: 'Giảm đau, hạ sốt.', source: 'bnf' },
  Omeprazol: { ingredient: 'Omeprazole', uses: 'Giảm tiết acid dạ dày; điều trị trào ngược và loét dạ dày tá tràng.', source: 'dtqg' },
  Omeprazole: { ingredient: 'Omeprazole', uses: 'Giảm tiết acid dạ dày; điều trị trào ngược và loét dạ dày tá tràng.', source: 'dtqg' },
  Clopidogrel: { ingredient: 'Clopidogrel', uses: 'Thuốc chống kết tập tiểu cầu, phòng ngừa biến cố huyết khối xơ vữa.', source: 'dtqg' },
  'Glucophage XR': { ingredient: 'Metformin hydrochloride', uses: 'Kiểm soát đường huyết ở người đái tháo đường type 2.', source: 'dtqg' },
  'Cao Actiso': { ingredient: 'Cao khô lá Actiso', uses: 'Hỗ trợ lợi mật, thông mật.', source: 'dtqg' },
  Boganic: { ingredient: 'Cao Actiso, cao rau đắng đất, bột bìm bìm', uses: 'Hỗ trợ chức năng gan.', source: 'dtqg' },
  'Bio-acimin': { ingredient: 'Lactobacillus acidophilus, kẽm gluconat', uses: 'Hỗ trợ cân bằng hệ vi sinh đường ruột.', source: 'dtqg' },
}

export const SUGGESTIONS = Object.keys(DRUG_INFO).concat(['Metformin', 'Losartan', 'Atorvastatin', 'Amoxicillin', 'Ibuprofen', 'Glucovance'])

/** `text` is the technical explanation; `plain` is a short no-jargon sentence (≤ 20 words) for found interactions. */
type PairRecord = { status: InteractionStatus; severity?: Severity; text: string; plain?: string; sources: string[] }

const PAIRS: Record<string, PairRecord> = {
  'Clopidogrel|Omeprazole': {
    status: 'INTERACTION_FOUND',
    severity: 'major',
    text: 'Omeprazole ức chế enzyme CYP2C19, làm giảm chuyển hóa Clopidogrel thành dạng hoạt tính và giảm hiệu quả chống kết tập tiểu cầu.',
    plain: 'Omeprazole làm giảm tác dụng bảo vệ tim mạch của Clopidogrel khi dùng cùng nhau.',
    sources: ['dtqg', 'stockley'],
  },
  'Clarithromycin|Simvastatin': {
    status: 'INTERACTION_FOUND',
    severity: 'major',
    text: 'Clarithromycin ức chế CYP3A4, làm tăng nồng độ simvastatin trong máu và tăng nguy cơ tổn thương cơ.',
    plain: 'Hai thuốc này có thể làm tăng nguy cơ đau cơ nặng khi dùng cùng nhau.',
    sources: ['dtqg', 'stockley'],
  },
  'Amlodipin|Simvastatin': {
    status: 'INTERACTION_FOUND',
    severity: 'moderate',
    text: 'Amlodipin có thể làm tăng nồng độ simvastatin; tài liệu khuyến cáo giới hạn liều simvastatin khi dùng chung.',
    plain: 'Dùng cùng nhau có thể làm tăng lượng Simvastatin trong máu, dễ gây đau cơ hơn.',
    sources: ['stockley'],
  },
  'Amlodipin|Clarithromycin': {
    status: 'INTERACTION_FOUND',
    severity: 'minor',
    text: 'Clarithromycin có thể làm tăng tác dụng hạ huyết áp của amlodipin.',
    plain: 'Dùng cùng nhau có thể làm huyết áp hạ thấp hơn bình thường.',
    sources: ['drugbank'],
  },
  'Amlodipin|Paracetamol': { status: 'NO_KNOWN_INTERACTION', text: 'Cơ sở dữ liệu chưa ghi nhận tương tác giữa hai thuốc này.', sources: ['bnf'] },
  'Paracetamol|Simvastatin': { status: 'NO_KNOWN_INTERACTION', text: 'Cơ sở dữ liệu chưa ghi nhận tương tác giữa hai thuốc này.', sources: ['bnf'] },
  'Omeprazol|Paracetamol': { status: 'NO_KNOWN_INTERACTION', text: 'Cơ sở dữ liệu chưa ghi nhận tương tác giữa hai thuốc này.', sources: ['bnf'] },
  'Amlodipin|Omeprazol': { status: 'NO_KNOWN_INTERACTION', text: 'Cơ sở dữ liệu chưa ghi nhận tương tác giữa hai thuốc này.', sources: ['drugbank'] },
  'Glucophage XR|Paracetamol': { status: 'NO_KNOWN_INTERACTION', text: 'Cơ sở dữ liệu chưa ghi nhận tương tác giữa hai thuốc này.', sources: ['bnf'] },
}

export type Pair = PairRecord & { a: string; b: string }

export function lookupPair(a: string, b: string, unresolved: boolean): Pair {
  if (unresolved)
    return {
      a,
      b,
      status: 'UNRESOLVED_DRUG',
      text: 'Không thể kiểm tra vì một thuốc trong cặp chưa được nhận diện. Hãy sửa lại đúng tên thuốc.',
      sources: [],
    }
  const key = [a, b].sort().join('|')
  const rec = PAIRS[key]
  if (rec) return { a, b, ...rec }
  return {
    a,
    b,
    status: 'INSUFFICIENT_DATA',
    text: 'Cơ sở dữ liệu hiện chưa có đủ bằng chứng về cặp thuốc này để đưa ra kết luận.',
    sources: ['dtqg'],
  }
}

/* ---- OCR rows ---- */
export type Field = 'name' | 'strength' | 'dose' | 'freq' | 'duration'
export type DrugRow = {
  id: string
  name: string
  strength: string
  dose: string
  freq: string
  duration: string
  conf: Partial<Record<Field, number>>
  unresolved?: boolean
  marked?: boolean
  /** Ticked "Tôi đã đối chiếu thuốc này với ảnh gốc". */
  verified: boolean
  /** Low-confidence fields the user edited or kept with "Giữ nguyên giá trị này". */
  confirmed: Field[]
  line: number
  raw: [string, string]
}

export const NAMES_KNOWN = new Set(Object.keys(DRUG_INFO))

/** Common marketed strengths, used for the dose tag in "Tra cứu tương tác". */
export const STRENGTHS: Record<string, string[]> = {
  Amlodipin: ['5 mg', '10 mg'],
  Simvastatin: ['10 mg', '20 mg', '40 mg'],
  Clarithromycin: ['250 mg', '500 mg'],
  Paracetamol: ['325 mg', '500 mg', '650 mg'],
  Omeprazol: ['20 mg', '40 mg'],
  'Glucophage XR': ['500 mg', '750 mg', '1000 mg'],
  'Cao Actiso': ['200 mg'],
  Boganic: ['170 mg'],
  'Bio-acimin': ['4 g'],
  Metformin: ['500 mg', '850 mg', '1000 mg'],
  Losartan: ['25 mg', '50 mg', '100 mg'],
  Atorvastatin: ['10 mg', '20 mg', '40 mg'],
  Amoxicillin: ['250 mg', '500 mg'],
  Ibuprofen: ['200 mg', '400 mg'],
  Glucovance: ['500/2,5 mg', '500/5 mg'],
}
