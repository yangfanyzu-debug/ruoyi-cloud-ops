import assert from 'node:assert/strict'
import fs from 'node:fs'

const page = fs.readFileSync('src/views/report-management/report/index.vue', 'utf8')
const api = fs.readFileSync('src/api/report-management/report.js', 'utf8')
const reportTable = page.slice(page.indexOf('<el-table v-loading'), page.indexOf('<pagination'))

for (const heading of ['系统', '报告', '报告月份', 'JIRA任务', '版本', '审核状态', '审核总结', '操作']) {
  assert.match(reportTable, new RegExp(`label="${heading}"`), `report list must keep ${heading} as a dedicated column`)
}
assert.ok(reportTable.indexOf('label="系统"') < reportTable.indexOf('label="报告"'), 'system must be the first report-list column')
assert.match(reportTable, /class="system-cell"[\s\S]*?scope\.row\.systemId/, 'system code must render in its own table cell')
assert.match(reportTable, /class="icon-action primary-action"[\s\S]*?icon-class="documentation"/, 'report actions must expose details as an icon')
assert.match(reportTable, /class="icon-action"[\s\S]*?icon-class="eye-open"/, 'report actions must expose preview as an icon')
assert.match(reportTable, /class="icon-action"[\s\S]*?icon-class="download"/, 'report actions must expose download as an icon')
assert.match(reportTable, /class="icon-action"[\s\S]*?icon-class="upload"/, 'report actions must expose upload as an icon')
assert.match(page, /label="操作" width="190" align="right">/, 'detail operation column must stay compact')
assert.match(page, /label="报告文件" min-width="340"/, 'detail file information must receive enough width')
assert.match(page, /label="审核结果" min-width="360"/, 'detail audit result must receive enough width')
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
assert.match(page, /icon-class="message"/, 'detail version actions must expose audit result as an icon')
assert.match(api, /export function retryVersionAudit/)
assert.match(api, /versions\/\$\{versionId\}\/retry/)

console.log('report-management-page test passed')
