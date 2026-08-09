import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const read = file => fs.readFileSync(path.resolve(file), 'utf8')
const api = read('src/api/alertOverview/index.js')
const page = read('src/views/alertAnalysis/monthlyReport/index.vue')
const menu = read('../sql/ai_alert_overview_menu.sql')

assert.match(api, /alert_statistics-api\/api\/stats\/monthly-report/)
assert.match(page, /existSystems/)
assert.match(page, /missingSystems/)
assert.match(page, /unexists/)
assert.match(page, /A\+/)
assert.match(page, /缺失报告系统明细/)
assert.match(page, /getMonthlyReportStats/)
assert.match(menu, /alertAnalysis\/monthlyReport\/index/)
assert.match(menu, /alert:monthly-report:list/)

console.log('月度报告统计页面静态检查通过')
