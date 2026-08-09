<template>
  <div class="monthly-report" v-loading="loading">
    <section class="report-header">
      <div>
        <span class="eyebrow">REPORT INTELLIGENCE / MONTHLY COVERAGE</span>
        <h1>月度报告统计</h1>
        <p>按系统级别追踪报告覆盖情况，快速定位仍缺少月度报告的系统。</p>
      </div>
      <div class="header-stamp">
        <span>REPORTING PERIOD</span>
        <strong>{{ displayMonth }}</strong>
      </div>
    </section>

    <section class="toolbar">
      <el-date-picker
        v-model="month"
        type="month"
        value-format="yyyy-MM"
        placeholder="选择月份"
        :clearable="false"
        @change="loadData"
      />
      <el-button type="primary" icon="el-icon-search" @click="loadData">查询报告</el-button>
      <span class="updated"><i />{{ updatedAt ? `更新于 ${updatedAt}` : '等待查询' }}</span>
    </section>

    <section class="summary-grid">
      <article class="summary-card summary-card--total">
        <span class="card-index">01 / TOTAL SYSTEMS</span>
        <strong>{{ formatNumber(totalSystems) }}</strong>
        <p>四个级别系统总数</p>
      </article>
      <article class="summary-card summary-card--exist">
        <span class="card-index">02 / REPORT EXISTS</span>
        <strong>{{ formatNumber(existSystems) }}</strong>
        <p>已存在月度报告的系统</p>
      </article>
      <article class="summary-card summary-card--missing">
        <span class="card-index">03 / REPORT MISSING</span>
        <strong>{{ formatNumber(missingSystems) }}</strong>
        <p>仍需补齐报告的系统</p>
      </article>
      <article class="summary-card summary-card--rate">
        <span class="card-index">04 / COVERAGE</span>
        <strong>{{ coverageRate }}%</strong>
        <p>月度报告覆盖率</p>
        <div class="progress"><span :style="{ width: `${coverageRate}%` }" /></div>
      </article>
    </section>

    <section class="level-grid">
      <article v-for="level in levels" :key="level" class="level-card">
        <header>
          <div class="level-mark">{{ level }}</div>
          <div>
            <span>LEVEL {{ level }}</span>
            <h2>{{ levelLabels[level] }}</h2>
          </div>
          <strong>{{ formatNumber(levelData[level].total) }}</strong>
        </header>
        <div class="level-metrics">
          <div><span>存在报告</span><b>{{ formatNumber(levelData[level].exist) }}</b></div>
          <div><span>缺失报告</span><b class="missing-text">{{ formatNumber(levelData[level].missing) }}</b></div>
        </div>
        <div class="level-bar"><span :style="{ width: `${levelRate(levelData[level])}%` }" /></div>
        <p class="level-rate">覆盖率 {{ levelRate(level) }}%</p>
      </article>
    </section>

    <section class="details-panel">
      <header class="panel-header">
        <div><span class="eyebrow">ACTION QUEUE</span><h2>缺失报告系统明细</h2></div>
        <span class="panel-note">共 {{ formatNumber(missingSystems) }} 个系统待补齐</span>
      </header>
      <div v-if="missingRows.length" class="missing-groups">
        <article v-for="group in missingRows" :key="group.level" class="missing-group">
          <div class="group-title"><span class="level-pill">{{ group.level }}</span><strong>{{ levelLabels[group.level] }}</strong><em>{{ group.items.length }} 个</em></div>
          <div class="system-list">
            <div v-for="item in group.items" :key="`${group.level}-${item.systemId}`" class="system-item">
              <span class="system-id">{{ item.systemId || '-' }}</span>
              <span>{{ item.systemName || '未命名系统' }}</span>
            </div>
          </div>
        </article>
      </div>
      <el-empty v-else description="当前月份所有系统均已存在报告" />
    </section>
  </div>
</template>

<script>
import { getMonthlyReportStats } from '@/api/alertOverview'

const LEVELS = ['A+', 'A', 'B', 'C']
const emptyLevel = () => ({ exist: 0, total: 0, missing: 0, unexists: [] })

