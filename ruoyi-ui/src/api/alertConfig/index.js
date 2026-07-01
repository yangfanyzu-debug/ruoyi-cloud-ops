import request from '@/utils/request'

const prefix = 'alert-aisre-config-api/api/alert-filter'
const direct = config => request({ baseURL: '/', headers: { isToken: false }, ...config })

export function getActiveRuleSet() {
  return direct({
    url: `${prefix}/rule-set/active`,
    method: 'get',
    transformResponse: [data => (data === '' || data === 'null' ? {} : JSON.parse(data))]
  }).then(data => (data && data.id ? data : null))
}

export function listRuleSets(params) {
  return direct({ url: `${prefix}/rule-set/list`, method: 'get', params })
}

export function getRuleSet(id) {
  return direct({ url: `${prefix}/rule-set/${id}`, method: 'get' })
}

export function saveDraft(data) {
  return direct({ url: `${prefix}/rule-set`, method: 'post', data })
}

export function deleteDraft(id, operator) {
  return direct({ url: `${prefix}/rule-set/${id}`, method: 'delete', params: { operator } })
}

export function activateDraft(id, data) {
  return direct({ url: `${prefix}/rule-set/${id}/activate`, method: 'post', data })
}

export function copyRuleSet(id, data) {
  return direct({ url: `${prefix}/rule-set/${id}/copy`, method: 'post', data })
}

export function testRules(data) {
  return direct({ url: `${prefix}/rule-set/test`, method: 'post', data, headers: { isToken: false, repeatSubmit: false } })
}

export function checkActiveRules(data) {
  return direct({ url: `${prefix}/check`, method: 'post', data, headers: { isToken: false, repeatSubmit: false } })
}
