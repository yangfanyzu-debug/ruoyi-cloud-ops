import request from '@/utils/request'

export function getActivePrompt() {
  return request({
    url: '/report-management-api/audit-prompts/active',
    method: 'get'
  })
}

export function createPromptVersion(data) {
  return request({
    url: '/report-management-api/audit-prompts',
    method: 'post',
    data
  })
}

export function listAuditCheckpoints() {
  return request({
    url: '/report-management-api/audit-checkpoints',
    method: 'get'
  })
}

export function createAuditCheckpoint(data) {
  return request({
    url: '/report-management-api/audit-checkpoints',
    method: 'post',
    data
  })
}

export function updateAuditCheckpoint(id, data) {
  return request({
    url: `/report-management-api/audit-checkpoints/${id}`,
    method: 'put',
    data
  })
}
