import assert from 'node:assert/strict'
import fs from 'node:fs'

const page = fs.readFileSync('src/views/report-management/audit-prompt/index.vue', 'utf8')
const api = fs.readFileSync('src/api/report-management/auditPrompt.js', 'utf8')
const workbench = fs.readFileSync('src/views/report-management/audit-workbench/index.vue', 'utf8')

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
assert.doesNotMatch(workbench, /本次使用.*审核检查点/)

console.log('report-audit-config-page test passed')
