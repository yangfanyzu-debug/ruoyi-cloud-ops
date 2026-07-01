export function normalizeRule(rule = {}) {
  return {
    systems: (rule.systems || []).map(value => String(value).trim()),
    sources: (rule.sources || []).map(value => String(value).trim())
  }
}

export function buildRuleText(rule) {
  const normalized = normalizeRule(rule)
  const system = normalized.systems.length ? `System = ${normalized.systems.join('、')}` : 'System = 不限制'
  const source = normalized.sources.length ? `告警源 = ${normalized.sources.join('、')}` : '告警源 = 不限制'
  return `${system}；${source}`
}

export function buildExpression(rules = []) {
  return rules.map(rule => {
    const normalized = normalizeRule(rule)
    const clauses = []
    if (normalized.systems.length === 1) clauses.push(`system = ${normalized.systems[0]}`)
    if (normalized.systems.length > 1) clauses.push(`system in [${normalized.systems.join(', ')}]`)
    if (normalized.sources.length === 1) clauses.push(`source = ${normalized.sources[0]}`)
    if (normalized.sources.length > 1) clauses.push(`source in [${normalized.sources.join(', ')}]`)
    return clauses.length ? `(${clauses.join(' and ')})` : '(未配置)'
  }).join(' OR ')
}

function canonicalRule(rule) {
  const normalized = normalizeRule(rule)
  return `${normalized.systems.slice().sort().join('\u001f')}\u001e${normalized.sources.slice().sort().join('\u001f')}`
}

export function validateRules(rules) {
  const cardErrors = []
  const summary = []
  if (!Array.isArray(rules) || !rules.length) return { valid: false, cardErrors: [], summary: ['至少需要一条规则'] }
  if (rules.length > 100) summary.push('规则数量不能超过 100 条')
  const seen = new Map()
  rules.forEach((rule, index) => {
    const normalized = normalizeRule(rule)
    const errors = []
    if (!normalized.systems.length && !normalized.sources.length) errors.push('System 和告警源不能同时为空')
    if (new Set(normalized.systems).size !== normalized.systems.length) errors.push('System 不能包含重复值')
    if (new Set(normalized.sources).size !== normalized.sources.length) errors.push('告警源不能包含重复值')
    if ([...normalized.systems, ...normalized.sources].some(value => !value || value.length > 64)) errors.push('单个值不能为空且不能超过 64 个字符')
    const canonical = canonicalRule(rule)
    if (seen.has(canonical)) errors.push(`与规则 ${seen.get(canonical) + 1} 完全重复`)
    else seen.set(canonical, index)
    cardErrors[index] = errors
    errors.forEach(error => summary.push(`规则 ${index + 1}：${error}`))
  })
  return { valid: summary.length === 0, cardErrors, summary }
}

export function cloneRules(rules = []) {
  return rules.map((rule, index) => ({ ...normalizeRule(rule), sortOrder: index + 1 }))
}
