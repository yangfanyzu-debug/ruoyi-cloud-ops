import assert from 'node:assert/strict'
import fs from 'node:fs'

const page = fs.readFileSync('src/views/report-management/audit-prompt/index.vue', 'utf8')
const api = fs.readFileSync('src/api/report-management/auditPrompt.js', 'utf8')
const workbench = fs.readFileSync('src/views/report-management/audit-workbench/index.vue', 'utf8')
const auditMarkdown = fs.readFileSync('src/views/report-management/audit-workbench/AuditMarkdown.vue', 'utf8')

for (const text of ['模型连接配置', '初始审核提示词', '修订审核提示词', 'API Key 留空将沿用当前密钥']) {
  assert.match(page, new RegExp(text))
}
assert.doesNotMatch(page, /业务检查点/)
assert.doesNotMatch(page, /listAuditCheckpoints/)
assert.match(api, /audit-prompts\/\$\{auditType\}\/active/)
assert.match(api, /audit-prompts\/\$\{auditType\}`/)
assert.match(api, /report-management-api\/ai-config/)
assert.match(workbench, /auditTypeLabel/)
assert.match(workbench, /audit-type-tag/)
assert.match(workbench, /hide-jira-title/)
assert.match(workbench, /this\.loadAgentMessages\(initial\)/)
assert.match(workbench, /grid-template-columns:minmax\(560px, 1fr\) clamp\(500px, 38vw, 620px\)/)
assert.match(workbench, /selectedAuditId/)
assert.match(workbench, /:key="version\.auditId \|\| `version-\$\{version\.versionId\}`"/)
assert.match(workbench, /v-for="version in documentVersions"/)
assert.match(workbench, /item\.auditId === this\.selectedAuditId/)
assert.match(workbench, /latestAuditForVersion\(this\.selectedVersionId\)/)
assert.match(workbench, /window\.setTimeout/)
assert.doesNotMatch(workbench, /window\.setInterval/)
assert.doesNotMatch(workbench, /本次使用.*审核检查点/)
assert.match(auditMarkdown, /hideJiraTitle/)
assert.match(auditMarkdown, /JIRA标题/)

console.log('report-audit-config-page test passed')
