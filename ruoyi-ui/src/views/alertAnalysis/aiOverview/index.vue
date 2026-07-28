<template>
  <div class="ai-overview" v-loading="loading">
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
      <div class="criteria-inline">
        <span class="criteria__label">AI 判定口径</span>
        <code>create_by = AIAGENT_MATCH</code>
        <i>AND</i>
        <code>deal_desc 包含 AI Agent</code>
      </div>
      <span class="updated-at">
        <i class="status-dot" />
        {{ updatedAt ? `更新于 ${updatedAt}` : '等待查询' }}
      </span>
    </section>

    <section class="metric-grid">
      <article
        class="metric-card metric-card--total metric-card--clickable"
        :class="{ 'is-selected': detailProcessType === 'all' }"
        role="button"
        tabindex="0"
        @click="selectProcessType('all')"
        @keyup.enter="selectProcessType('all')"
      >
        <span class="metric-card__index">01 / TOTAL</span>
        <strong>{{ formatNumber(summary.totalCount) }}</strong>
        <p>时间范围内告警总量 · 点击看明细</p>
      </article>
      <article
        class="metric-card metric-card--ai metric-card--clickable"
        :class="{ 'is-selected': detailProcessType === 'ai' }"
        role="button"
        tabindex="0"
        @click="selectProcessType('ai')"
        @keyup.enter="selectProcessType('ai')"
      >
        <span class="metric-card__index">02 / AI PROCESSED</span>
        <strong>{{ formatNumber(summary.aiCount) }}</strong>
        <p>同时命中两项 AI 规则 · 点击看明细</p>
      </article>
      <article
        class="metric-card metric-card--manual metric-card--clickable"
        :class="{ 'is-selected': detailProcessType === 'nonAi' }"
        role="button"
        tabindex="0"
        @click="selectProcessType('nonAi')"
        @keyup.enter="selectProcessType('nonAi')"
      >
        <span class="metric-card__index">03 / NON-AI</span>
        <strong>{{ formatNumber(summary.nonAiCount) }}</strong>
        <p>未满足完整 AI 口径 · 点击看明细</p>
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
          <stats-chart :option="systemOption" @select="selectDimension('system', $event)" />
        </article>
        <article class="panel">
          <header class="panel__header">
            <div><span>ALERT SOURCE COVERAGE</span><h2>按告警源</h2></div>
            <em>字段 ei_event_alert_source</em>
          </header>
          <stats-chart :option="sourceOption" @select="selectDimension('source', $event)" />
        </article>
      </section>

      <section ref="detailSection" class="panel detail-panel">
        <header class="detail-header">
          <div>
            <span class="detail-header__eyebrow">TRACEABLE ALERTS</span>
            <h2>告警明细</h2>
            <p>点击上方指标卡筛选处理类型，点击系统或告警源柱形条进一步定位。</p>
          </div>
          <div class="detail-filter">
            <button
              v-for="item in processFilters"
              :key="item.value"
              type="button"
              :class="{ active: detailProcessType === item.value }"
              @click="selectProcessType(item.value)"
            >
              {{ item.label }}
            </button>
            <el-tag
              v-if="detailDimensionType"
              closable
              effect="plain"
              @close="clearDimension"
            >
              {{ detailDimensionLabel }}
            </el-tag>
          </div>
        </header>

        <el-table
          v-loading="detailLoading"
          :data="detailRows"
          class="detail-table"
          stripe
          row-key="eventId"
          empty-text="当前筛选条件下暂无告警"
        >
          <el-table-column type="expand" width="42">
            <template slot-scope="{ row }">
              <div class="expanded-detail">
                <div><span>告警描述</span><p>{{ row.alertDescription || '-' }}</p></div>
                <div><span>处理说明</span><p>{{ row.dealDescription || '-' }}</p></div>
                <div><span>实例 / IP</span><p>{{ row.instanceName || '-' }} / {{ row.eventIp || '-' }}</p></div>
                <div><span>创建标记</span><p class="mono">{{ row.createBy || '-' }}</p></div>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="处理类型" width="96">
            <template slot-scope="{ row }">
              <el-tag :type="row.isAiProcessed ? 'success' : 'info'" size="mini" effect="plain">
                {{ row.isAiProcessed ? 'AI 处理' : '非 AI' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="createTime" label="入库时间" width="158" />
          <el-table-column prop="alertId" label="告警 ID" min-width="140" show-overflow-tooltip />
          <el-table-column prop="systemName" label="系统" width="110" show-overflow-tooltip />
          <el-table-column prop="alertSource" label="告警源" width="100" show-overflow-tooltip />
          <el-table-column prop="instanceName" label="实例" min-width="130" show-overflow-tooltip />
          <el-table-column prop="alertDescription" label="告警描述" min-width="220" show-overflow-tooltip />
          <el-table-column prop="dealDescription" label="处理说明" min-width="220" show-overflow-tooltip />
        </el-table>

        <div class="detail-footer">
          <span>共 {{ formatNumber(detailTotal) }} 条</span>
          <el-pagination
            background
            layout="prev, pager, next, sizes"
            :current-page="detailPageNum"
            :page-size="detailPageSize"
            :page-sizes="[10, 20, 50]"
            :total="detailTotal"
            @current-change="handleDetailPageChange"
            @size-change="handleDetailSizeChange"
          />
        </div>
      </section>
    </template>
  </div>
</template>

<script>
import { getAlertDetails, getAlertOverview } from '@/api/alertOverview'
import StatsChart from './StatsChart'

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
  sources: []
})

