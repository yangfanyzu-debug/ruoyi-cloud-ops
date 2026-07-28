<template>
  <div class="ai-overview" v-loading="loading">
    <section class="hero">
      <div class="hero__copy">
        <span class="eyebrow">ALERT INTELLIGENCE / AI OPERATIONS</span>
        <h1>AI 告警处理概览</h1>
        <p>看清每一条告警由谁处理、AI 覆盖到哪里，以及仍需人工介入的压力分布。</p>
      </div>
      <div class="hero__criteria">
        <span class="criteria__label">AI 判定口径</span>
        <code>create_by = AIAGENT_MATCH</code>
        <i>AND</i>
        <code>deal_desc 包含 AI Agent</code>
      </div>
    </section>

    <section class="filter-bar">
      <div class="quick-ranges">
        <button
          v-for="item in quickRanges"
          :key="item.days"
          type="button"
          :class="{ active: activeDays === item.days }"
          @click="selectQuickRange(item.days)"
        >
          {{ item.label }}
        </button>
      </div>
      <el-date-picker
        v-model="dateRange"
        class="date-range"
        type="datetimerange"
        range-separator="至"
        start-placeholder="开始时间"
        end-placeholder="结束时间"
        value-format="yyyy-MM-dd HH:mm:ss"
        :clearable="false"
        @change="handleCustomRange"
      />
      <el-button class="query-button" icon="el-icon-search" @click="loadData">查询</el-button>
      <span class="updated-at">
        <i class="status-dot" />
        {{ updatedAt ? `更新于 ${updatedAt}` : '等待查询' }}
      </span>
    </section>

    <section class="metric-grid">
      <article class="metric-card metric-card--total">
        <span class="metric-card__index">01 / TOTAL</span>
        <strong>{{ formatNumber(summary.totalCount) }}</strong>
        <p>时间范围内告警总量</p>
      </article>
      <article class="metric-card metric-card--ai">
        <span class="metric-card__index">02 / AI PROCESSED</span>
        <strong>{{ formatNumber(summary.aiCount) }}</strong>
        <p>同时命中两项 AI 规则</p>
      </article>
      <article class="metric-card metric-card--manual">
        <span class="metric-card__index">03 / NON-AI</span>
        <strong>{{ formatNumber(summary.nonAiCount) }}</strong>
        <p>未满足完整 AI 口径</p>
      </article>
      <article class="metric-card metric-card--rate">
        <span class="metric-card__index">04 / COVERAGE</span>
        <strong>{{ formatRate(summary.aiRate) }}</strong>
        <p>AI 处理覆盖率</p>
        <div class="rate-track"><span :style="{ width: rateWidth }" /></div>
      </article>
    </section>

    <section class="quality-strip">
      <div>
        <span>AI 创建标记</span>
        <strong>{{ formatNumber(summary.aiCreatorCount) }}</strong>
      </div>
      <div>
        <span>描述含 AI Agent</span>
        <strong>{{ formatNumber(summary.aiDescriptionCount) }}</strong>
      </div>
      <div :class="{ warning: summary.criteriaMismatchCount > 0 }">
        <span>口径不一致</span>
        <strong>{{ formatNumber(summary.criteriaMismatchCount) }}</strong>
      </div>
      <p>“口径不一致”表示仅命中创建者或描述关键词之一，可用于排查处理链路的数据质量。</p>
    </section>

    <el-empty
      v-if="!loading && summary.totalCount === 0"
      class="empty-state"
      description="所选时间范围内暂无告警数据"
    />

    <template v-else>
      <section class="chart-layout">
        <article class="panel panel--trend">
          <header class="panel__header">
            <div>
              <span>PROCESSING PULSE</span>
              <h2>处理趋势</h2>
            </div>
            <em>{{ granularity === 'month' ? '按月聚合' : '按日聚合' }}</em>
          </header>
          <stats-chart :option="trendOption" />
        </article>
        <article class="panel panel--composition">
          <header class="panel__header">
            <div>
              <span>WORKLOAD SPLIT</span>
              <h2>处理构成</h2>
            </div>
          </header>
          <stats-chart :option="compositionOption" />
        </article>
      </section>

      <section class="dimension-grid">
        <article class="panel">
          <header class="panel__header">
            <div><span>SYSTEM COVERAGE</span><h2>按系统</h2></div>
            <em>TOP 10</em>
          </header>
          <stats-chart :option="systemOption" />
        </article>
        <article class="panel">
          <header class="panel__header">
            <div><span>ALERT SOURCE COVERAGE</span><h2>按告警源</h2></div>
            <em>字段 ei_event_alert_source</em>
          </header>
          <stats-chart :option="sourceOption" />
        </article>
      </section>

      <section class="table-grid">
        <article class="panel table-panel">
          <header class="panel__header">
            <div><span>EVENT TYPE</span><h2>按告警类型</h2></div>
          </header>
          <dimension-table :rows="dimensions.eventTypes" />
        </article>
        <article class="panel table-panel">
          <header class="panel__header">
            <div><span>DATA CENTER</span><h2>按数据中心</h2></div>
          </header>
          <dimension-table :rows="dimensions.dataCenters" />
        </article>
      </section>
    </template>
  </div>
