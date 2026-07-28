import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const read = file => fs.readFileSync(path.resolve(file), 'utf8')
const api = read('src/api/alertOverview/index.js')
const page = read('src/views/alertAnalysis/aiOverview/index.vue')
const chart = read('src/views/alertAnalysis/aiOverview/StatsChart.vue')
const menu = read('../sql/ai_alert_overview_menu.sql')

assert.match(api, /alert_statistics-api\/api\/stats\/overview/)
assert.match(page, /最近 7 天/)
assert.match(page, /最近 30 天/)
assert.match(page, /最近 90 天/)
assert.match(page, /ei_event_alert_source/)
assert.match(page, /summary\.nonAiCount/)
assert.match(page, /dimensions\.systems/)
assert.match(page, /dimensions\.sources/)
assert.match(page, /class="filter-bar"[\s\S]*class="criteria-inline"/)
assert.doesNotMatch(page, /class="hero"/)
assert.doesNotMatch(page, /DATA CENTER/)
assert.doesNotMatch(page, /按数据中心/)
assert.doesNotMatch(page, /EVENT TYPE/)
assert.doesNotMatch(page, /按告警类型/)
assert.doesNotMatch(page, /dimension-table/)
assert.match(chart, /echarts\.init/)
assert.match(menu, /alertAnalysis\/aiOverview\/index/)
assert.match(menu, /alert:ai-overview:list/)

console.log('AI 告警处理统计页面静态检查通过')