export default {
  name: 'AiAlertOverview',
  components: { StatsChart },
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
      granularity: 'day',
      detailLoading: false,
      detailRows: [],
      detailTotal: 0,
      detailPageNum: 1,
      detailPageSize: 10,
      detailProcessType: 'all',
      detailDimensionType: '',
      detailDimensionValue: '',
      detailDimensionName: '',
      processFilters: [
        { label: '全部', value: 'all' },
        { label: 'AI 处理', value: 'ai' },
        { label: '非 AI', value: 'nonAi' }
      ]
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
    },
    detailDimensionLabel() {
      const typeLabel = this.detailDimensionType === 'system' ? '系统' : '告警源'
      return `${typeLabel}：${this.detailDimensionName || this.detailDimensionValue}`
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
        this.detailDimensionType = ''
        this.detailDimensionValue = ''
        this.detailDimensionName = ''
        this.detailPageNum = 1
        await this.loadDetails()
      } catch (error) {
        this.summary = emptySummary()
        this.trend = []
        this.dimensions = emptyDimensions()
        this.detailRows = []
        this.detailTotal = 0
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
    async loadDetails() {
      this.detailLoading = true
      try {
        const data = await getAlertDetails({
          startTime: this.dateRange[0],
          endTime: this.dateRange[1],
          processType: this.detailProcessType,
          dimensionType: this.detailDimensionType || undefined,
          dimensionValue: this.detailDimensionValue || undefined,
          pageNum: this.detailPageNum,
          pageSize: this.detailPageSize
        })
        this.detailRows = data.rows || []
        this.detailTotal = Number(data.total || 0)
      } catch (error) {
        this.detailRows = []
        this.detailTotal = 0
      } finally {
        this.detailLoading = false
      }
    },
    selectProcessType(type) {
      this.detailProcessType = type
      this.detailPageNum = 1
      this.loadDetails().then(this.scrollToDetails)
    },
    selectDimension(type, params) {
      const data = params && params.data
      if (!data || !data.dimensionKey) return
      this.detailDimensionType = type
      this.detailDimensionValue = data.dimensionKey
      this.detailDimensionName = data.dimensionName || data.dimensionKey
      this.detailPageNum = 1
      this.loadDetails().then(this.scrollToDetails)
    },
    clearDimension() {
      this.detailDimensionType = ''
      this.detailDimensionValue = ''
      this.detailDimensionName = ''
      this.detailPageNum = 1
      this.loadDetails()
    },
    handleDetailPageChange(page) {
      this.detailPageNum = page
      this.loadDetails()
    },
    handleDetailSizeChange(size) {
      this.detailPageSize = size
      this.detailPageNum = 1
      this.loadDetails()
    },
    scrollToDetails() {
      this.$nextTick(() => {
        if (this.$refs.detailSection) {
          this.$refs.detailSection.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
      })
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
          {
            name: 'AI 处理',
            type: 'bar',
            stack: 'total',
            barWidth: 13,
            cursor: 'pointer',
            data: data.map(item => ({ value: item.aiCount, dimensionKey: item.dimensionKey, dimensionName: item.dimensionName })),
            itemStyle: { borderRadius: [0, 0, 0, 0] }
          },
          {
            name: '非 AI',
            type: 'bar',
            stack: 'total',
            barWidth: 13,
            cursor: 'pointer',
            data: data.map(item => ({ value: item.nonAiCount, dimensionKey: item.dimensionKey, dimensionName: item.dimensionName })),
            itemStyle: { borderRadius: [0, 4, 4, 0] }
          }
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

.panel__header span, .metric-card__index {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.16em;
}

.filter-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 0 0 16px;
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
.criteria-inline { display: flex; align-items: center; gap: 7px; margin-left: 8px; padding: 9px 12px; color: #536675; background: #f3f6f7; border-left: 2px solid #cbd5db; white-space: nowrap; }
.criteria-inline code { color: $ink; font-family: "SFMono-Regular", Consolas, monospace; font-size: 10px; }
.criteria-inline i { color: $orange; font-size: 9px; font-style: normal; font-weight: 800; }
.criteria__label { margin-right: 2px; color: #83919b; font-size: 10px; }
.updated-at { margin-left: auto; color: #8a959e; font-size: 12px; white-space: nowrap; }
.status-dot { display: inline-block; width: 7px; height: 7px; margin-right: 5px; background: #35a36f; border-radius: 50%; box-shadow: 0 0 0 4px rgba(53,163,111,.12); }

.metric-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; }
.metric-card { position: relative; min-height: 142px; padding: 22px 24px; overflow: hidden; background: #fff; border-top: 2px solid #ccd5db; box-shadow: 0 8px 20px rgba(23,63,95,.06); transition: transform .2s ease, box-shadow .2s ease; }
.metric-card:hover { transform: translateY(-3px); box-shadow: 0 13px 26px rgba(23,63,95,.1); }
.metric-card--clickable { cursor: pointer; outline: none; }
.metric-card--clickable:focus-visible { box-shadow: 0 0 0 3px rgba(255,92,53,.22), 0 13px 26px rgba(23,63,95,.1); }
.metric-card--clickable.is-selected { box-shadow: inset 0 -3px 0 $orange, 0 10px 24px rgba(23,63,95,.1); }
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
.dimension-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; margin-top: 14px; }
.panel { min-width: 0; padding: 20px 22px 16px; background: #fff; border: 1px solid #e2e6e8; box-shadow: 0 8px 22px rgba(23,63,95,.055); }
.panel--trend, .panel--composition { min-height: 372px; }
.dimension-grid .panel { min-height: 390px; }
.panel__header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 10px; }
.panel__header span { color: $orange; }
.panel__header h2 { margin: 5px 0 0; color: $ink; font-family: "STSong", "SimSun", serif; font-size: 21px; }
.panel__header em { padding-top: 4px; color: #95a0a8; font-size: 10px; font-style: normal; }
.empty-state { margin-top: 14px; background: #fff; border: 1px solid #e2e6e8; }
.detail-panel { margin-top: 14px; padding: 0; overflow: hidden; }
.detail-header { display: flex; align-items: flex-end; justify-content: space-between; gap: 20px; padding: 20px 22px 16px; border-bottom: 1px solid #e4e8ea; }
.detail-header__eyebrow { color: $orange; font-size: 10px; font-weight: 700; letter-spacing: .16em; }
.detail-header h2 { margin: 5px 0 4px; color: $ink; font-family: "STSong", "SimSun", serif; font-size: 21px; }
.detail-header p { margin: 0; color: #84919a; font-size: 11px; }
.detail-filter { display: flex; align-items: center; gap: 6px; }
.detail-filter button { padding: 7px 12px; color: #687783; background: #f1f4f5; border: 0; cursor: pointer; }
.detail-filter button.active { color: #fff; background: $ink; }
.detail-table { width: 100%; }
.expanded-detail { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px 24px; padding: 12px 46px 16px; background: #f7f9fa; }
.expanded-detail span { display: block; margin-bottom: 5px; color: #8a969e; font-size: 10px; letter-spacing: .08em; }
.expanded-detail p { margin: 0; color: #344b5c; font-size: 12px; line-height: 1.7; white-space: pre-wrap; word-break: break-word; }
.expanded-detail .mono { font-family: "SFMono-Regular", Consolas, monospace; }
.detail-footer { display: flex; align-items: center; justify-content: space-between; padding: 14px 20px; color: #7c8992; font-size: 12px; border-top: 1px solid #e4e8ea; }

::v-deep .el-range-editor.el-input__inner { border-radius: 0; }
::v-deep .detail-table::before { display: none; }
::v-deep .detail-table th.el-table__cell { color: #667784; font-size: 11px; font-weight: 600; background: #f3f6f7; }
::v-deep .detail-table td.el-table__cell { color: #344b5c; font-size: 12px; }

@media (max-width: 1180px) {
  .filter-bar { align-items: flex-start; flex-wrap: wrap; }
  .criteria-inline { margin-left: 0; }
  .updated-at { margin: 8px 0 0 auto; }
  .metric-grid { grid-template-columns: repeat(2, 1fr); }
  .quality-strip { grid-template-columns: repeat(3, 1fr); }
  .quality-strip p { grid-column: 1 / -1; margin-top: 10px; text-align: left; }
  .detail-header { align-items: flex-start; flex-direction: column; }
}

@media (max-width: 768px) {
  .ai-overview { padding: 12px; }
  .filter-bar { display: block; }
  .date-range { width: 100%; margin: 10px 0; }
  .query-button { width: 100%; }
  .criteria-inline { align-items: flex-start; flex-direction: column; margin: 10px 0 0; white-space: normal; }
  .updated-at { display: block; margin-top: 12px; }
  .metric-grid, .chart-layout, .dimension-grid { grid-template-columns: 1fr; }
  .quality-strip { grid-template-columns: 1fr; }
  .quality-strip > div { margin: 0; padding: 10px 0; border-right: 0; border-bottom: 1px solid #dde2e5; }
  .detail-filter { align-items: flex-start; flex-wrap: wrap; }
  .expanded-detail { grid-template-columns: 1fr; padding: 12px 20px; }
  .detail-footer { align-items: flex-start; flex-direction: column; gap: 12px; }
}
</style>