</template>

<script>
import { getAlertOverview } from '@/api/alertOverview'
import StatsChart from './StatsChart'

const DimensionTable = {
  functional: true,
  props: {
    rows: { type: Array, default: () => [] }
  },
  render(h, context) {
    return h('el-table', {
      props: { data: context.props.rows.slice(0, 10), stripe: true, size: 'small' }
    }, [
      h('el-table-column', { props: { prop: 'dimensionName', label: '维度', minWidth: 130, showOverflowTooltip: true } }),
      h('el-table-column', { props: { prop: 'totalCount', label: '总量', width: 82, align: 'right' } }),
      h('el-table-column', { props: { prop: 'aiCount', label: 'AI', width: 82, align: 'right' } }),
      h('el-table-column', { props: { prop: 'nonAiCount', label: '非 AI', width: 82, align: 'right' } }),
      h('el-table-column', {
        props: { label: 'AI 占比', width: 96, align: 'right' },
        scopedSlots: {
          default: scope => h('span', { class: 'rate-cell' }, `${Number(scope.row.aiRate || 0).toFixed(1)}%`)
        }
      })
    ])
  }
}

const emptySummary = () => ({
  totalCount: 0,
  aiCount: 0,
  nonAiCount: 0,
  aiRate: 0,
  aiCreatorCount: 0,
  aiDescriptionCount: 0,
  criteriaMismatchCount: 0
})

const emptyDimensions = () => ({
  systems: [],
  sources: [],
  eventTypes: [],
  dataCenters: []
})

