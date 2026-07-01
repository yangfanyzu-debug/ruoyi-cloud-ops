import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const read = file => fs.readFileSync(path.resolve(file), 'utf8')
const api = read('src/api/alertConfig/index.js')
const constants = read('src/views/configCenter/alertRules/constants.js')
const utils = read('src/views/configCenter/alertRules/rule-utils.js')
const page = read('src/views/configCenter/alertRules/index.vue')
const card = read('src/views/configCenter/alertRules/components/RuleCard.vue')
const dialog = read('src/views/configCenter/alertRules/components/VersionDetailDialog.vue')
const config = read('vue.config.js')

assert.match(api, /baseURL:\s*['"]\/['"]/, 'alert API must bypass /prod-api')
assert.match(api, /alert-aisre-config-api/, 'alert API must use the confirmed proxy path')
for (const exported of ['getActiveRuleSet', 'listRuleSets', 'getRuleSet', 'saveDraft', 'deleteDraft', 'activateDraft', 'copyRuleSet', 'testRules', 'checkActiveRules']) assert.match(api, new RegExp(`export function ${exported}`))
assert.match(api, /isToken:\s*false/)
for (const value of ['ACT', 'DASP', 'AUTH', 'PAY', 'ORDER', 'CRM', '102', '150', '1029', '1033', '999']) assert.match(constants, new RegExp(`['"]${value}['"]`))
assert.match(utils, /export function buildExpression/)
assert.match(utils, /export function validateRules/)
assert.match(utils, /new Set\(normalized\.systems\)/)
assert.match(config, /'\/alert-aisre-config-api'/)
assert.match(config, /127\.0\.0\.1:8405/)
for (const text of ['保存草稿', '激活配置', '当前生效配置', '规则预览 / 逻辑结果', '在线测试', '待新建', '历史版本']) assert.match(page, new RegExp(text))
assert.doesNotMatch(page, />测试规则</)
for (const hook of ['handleSaveDraft', 'handleActivate', 'handleCopyVersion', 'handleDeleteVersion', 'handleOnlineTest']) assert.match(page, new RegExp(hook))
assert.match(card, /collapse-tags/)
assert.match(card, /\$emit\(['"]change['"]/)
assert.match(dialog, /规则详情/)

console.log('alert-config-page test passed')
