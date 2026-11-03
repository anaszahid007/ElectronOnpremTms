export interface MeasurementField {
  key: string
  label: string
  urdu: string
  checkbox?: boolean
}

export interface MeasurementSection {
  title: string
  urduTitle: string
  formTitle: string
  fields: MeasurementField[]
}

export const GARMENT_TYPES = [
  'Shalwar Kameez',
  'Shirt',
  'Pant',
  'Coat',
  'Waistcoat',
  'Sherwani',
  'Other'
]

export const ORDER_STATUSES = ['pending', 'delivered'] as const

/** Measurement fields grouped exactly like the printed slip (two columns). */
export const MEASUREMENT_SECTIONS: MeasurementSection[] = [
  {
    title: 'Shalwar Kameez',
    urduTitle: 'پیمائش',
    formTitle: 'بنیادی',
    fields: [
      { key: 'kameez_length', label: 'Qameez Length', urdu: 'قمیص لمبائی' },
      { key: 'balao', label: 'Bazu (Arm)', urdu: 'بازو' },
      { key: 'tera', label: 'Tera', urdu: 'تیرہ' },
      { key: 'chhati', label: 'Chhati', urdu: 'چھاتی' },
      { key: 'jodani', label: 'Chorai', urdu: 'چوڑائی' },
      { key: 'kamar', label: 'Kamar', urdu: 'کمر' },
      { key: 'shalwar_length', label: 'Shalwar Length', urdu: 'شلوار' },
      { key: 'baanch', label: 'Pauncha (Ankle)', urdu: 'پائنچہ' },
      { key: 'shalwar_pocket', label: 'Shalwar Pocket', urdu: 'شلوار جیب' },
      { key: 'logo_needed', label: 'Logo Needed', urdu: 'لوگو کی ضرورت', checkbox: true }
    ]
  },
  {
    title: 'Coat & Extras',
    urduTitle: 'کوٹ وغیرہ',
    formTitle: 'اضافی',
    fields: [
      { key: 'meter', label: 'Meter', urdu: 'میٹر' },
      { key: 'ghutpa', label: 'Topis Collar', urdu: 'ٹوپیس کالر' },
      { key: 'coat_front', label: 'Af Sherwani', urdu: 'آف شیروانی' },
      { key: 'cuff', label: 'Cuff', urdu: 'کف' },
      { key: 'zer_baishi', label: 'Zer Padi', urdu: 'ذی پٹی' },
      { key: 'daman', label: 'Daman Styles', urdu: 'دامن اقسام' },
      { key: 'front_pocket', label: 'Front Pocket', urdu: 'سامنے جیب' },
      { key: 'side_pocket', label: 'Side Pocket', urdu: 'سائیڈ جیب' },
      { key: 'selai', label: 'Silai', urdu: 'سلائی' },
      { key: 'koni', label: 'Koni (Elbow)', urdu: 'کونی' },
      { key: 'asan', label: 'Asan (Inseam)', urdu: 'آسن' },
      { key: 'manga', label: 'Monda', urdu: 'منڈا' },
      { key: 'extra_instruction', label: 'Extra Notes', urdu: 'اضافی فرمائش' }
    ]
  }
]

export const ALL_MEASUREMENT_KEYS = MEASUREMENT_SECTIONS.flatMap((s) => s.fields.map((f) => f.key))

/** Field rendered full-width (spans both columns) as the last row of its table. */
export const FULL_WIDTH_FIELD_KEY = 'extra_instruction'

const ALL_FIELDS = MEASUREMENT_SECTIONS.flatMap((s) => s.fields)

/**
 * Right column of the printed measurement slip — 13 fields in the desired
 * order. Mixes fields from both measurement sections.
 */
export const SLIP_RIGHT_FIELDS: MeasurementField[] = [
  'kameez_length',
  'balao',
  'tera',
  'chhati',
  'jodani',
  'kamar',
  'shalwar_length',
  'baanch',
  'asan',
  'shalwar_pocket',
  'selai',
  'manga',
  'logo_needed'
].map((key) => ALL_FIELDS.find((f) => f.key === key)!)

/**
 * Left column measurement fields of the printed slip — 10 fields.
 * Serial number and order rows are rendered separately by the slip component.
 */
export const SLIP_LEFT_FIELDS: MeasurementField[] = [
  'meter',
  'ghutpa',
  'coat_front',
  'cuff',
  'koni',
  'front_pocket',
  'side_pocket',
  'zer_baishi',
  'daman',
  'extra_instruction'
].map((key) => ALL_FIELDS.find((f) => f.key === key)!)