export default {
  name: 'AiAlertOverview',
  components: { StatsChart, DimensionTable },
  data() {
    return {
      loading: false,
      activeDays: 7,
      quickRanges: [
        { label: '最近 7 天', days: 7 },
        { label: '最近 30 天', days: 30 },
        { label: '最近 90 天', days: 90 }
      ],
      dateRange: [],
      updatedAt: '',
      summary: emptySummary(),
      trend: [],
      dimensions: emptyDimensions(),
      granularity: 'day'
    }
  },
  computed: {
    rateWidth() {
      return `${Math.max(0, Math.min(100, Number(this.summary.aiRate || 0)))}%`
    },
    trendOption() {
      return {
        color: ['#ff5c35', '#173f5f', '#aab5c0'],
        tooltip: { trigger: 'axis', backgroundColor: '#122637', borderWidth: 0, textStyle: { color: '#fff' } },
        legend: { top: 0, right: 4, itemWidth: 14, textStyle: { color: '#617080' } },
        grid: { top: 46, left: 18, right: 18, bottom: 12, containLabel: true },
        xAxis: {
          type: 'category',
          boundaryGap: false,
          data: this.trend.map(item => item.period),
          axisLine: { lineStyle: { color: '#dce2e7' } },
          axisLabel: { color: '#7b8792', hideOverlap: true }
        },
        yAxis: {
          type: 'value',
          minInterval: 1,
          splitLine: { lineStyle: { color: '#edf0f2' } },
          axisLabel: { color: '#7b8792' }
        },
        series: [
          this.lineSeries('总告警', 'totalCount', '#173f5f', false),
          this.lineSeries('AI 处理', 'aiCount', '#ff5c35', true),
          this.lineSeries('非 AI', 'nonAiCount', '#aab5c0', false)
        ]
      }
    },
    compositionOption() {
      return {
        color: ['#ff5c35', '#d9e0e5'],
        tooltip: { trigger: 'item', formatter: '{b}<br/>{c} 条 · {d}%' },
        legend: { bottom: 2, icon: 'circle', itemWidth: 9 },
        graphic: [{
          type: 'text',
          left: 'center',
          top: '42%',
          style: {
            text: `${this.formatRate(this.summary.aiRate)}\nAI 覆盖`,
            textAlign: 'center',
            fill: '#173f5f',
            font: '600 18px "PingFang SC"'
          }
        }],
        series: [{
          type: 'pie',
          radius: ['57%', '76%'],
          center: ['50%', '46%'],
          label: { show: false },
          itemStyle: { borderColor: '#fff', borderWidth: 3 },
          data: [
            { name: 'AI 处理', value: this.summary.aiCount },
            { name: '非 AI', value: this.summary.nonAiCount }
          ]
        }]
      }
    },
    systemOption() {
      return this.dimensionOption(this.dimensions.systems)
    },
    sourceOption() {
      return this.dimensionOption(this.dimensions.sources)
    }
  },
  created() {
    this.selectQuickRange(7, false)
    this.loadData()
  },
  methods: {
    formatDate(date) {
      const pad = value => String(value).padStart(2, '0')
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
    },
    selectQuickRange(days, reload = true) {
      const end = new Date()
      const start = new Date()
      start.setDate(start.getDate() - (days - 1))
      start.setHours(0, 0, 0, 0)
      this.activeDays = days
      this.dateRange = [this.formatDate(start), this.formatDate(end)]
      if (reload) this.loadData()
    },
    handleCustomRange() {
      this.activeDays = null
    },
    async loadData() {
      if (!this.dateRange || this.dateRange.length !== 2) {
        this.$message.warning('请选择统计时间范围')
        return
      }
      this.loading = true
      try {
        const data = await getAlertOverview({
          startTime: this.dateRange[0],
          endTime: this.dateRange[1]
        })
        this.summary = { ...emptySummary(), ...(data.summary || {}) }
        this.trend = data.trend || []
        this.dimensions = { ...emptyDimensions(), ...(data.dimensions || {}) }
        this.granularity = data.range && data.range.granularity || 'day'
        this.updatedAt = new Date().toLocaleTimeString('zh-CN', { hour12: false })
      } catch (error) {
        this.summary = emptySummary()
        this.trend = []
        this.dimensions = emptyDimensions()
      } finally {
        this.loading = false
      }
    },
    formatNumber(value) {
      return Number(value || 0).toLocaleString('zh-CN')
    },
    formatRate(value) {
      return `${Number(value || 0).toFixed(1)}%`
    },
    lineSeries(name, key, color, area) {
      return {
        name,
        type: 'line',
        smooth: 0.32,
        symbol: 'circle',
        symbolSize: 6,
        data: this.trend.map(item => item[key]),
        lineStyle: { width: name === 'AI 处理' ? 3 : 2, color },
        itemStyle: { color },
        areaStyle: area ? { color: 'rgba(255, 92, 53, 0.10)' } : undefined
      }
    },
    dimensionOption(rows) {
      const data = rows.slice(0, 10).reverse()
      return {
        color: ['#ff5c35', '#d9e0e5'],
        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
        legend: { top: 0, right: 0, itemWidth: 12 },
        grid: { top: 36, left: 18, right: 18, bottom: 8, containLabel: true },
        xAxis: {
          type: 'value',
          minInterval: 1,
          splitLine: { lineStyle: { color: '#edf0f2' } },
          axisLabel: { color: '#7b8792' }
        },
        yAxis: {
          type: 'category',
          data: data.map(item => item.dimensionName),
          axisLine: { show: false },
          axisTick: { show: false },
          axisLabel: { color: '#465666', width: 108, overflow: 'truncate' }
        },
        series: [
          { name: 'AI 处理', type: 'bar', stack: 'total', barWidth: 13, data: data.map(item => item.aiCount), itemStyle: { borderRadius: [0, 0, 0, 0] } },
          { name: '非 AI', type: 'bar', stack: 'total', barWidth: 13, data: data.map(item => item.nonAiCount), itemStyle: { borderRadius: [0, 4, 4, 0] } }
        ]
      }
    }
  }
}
</script>