export default {
  name: 'MonthlyReport',
  data() {
    return {
      loading: false,
      month: this.formatMonth(new Date()),
      updatedAt: '',
      levels: LEVELS,
      levelLabels: { A: '核心系统', 'A+': '关键系统', B: '重要系统', C: '一般系统' },
      levelData: LEVELS.reduce((result, level) => ({ ...result, [level]: emptyLevel() }), {})
    }
  },
  computed: {
    totalSystems() { return this.levels.reduce((sum, level) => sum + this.levelData[level].total, 0) },
    existSystems() { return this.levels.reduce((sum, level) => sum + this.levelData[level].exist, 0) },
    missingSystems() { return this.levels.reduce((sum, level) => sum + this.levelData[level].missing, 0) },
    coverageRate() { return this.totalSystems ? ((this.existSystems / this.totalSystems) * 100).toFixed(1) : '0.0' },
    displayMonth() {
      if (!this.month) return '-'
      const [year, month] = this.month.split('-')
      return `${year} · ${month}月`
    },
    missingRows() {
      return this.levels.map(level => ({ level, items: this.levelData[level].unexists })).filter(group => group.items.length)
    }
  },
  created() { this.loadData() },
  methods: {
    formatMonth(date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}` },
    formatNumber(value) { return Number(value || 0).toLocaleString('zh-CN') },
    levelRate(data) { return data.total ? ((data.exist / data.total) * 100).toFixed(1) : '0.0' },
    normalize(payload) {
      const source = payload && payload.data ? payload.data : payload
      return this.levels.reduce((result, level) => {
        const item = source && source[level] ? source[level] : {}
        const total = Number(item.total || 0)
        const exist = Number(item.exist || 0)
        const unexists = Array.isArray(item.unexists) ? item.unexists : []
        result[level] = { total, exist, missing: Number(item.unexist != null ? item.unexist : total - exist), unexists }
        return result
      }, {})
    },
    async loadData() {
      this.loading = true
      try {
        const data = await getMonthlyReportStats({ month: this.month })
        this.levelData = this.normalize(data)
        this.updatedAt = new Date().toLocaleTimeString('zh-CN', { hour12: false })
      } catch (error) {
        this.levelData = LEVELS.reduce((result, level) => ({ ...result, [level]: emptyLevel() }), {})
      } finally { this.loading = false }
    }
  }
}
</script>

<style lang="scss" scoped>
$ink: #173f5f; $orange: #ff5c35; $paper: #f4f1eb;
.monthly-report { min-height: 100%; padding: 22px; color: #183044; background: linear-gradient(rgba(23,63,95,.025) 1px,transparent 1px), linear-gradient(90deg,rgba(23,63,95,.025) 1px,transparent 1px),$paper; background-size: 24px 24px; font-family: "PingFang SC", "Microsoft YaHei", sans-serif; }
.report-header { display:flex; justify-content:space-between; gap:20px; padding:30px 34px; color:#fff; background:linear-gradient(120deg,#173f5f,#20577c); box-shadow:0 12px 25px rgba(23,63,95,.16); }
.eyebrow,.card-index { font-size:10px; font-weight:700; letter-spacing:.16em; } .report-header .eyebrow { color:#ff9b81; } h1 { margin:8px 0 6px; font-family:"STSong","SimSun",serif; font-size:32px; font-weight:600; } .report-header p { margin:0; color:#bed0dc; font-size:13px; }
.header-stamp { min-width:150px; align-self:center; padding-left:24px; border-left:1px solid rgba(255,255,255,.25); } .header-stamp span { display:block; color:#9db7c8; font-size:10px; letter-spacing:.12em; } .header-stamp strong { display:block; margin-top:7px; color:#fff; font-size:24px; }
.toolbar { display:flex; align-items:center; gap:12px; margin:16px 0; padding:13px 16px; background:#fff; border-left:3px solid $orange; box-shadow:0 7px 20px rgba(23,63,95,.07); } .toolbar .updated { margin-left:auto; color:#87939c; font-size:12px; } .updated i { display:inline-block; width:7px; height:7px; margin-right:6px; background:#35a36f; border-radius:50%; }
.summary-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:14px; } .summary-card { min-height:132px; padding:21px 24px; background:#fff; border-top:2px solid #cbd5db; box-shadow:0 8px 20px rgba(23,63,95,.06); } .summary-card--exist { border-color:#35a36f; } .summary-card--missing { border-color:$orange; } .summary-card--rate { color:#fff; background:$ink; border-color:$orange; } .card-index { display:block; margin-bottom:16px; color:#8a98a2; } .summary-card--missing .card-index { color:$orange; } .summary-card--rate .card-index { color:#ff9b81; } .summary-card strong { display:block; font-size:36px; line-height:1; } .summary-card p { margin:10px 0 0; color:#8a969e; font-size:12px; } .summary-card--rate p { color:#b8c9d4; } .progress,.level-bar { height:4px; margin-top:15px; overflow:hidden; background:rgba(255,255,255,.15); } .progress span { display:block; height:100%; background:$orange; }
.level-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:14px; margin-top:14px; } .level-card { padding:19px; background:#fff; border:1px solid #e1e6e8; box-shadow:0 8px 22px rgba(23,63,95,.055); } .level-card header { display:flex; align-items:center; gap:11px; } .level-mark { display:grid; width:42px; height:42px; place-items:center; color:#fff; background:$ink; font-size:15px; font-weight:700; } .level-card header span { color:$orange; font-size:9px; letter-spacing:.12em; } .level-card h2 { margin:4px 0 0; color:$ink; font-family:"STSong","SimSun",serif; font-size:17px; } .level-card header strong { margin-left:auto; color:$ink; font-size:22px; } .level-metrics { display:flex; gap:30px; margin:25px 0 12px; } .level-metrics span { display:block; color:#89959d; font-size:11px; } .level-metrics b { display:block; margin-top:5px; color:#344b5c; font-size:20px; } .level-metrics .missing-text { color:$orange; } .level-bar { margin:0; background:#eef1f2; } .level-bar span { display:block; height:100%; background:#35a36f; } .level-rate { margin:8px 0 0; color:#89959d; font-size:11px; text-align:right; }
.details-panel { margin-top:14px; background:#fff; border:1px solid #e1e6e8; box-shadow:0 8px 22px rgba(23,63,95,.055); } .panel-header { display:flex; align-items:flex-end; justify-content:space-between; padding:20px 22px 16px; border-bottom:1px solid #e4e8ea; } .panel-header .eyebrow { color:$orange; } .panel-header h2 { margin:5px 0 0; color:$ink; font-family:"STSong","SimSun",serif; font-size:22px; } .panel-note { color:#89959d; font-size:12px; } .missing-groups { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:20px; padding:20px 22px 24px; } .missing-group { border:1px solid #e2e7e9; } .group-title { display:flex; align-items:center; gap:9px; padding:12px 14px; background:#f5f7f8; } .group-title strong { color:$ink; font-size:13px; } .group-title em { margin-left:auto; color:$orange; font-size:11px; font-style:normal; } .level-pill { display:inline-grid; width:28px; height:24px; place-items:center; color:#fff; background:$ink; font-size:11px; font-weight:700; } .system-list { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px; padding:12px 14px; } .system-item { display:flex; flex-direction:column; gap:3px; padding:9px 10px; background:#fbfcfc; border-left:2px solid #d7dfe3; color:#465c6c; font-size:12px; } .system-id { color:#95a1a9; font-family:monospace; font-size:10px; }
::v-deep .el-date-editor.el-input,.el-date-editor.el-input__inner { width:180px; } ::v-deep .el-button--primary { color:#fff; background:$orange; border-color:$orange; } ::v-deep .el-empty { padding:35px 0; }
@media (max-width:1100px) { .summary-grid,.level-grid { grid-template-columns:repeat(2,1fr); } .report-header { flex-direction:column; } .header-stamp { padding:0; border:0; } }
@media (max-width:700px) { .monthly-report { padding:12px; } .toolbar { display:block; } .toolbar .el-button { margin:10px 0 0; width:100%; } .toolbar .updated { display:block; margin-top:12px; } .summary-grid,.level-grid,.missing-groups { grid-template-columns:1fr; } .system-list { grid-template-columns:1fr; } .panel-header { align-items:flex-start; flex-direction:column; gap:8px; } }
</style>
