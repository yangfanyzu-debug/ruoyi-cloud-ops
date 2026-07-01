export const SYSTEM_OPTIONS = Object.freeze(['ACT', 'DASP', 'AUTH', 'PAY', 'ORDER', 'CRM'].map(value => Object.freeze({ label: value, value })))

export const SOURCE_OPTIONS = Object.freeze(['102', '150', '1029', '1033', '999'].map(value => Object.freeze({ label: value, value })))

export const STATUS_META = Object.freeze({
  DRAFT: Object.freeze({ label: '草稿', type: 'info' }),
  ACTIVE: Object.freeze({ label: '生效中', type: 'success' }),
  INACTIVE: Object.freeze({ label: '已失效', type: 'info' })
})