<style lang="scss" scoped>
$ink: #173f5f;
$orange: #ff5c35;
$paper: #f4f1eb;

.ai-overview {
  min-height: 100%;
  padding: 22px;
  color: #183044;
  background:
    linear-gradient(rgba(23, 63, 95, 0.025) 1px, transparent 1px),
    linear-gradient(90deg, rgba(23, 63, 95, 0.025) 1px, transparent 1px),
    $paper;
  background-size: 24px 24px;
  font-family: "PingFang SC", "Microsoft YaHei", sans-serif;
}

.hero {
  position: relative;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  min-height: 176px;
  padding: 32px 36px;
  overflow: hidden;
  color: #fff;
  background: $ink;
  border-radius: 4px 4px 18px 4px;
  box-shadow: 0 18px 40px rgba(23, 63, 95, 0.18);
}

.hero::after {
  position: absolute;
  top: -68px;
  right: 18%;
  width: 210px;
  height: 260px;
  content: "";
  border: 1px solid rgba(255, 255, 255, 0.13);
  transform: rotate(26deg);
}

.hero__copy, .hero__criteria { position: relative; z-index: 1; }
.eyebrow, .panel__header span, .metric-card__index {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.16em;
}
.eyebrow { color: #ffb49f; }
.hero h1 { margin: 10px 0 7px; font-family: "STSong", "SimSun", serif; font-size: 36px; font-weight: 600; letter-spacing: 0.02em; }
.hero p { margin: 0; color: #b9c9d5; font-size: 14px; }
.hero__criteria { display: flex; align-items: center; gap: 9px; padding: 13px 16px; background: rgba(8, 27, 41, 0.5); border: 1px solid rgba(255,255,255,.13); }
.hero__criteria code { color: #fff; font-family: "SFMono-Regular", Consolas, monospace; font-size: 11px; }
.hero__criteria i { color: #ff8b6d; font-size: 10px; font-style: normal; font-weight: 800; }
.criteria__label { margin-right: 3px; color: #8fa8b9; font-size: 11px; }

.filter-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 18px 0;
  padding: 13px 16px;
  background: #fff;
  border-left: 3px solid $orange;
  box-shadow: 0 7px 20px rgba(23, 63, 95, 0.07);
}
.quick-ranges { display: flex; gap: 3px; padding: 3px; background: #edf1f3; }
.quick-ranges button { padding: 8px 13px; color: #667683; background: transparent; border: 0; cursor: pointer; transition: .2s ease; }
.quick-ranges button.active { color: #fff; background: $ink; box-shadow: 0 4px 10px rgba(23, 63, 95, .2); }
.date-range { width: 370px; }
.query-button { color: #fff; background: $orange; border-color: $orange; }
.updated-at { margin-left: auto; color: #8a959e; font-size: 12px; white-space: nowrap; }
.status-dot { display: inline-block; width: 7px; height: 7px; margin-right: 5px; background: #35a36f; border-radius: 50%; box-shadow: 0 0 0 4px rgba(53,163,111,.12); }

.metric-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; }
.metric-card { position: relative; min-height: 142px; padding: 22px 24px; overflow: hidden; background: #fff; border-top: 2px solid #ccd5db; box-shadow: 0 8px 20px rgba(23,63,95,.06); transition: transform .2s ease, box-shadow .2s ease; }
.metric-card:hover { transform: translateY(-3px); box-shadow: 0 13px 26px rgba(23,63,95,.1); }
.metric-card::after { position: absolute; right: -18px; bottom: -42px; width: 112px; height: 112px; content: ""; border: 18px solid rgba(23,63,95,.035); border-radius: 50%; }
.metric-card--ai { border-color: $orange; }
.metric-card--manual { border-color: #9aa8b2; }
.metric-card--rate { color: #fff; background: $ink; border-color: $orange; }
.metric-card__index { display: block; margin-bottom: 15px; color: #8b99a3; }
.metric-card--ai .metric-card__index { color: $orange; }
.metric-card--rate .metric-card__index { color: #ff9b81; }
.metric-card strong { display: block; font-family: "DIN Alternate", "Helvetica Neue", sans-serif; font-size: 38px; line-height: 1; }
.metric-card p { margin: 10px 0 0; color: #88949d; font-size: 12px; }
.metric-card--rate p { color: #b4c6d3; }
.rate-track { width: 100%; height: 3px; margin-top: 15px; overflow: hidden; background: rgba(255,255,255,.13); }
.rate-track span { display: block; height: 100%; background: $orange; transition: width .5s ease; }

.quality-strip { display: grid; grid-template-columns: 150px 170px 150px 1fr; align-items: center; margin: 14px 0; padding: 14px 20px; background: rgba(255,255,255,.74); border: 1px solid #e0e4e6; }
.quality-strip > div { display: flex; align-items: baseline; justify-content: space-between; margin-right: 22px; padding-right: 22px; border-right: 1px solid #dde2e5; }
.quality-strip span, .quality-strip p { color: #7a8791; font-size: 11px; }
.quality-strip strong { font-size: 18px; }
.quality-strip .warning strong { color: $orange; }
.quality-strip p { margin: 0; text-align: right; }

.chart-layout { display: grid; grid-template-columns: minmax(0, 2fr) minmax(290px, .8fr); gap: 14px; }
.dimension-grid, .table-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; margin-top: 14px; }
.panel { min-width: 0; padding: 20px 22px 16px; background: #fff; border: 1px solid #e2e6e8; box-shadow: 0 8px 22px rgba(23,63,95,.055); }
.panel--trend, .panel--composition { min-height: 372px; }
.dimension-grid .panel { min-height: 390px; }
.panel__header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 10px; }
.panel__header span { color: $orange; }
.panel__header h2 { margin: 5px 0 0; color: $ink; font-family: "STSong", "SimSun", serif; font-size: 21px; }
.panel__header em { padding-top: 4px; color: #95a0a8; font-size: 10px; font-style: normal; }
.table-panel { min-height: 340px; }
.empty-state { margin-top: 14px; background: #fff; border: 1px solid #e2e6e8; }

::v-deep .el-range-editor.el-input__inner { border-radius: 0; }
::v-deep .el-table::before { display: none; }
::v-deep .el-table th.el-table__cell { color: #6f7b85; font-size: 11px; font-weight: 600; background: #f4f6f7; }
::v-deep .el-table td.el-table__cell { color: #354b5d; }
::v-deep .rate-cell { color: $orange; font-weight: 600; }

@media (max-width: 1180px) {
  .hero { align-items: flex-start; flex-direction: column; gap: 24px; }
  .filter-bar { align-items: flex-start; flex-wrap: wrap; }
  .updated-at { margin: 8px 0 0 auto; }
  .metric-grid { grid-template-columns: repeat(2, 1fr); }
  .quality-strip { grid-template-columns: repeat(3, 1fr); }
  .quality-strip p { grid-column: 1 / -1; margin-top: 10px; text-align: left; }
}

@media (max-width: 768px) {
  .ai-overview { padding: 12px; }
  .hero { padding: 25px 22px; }
  .hero h1 { font-size: 29px; }
  .hero__criteria { align-items: flex-start; flex-direction: column; }
  .filter-bar { display: block; }
  .date-range { width: 100%; margin: 10px 0; }
  .query-button { width: 100%; }
  .updated-at { display: block; margin-top: 12px; }
  .metric-grid, .chart-layout, .dimension-grid, .table-grid { grid-template-columns: 1fr; }
  .quality-strip { grid-template-columns: 1fr; }
  .quality-strip > div { margin: 0; padding: 10px 0; border-right: 0; border-bottom: 1px solid #dde2e5; }
}
</style>
