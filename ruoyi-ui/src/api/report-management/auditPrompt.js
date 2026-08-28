import request from '@/utils/request'

export function getAiConfig() {
  return request({
    url: '/report-management-api/ai-config',
    method: 'get'
  })
}

export function updateAiConfig(data) {
  return request({
    url: '/report-management-api/ai-config',
    method: 'put',
    data
  })
}

export function getActivePrompt(auditType) {
  return request({
    url: `/report-management-api/audit-prompts/${auditType}/active`,
    method: 'get'
  })
}

export function createPromptVersion(auditType, data) {
  return request({
    url: `/report-management-api/audit-prompts/${auditType}`,
    method: 'post',
    data
  })
}
