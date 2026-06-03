import request from '@/utils/request'

const base = '/agent-mgmt-api'

export function checkAgentName(name) {
  return request({ url: `${base}/agents/check-name`, method: 'post', data: { name } })
}

export function listAgents(params) {
  return request({ url: `${base}/agents`, method: 'get', params })
}

export function listAgentCategories() {
  return request({ url: `${base}/agent-categories`, method: 'get' })
}

export function getAgent(id) {
  return request({ url: `${base}/agents/${id}`, method: 'get' })
}

export function createAgent(data) {
  return request({ url: `${base}/agents`, method: 'post', data })
}

export function updateAgent(id, data) {
  return request({ url: `${base}/agents/${id}`, method: 'put', data })
}

export function deleteAgent(id) {
  return request({ url: `${base}/agents/${id}`, method: 'delete' })
}

export function activateAgent(id) {
  return request({ url: `${base}/agents/${id}/activate`, method: 'post', headers: { showError: false } })
}

export function deactivateAgent(id) {
  return request({ url: `${base}/agents/${id}/deactivate`, method: 'post', headers: { showError: false } })
}

export function listAgentVersions(id) {
  return request({ url: `${base}/agents/${id}/versions`, method: 'get' })
}

export function activateAgentVersion(id, versionId) {
  return request({ url: `${base}/agents/${id}/versions/${versionId}/activate`, method: 'post', headers: { showError: false } })
}

export function listAgentRelatedScenarios(id) {
  return request({ url: `${base}/agents/${id}/related-scenarios`, method: 'get' })
}

export function rollbackAgent(id, versionId) {
  return request({ url: `${base}/agents/${id}/rollback`, method: 'post', data: { version_id: versionId } })
}

export function checkScenarioName(name) {
  return request({ url: `${base}/scenarios/check-name`, method: 'post', data: { name } })
}

export function listScenarios(params) {
  return request({ url: `${base}/scenarios`, method: 'get', params })
}

export function getScenario(id) {
  return request({ url: `${base}/scenarios/${id}`, method: 'get' })
}

export function createScenario(data) {
  return request({ url: `${base}/scenarios`, method: 'post', data })
}

export function updateScenario(id, data) {
  return request({ url: `${base}/scenarios/${id}`, method: 'put', data })
}

export function deleteScenario(id) {
  return request({ url: `${base}/scenarios/${id}`, method: 'delete' })
}

export function activateScenario(id) {
  return request({ url: `${base}/scenarios/${id}/activate`, method: 'post' })
}

export function deactivateScenario(id) {
  return request({ url: `${base}/scenarios/${id}/deactivate`, method: 'post', headers: { showError: false } })
}

export function listScenarioVersions(id) {
  return request({ url: `${base}/scenarios/${id}/versions`, method: 'get' })
}

export function rollbackScenario(id, versionId) {
  return request({ url: `${base}/scenarios/${id}/rollback`, method: 'post', data: { version_id: versionId } })
}

export function listLogs(params) {
  return request({ url: `${base}/logs`, method: 'get', params })
}

export function listLogStats(params) {
  return request({ url: `${base}/logs/stats`, method: 'get', params })
}

export function getLogHtml(id) {
  return request({ url: `${base}/logs/${id}/html`, method: 'get', responseType: 'text' })
}

export function getLogHtmlByRun(runId) {
  return request({ url: `${base}/logs/by-run/${runId}/html`, method: 'get', responseType: 'text' })
}

export function logHtmlUrl(id) {
  return `${process.env.VUE_APP_BASE_API}${base}/logs/${id}/html`
}

export function getLlmStatsSummary(params) {
  return request({ url: `${base}/llm-stats/summary`, method: 'get', params })
}

export function listLlmStatsFailures(params) {
  return request({ url: `${base}/llm-stats/failures`, method: 'get', params })
}

export function getLlmStatsByRun(runId) {
  return request({ url: `${base}/llm-stats/by-run/${runId}`, method: 'get' })
}

export function listLlmStatsByScenario(params) {
  return request({ url: `${base}/llm-stats/by-scenario`, method: 'get', params })
}

export function logHtmlByRunUrl(runId) {
  return `${process.env.VUE_APP_BASE_API}${base}/logs/by-run/${runId}/html`
}
