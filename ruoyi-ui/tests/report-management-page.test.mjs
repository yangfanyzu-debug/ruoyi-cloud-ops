import assert from 'node:assert/strict'
import fs from 'node:fs'

const page = fs.readFileSync('src/views/report-management/report/index.vue', 'utf8')
const api = fs.readFileSync('src/api/report-management/report.js', 'utf8')

for (const heading of ['报告', '报告月份', 'JIRA任务', '版本', '审核状态', '审核总结', '操作']) {
  assert.match(page, new RegExp(`label="${heading}"`), `report list must keep ${heading} as a dedicated column`)
}
assert.doesNotMatch(page, /el-icon-time[\s\S]*?scope\.row\.createTime/, 'report list should not show creation time as primary metadata')
assert.match(page, /quickAuditStatus/, 'report list must expose compact quick filters')
for (const status of ['processing', 'failed', 'error']) assert.match(page, new RegExp(`label="${status}"`))
assert.match(page, /http:\/\/jira\/browse\//, 'JIRA task must link to the configured JIRA base URL')
assert.match(page, /-webkit-line-clamp:\s*2/, 'audit summaries must use a stable two-line layout')
assert.match(page, /audit-cell-clickable/, 'audit summary area must open the audit workbench')
assert.match(page, /上传新版本/, 'failed reports must offer a clearly named revision action')
assert.match(page, /current-version-label/, 'detail dialog must identify the current version')
assert.match(page, /retryAudit\(scope\.row\)/, 'system audit failures must offer retry')
assert.match(page, /versionAuditSummary/, 'detail versions must display audit summaries or error reasons')
assert.match(api, /export function retryVersionAudit/)
assert.match(api, /versions\/\$\{versionId\}\/retry/)

console.log('report-management-page test passed')
