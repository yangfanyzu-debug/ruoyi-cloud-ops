import request from '@/utils/request'

export function listReports(query) {
  return request({
    url: '/report-management-api/reports',
    method: 'get',
    params: query
  })
}

export function getReport(reportId) {
  return request({
    url: `/report-management-api/reports/${reportId}`,
    method: 'get'
  })
}

export function registerInitialReport(data) {
  return request({
    url: '/report-management-api/reports/register',
    method: 'post',
    data
  })
}

export function uploadReportVersion(reportId, data) {
  return request({
    url: `/report-management-api/reports/${reportId}/versions`,
    method: 'post',
    data,
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  })
}

export function getAudit(auditId) {
  return request({
    url: `/report-management-api/audits/${auditId}`,
    method: 'get'
  })
}

export function getAuditEvents(auditId, afterId = 0) {
  return request({
    url: `/report-management-api/audits/${auditId}/events`,
    method: 'get',
    params: { afterId },
    headers: { showError: false }
  })
}

export function getAuditConversation(reportId) {
  return request({
    url: `/report-management-api/audits/reports/${reportId}/conversation`,
    method: 'get',
    headers: { showError: false }
  })
}

export function getAgentMessages(reportId, versionId) {
  return request({
    url: `/report-management-api/audits/reports/${reportId}/versions/${versionId}/messages`,
    method: 'get',
    headers: { showError: false }
  })
}

export function sendAgentMessage(reportId, versionId, content) {
  return request({
    url: `/report-management-api/audits/reports/${reportId}/versions/${versionId}/messages`,
    method: 'post',
    data: { content }
  })
}

export function previewUrl(versionId) {
  return `${process.env.VUE_APP_BASE_API}/report-management-api/versions/${versionId}/preview`
}

export function downloadUrl(versionId) {
  return `${process.env.VUE_APP_BASE_API}/report-management-api/versions/${versionId}/download`
}
