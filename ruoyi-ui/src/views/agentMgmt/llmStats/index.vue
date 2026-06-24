<template>
  <div class="app-container agent-mgmt-page">
    <div class="am-topbar">
      <div>
        <span class="am-title">LLM 调用统计</span>
        <span class="am-sub">模型资源使用与故障分析</span>
      </div>
      <div class="am-actions">
        <el-select v-model="days" size="mini" class="days-select" @change="refreshCurrent">
          <el-option :value="1" label="最近1天" />
          <el-option :value="3" label="最近3天" />
          <el-option :value="7" label="最近7天" />
          <el-option :value="14" label="最近14天" />
          <el-option :value="30" label="最近30天" />
        </el-select>
        <el-button size="mini" icon="el-icon-refresh" @click="refreshCurrent">刷新</el-button>
      </div>
    </div>

    <el-tabs v-model="activeTab" class="llm-tabs" @tab-click="onTabChange">
      <el-tab-pane label="整体统计" name="overall">
        <div v-loading="overallLoading" class="am-scroll">
          <div v-if="overallError" class="error-text">{{ overallError }}</div>
          <div class="stat-grid">
            <button type="button" class="stat-card">
              <span>总调用</span>
              <strong>{{ summary.total_calls || 0 }}</strong>
            </button>
            <button type="button" class="stat-card">
              <span>成功率</span>
              <strong :class="successRateClass">{{ summary.success_rate || '0%' }}</strong>
            </button>
            <button type="button" class="stat-card clickable" @click="openFailuresTab">
              <span>失败数</span>
              <strong class="danger">{{ summary.total_failures || 0 }}</strong>
            </button>
            <button type="button" class="stat-card">
              <span>
                平均延迟
                <el-tooltip effect="dark" content="所有LLM调用的端到端耗时均值，包含网络往返、模型推理及排队等待时间" placement="top">
                  <i class="el-icon-question latency-tip"></i>
                </el-tooltip>
              </span>
              <strong>{{ formatLatency(summary.avg_latency_ms) }}</strong>
            </button>
          </div>

          <div class="table-grid">
            <section>
              <div class="section-title">按模型分布</div>
              <el-table :data="modelRows" size="mini" border :max-height="overallTableHeight">
                <el-table-column prop="name" label="模型" min-width="140" />
                <el-table-column prop="calls" label="调用" width="80" />
                <el-table-column prop="failures" label="失败" width="80" />
                <el-table-column label="成功率" width="90">
                  <template slot-scope="{ row }">{{ row.success_rate }}</template>
                </el-table-column>
                <el-table-column width="108">
                  <template slot="header">
                    <span>
                      平均延迟
                      <el-tooltip effect="dark" content="该模型所有LLM调用的端到端耗时均值" placement="top">
                        <i class="el-icon-question latency-tip"></i>
                      </el-tooltip>
                    </span>
                  </template>
                  <template slot-scope="{ row }">{{ formatLatency(row.avg_latency_ms) }}</template>
                </el-table-column>
                <el-table-column prop="total_input_tokens" label="输入Tokens" width="120" />
                <el-table-column prop="total_output_tokens" label="输出Tokens" width="120" />
              </el-table>
            </section>

            <section>
              <div class="section-title">按角色分布</div>
              <el-table :data="roleRows" size="mini" border :max-height="overallTableHeight">
                <el-table-column prop="name" label="角色" min-width="150" />
                <el-table-column prop="calls" label="调用" width="80" />
                <el-table-column prop="failures" label="失败" width="80" />
                <el-table-column label="成功率" width="90">
                  <template slot-scope="{ row }">{{ row.success_rate }}</template>
                </el-table-column>
                <el-table-column width="108">
                  <template slot="header">
                    <span>
                      平均延迟
                      <el-tooltip effect="dark" content="该角色所有LLM调用的端到端耗时均值" placement="top">
                        <i class="el-icon-question latency-tip"></i>
                      </el-tooltip>
                    </span>
                  </template>
                  <template slot-scope="{ row }">{{ formatLatency(row.avg_latency_ms) }}</template>
                </el-table-column>
              </el-table>
            </section>
          </div>

        </div>
      </el-tab-pane>

      <el-tab-pane label="场景维度" name="scenario">
        <div class="filterbar">
          <el-select v-model="scenarioQuery.onlyFailures" size="mini" class="filter-small" @change="searchScenario">
            <el-option :value="false" label="全部请求" />
            <el-option :value="true" label="仅含失败" />
          </el-select>
          <el-select v-model="scenarioQuery.scenario_name" size="mini" clearable filterable placeholder="全部场景" @change="searchScenario">
            <el-option v-for="name in scenarioNames" :key="name" :label="name" :value="name" />
          </el-select>
          <el-input v-model.trim="scenarioQuery.keyword" size="mini" clearable placeholder="告警单号 / 系统ID" @keyup.enter.native="searchScenario" />
          <el-input v-model.trim="runIdQuery" size="mini" clearable class="run-input" placeholder="精确查询 run_id" @keyup.enter.native="searchScenario" />
          <el-button size="mini" type="primary" icon="el-icon-search" @click="searchScenario">查询</el-button>
        </div>
        <div v-loading="scenarioLoading" class="am-scroll scenario-scroll">
          <div v-if="scenarioError" class="error-text">{{ scenarioError }}</div>
          <el-table v-if="scenarioRows.length" :data="scenarioRows" size="mini" border :height="scenarioTableHeight">
            <el-table-column prop="created_at" label="时间" width="160" />
            <el-table-column prop="scenario_name" label="场景" min-width="130" />
            <el-table-column label="关联信息" min-width="160">
              <template slot-scope="{ row }">{{ extraText(row.extra_data) }}</template>
            </el-table-column>
            <el-table-column label="run_id" width="190">
              <template slot-scope="{ row }">
                <el-button type="text" class="mono-link" @click="openLogByRun(row.run_id)">{{ row.run_id }}</el-button>
              </template>
            </el-table-column>
            <el-table-column label="LLM调用数" width="100">
              <template slot-scope="{ row }">
                <el-button type="text" @click="openRunDrawer(row.run_id)">{{ row.total_calls }}</el-button>
              </template>
            </el-table-column>
            <el-table-column prop="failures" label="失败数" width="80" />
            <el-table-column prop="success_rate" label="成功率" width="90" />
            <el-table-column width="108">
              <template slot="header">
                <span>
                  平均延迟
                  <el-tooltip effect="dark" content="该请求所有LLM调用的平均耗时" placement="top">
                    <i class="el-icon-question latency-tip"></i>
                  </el-tooltip>
                </span>
              </template>
              <template slot-scope="{ row }">{{ formatLatency(row.avg_latency_ms) }}</template>
            </el-table-column>
            <el-table-column width="100">
              <template slot="header">
                <span>
                  总延迟
                  <el-tooltip effect="dark" content="该请求所有LLM调用耗时之和" placement="top">
                    <i class="el-icon-question latency-tip"></i>
                  </el-tooltip>
                </span>
              </template>
              <template slot-scope="{ row }">{{ formatLatency(row.total_latency_ms) }}</template>
            </el-table-column>
            <el-table-column label="状态" width="100">
              <template slot-scope="{ row }">
                <el-tag size="mini" :type="row.failures > 0 ? 'danger' : 'success'">{{ row.failures > 0 ? row.failures + ' 失败' : '全部成功' }}</el-tag>
              </template>
            </el-table-column>
          </el-table>
          <el-empty v-else description="无匹配数据" />
          <el-pagination
            v-if="scenarioTotal > 0"
            class="scenario-pagination"
            background
            layout="total, sizes, prev, pager, next, jumper"
            :current-page="scenarioPage"
            :page-size="scenarioPageSize"
            :page-sizes="[20, 50, 100]"
            :total="scenarioTotal"
            @current-change="handleScenarioPageChange"
            @size-change="handleScenarioSizeChange"
          />
        </div>
      </el-tab-pane>

      <el-tab-pane label="最近失败记录" name="failures">
        <div class="filterbar failure-filterbar">
          <el-input v-model.trim="failureQuery.scenario_name" size="mini" clearable placeholder="场景名称" @keyup.enter.native="searchFailures" />
          <el-select v-model="failureQuery.error_type" size="mini" clearable placeholder="错误类型" @change="searchFailures">
            <el-option label="rate_limit" value="rate_limit" />
            <el-option label="network" value="network" />
            <el-option label="other" value="other" />
          </el-select>
          <el-input v-model.trim="failureQuery.keyword" size="mini" clearable placeholder="run_id / 角色 / 模型 / 错误信息" @keyup.enter.native="searchFailures" />
          <el-button size="mini" type="primary" icon="el-icon-search" @click="searchFailures">查询</el-button>
        </div>
        <div v-loading="failureLoading" class="am-scroll failure-scroll">
          <div v-if="failureError" class="error-text">{{ failureError }}</div>
          <el-table v-if="failures.length" :data="failures" size="mini" border :height="failureRecordTableHeight">
            <el-table-column prop="created_at" label="时间" width="150" />
            <el-table-column prop="scenario_name" label="场景" width="150" show-overflow-tooltip />
            <el-table-column prop="agent_role" label="角色" width="150" show-overflow-tooltip />
            <el-table-column prop="model" label="模型" width="130" />
            <el-table-column prop="retry_count" label="重试" width="70" />
            <el-table-column prop="error_type" label="错误类型" width="110" />
            <el-table-column prop="error_msg" label="错误信息" min-width="260" show-overflow-tooltip />
            <el-table-column label="run_id" width="190">
              <template slot-scope="{ row }">
                <el-button type="text" class="mono-link" @click="openRunDrawer(row.run_id)">{{ row.run_id }}</el-button>
              </template>
            </el-table-column>
          </el-table>
          <el-empty v-else description="无失败记录" />
          <el-pagination
            v-if="failureTotal > 0"
            class="failure-pagination"
            background
            layout="total, sizes, prev, pager, next, jumper"
            :current-page="failurePage"
            :page-size="failurePageSize"
            :page-sizes="[20, 50, 100]"
            :total="failureTotal"
            @current-change="handleFailurePageChange"
            @size-change="handleFailureSizeChange"
          />
        </div>
      </el-tab-pane>
    </el-tabs>

    <el-drawer :visible.sync="drawerVisible" size="min(1180px, 92%)" custom-class="llm-drawer" :title="drawerTitle">
      <div v-loading="drawerLoading" class="drawer-body">
        <div v-if="drawerError" class="error-text">{{ drawerError }}</div>
        <div v-if="drawerData" class="drawer-summary">
          <span>场景 <strong>{{ drawerData.scenario_name || '-' }}</strong></span>
          <span>调用 <strong>{{ drawerData.total_calls }}</strong></span>
          <span>失败 <strong class="danger">{{ drawerData.total_failures }}</strong></span>
          <span>
            <el-tooltip effect="dark" content="该请求所有LLM调用耗时之和" placement="top">
              <i class="el-icon-question latency-tip"></i>
            </el-tooltip>
            总延迟
            <strong>{{ formatLatency(drawerData.total_latency_ms) }}</strong>
          </span>
        </div>
        <el-table v-if="drawerCalls.length" :data="drawerCalls" size="mini" border class="drawer-table">
          <el-table-column prop="call_index" label="#" width="44" class-name="compact-column" />
          <el-table-column prop="agent_role" label="角色" width="145" class-name="compact-column" show-overflow-tooltip />
          <el-table-column prop="model" label="模型" width="120" class-name="compact-column" show-overflow-tooltip />
          <el-table-column label="状态" width="78" class-name="compact-column">
            <template slot-scope="{ row }">
              <span :class="row.status === 'success' ? 'ok' : 'danger'">{{ row.status === 'success' ? 'OK' : 'FAIL' }}</span>
            </template>
          </el-table-column>
          <el-table-column label="延迟" width="86" class-name="compact-column">
            <template slot-scope="{ row }">{{ formatLatency(row.latency_ms) }}</template>
          </el-table-column>
          <el-table-column prop="retry_count" label="重试" width="64" class-name="compact-column" />
          <el-table-column prop="error_msg" label="错误" width="250" class-name="error-column" show-overflow-tooltip />
          <el-table-column prop="input_tokens" label="输入Tokens" width="96" class-name="compact-column" />
          <el-table-column prop="output_tokens" label="输出Tokens" width="96" class-name="compact-column" />
          <el-table-column prop="created_at" label="时间" width="145" class-name="compact-column" />
        </el-table>
        <el-empty v-else description="未找到该 run_id 的记录" />
      </div>
    </el-drawer>
  </div>
</template>

<script>
import {
  getLogHtmlByRun,
  getLlmStatsByRun,
  getLlmStatsSummary,
  listLlmStatsByScenario,
  listLlmStatsFailures
} from '@/api/agentMgmt'

export default {
  name: 'AgentMgmtLlmStats',
  data() {
    return {
      days: 7,
      activeTab: 'overall',
      overallLoading: false,
      scenarioLoading: false,
      failureLoading: false,
      drawerLoading: false,
      overallError: '',
      scenarioError: '',
      failureError: '',
      drawerError: '',
      summary: {
        total_calls: 0,
        total_failures: 0,
        success_rate: '0%',
        avg_latency_ms: 0,
        by_model: {},
        by_role: {}
      },
      failures: [],
      failureTotal: 0,
      failurePage: 1,
      failurePageSize: 20,
      failureQuery: { scenario_name: '', error_type: '', keyword: '' },
      scenarioRows: [],
      scenarioTotal: 0,
      scenarioPage: 1,
      scenarioPageSize: 20,
      scenarioNames: [],
      scenarioQuery: { onlyFailures: false, scenario_name: '', keyword: '' },
      runIdQuery: '',
      drawerVisible: false,
      drawerRunId: '',
      drawerData: null
    }
  },
  computed: {
    modelRows() {
      return this.objectRows(this.summary.by_model)
    },
    roleRows() {
      return this.objectRows(this.summary.by_role)
    },
    drawerCalls() {
      return this.drawerData && this.drawerData.calls ? this.drawerData.calls : []
    },
    drawerTitle() {
      return this.drawerRunId ? `LLM 调用详情 - ${this.drawerRunId}` : 'LLM 调用详情'
    },
    successRateClass() {
      const rate = parseFloat(this.summary.success_rate || '0')
      if (rate >= 99) return 'ok'
      if (rate >= 95) return 'warn'
      return 'danger'
    },
    overallTableHeight() {
      return 240
    },
    failureRecordTableHeight() {
      return 'calc(100vh - 390px)'
    },
    scenarioTableHeight() {
      return 'calc(100vh - 390px)'
    }
  },
  created() {
    this.loadOverall()
  },
  methods: {
    objectRows(obj) {
      return Object.keys(obj || {}).map(name => {
        const item = obj[name] || {}
        const calls = item.calls || 0
        const failures = item.failures || 0
        return {
          name,
          ...item,
          success_rate: item.success_rate || (calls ? (((calls - failures) / calls) * 100).toFixed(1) + '%' : '-')
        }
      })
    },
    refreshCurrent() {
      if (this.activeTab === 'overall') this.loadOverall()
      else if (this.activeTab === 'scenario') this.searchScenario()
      else this.searchFailures()
    },
    onTabChange() {
      this.refreshCurrent()
    },
    async loadOverall() {
      this.overallLoading = true
      this.overallError = ''
      try {
        const summary = await getLlmStatsSummary({ days: this.days })
        this.summary = summary || this.summary
      } catch (e) {
        this.overallError = this.errorText(e)
      } finally {
        this.overallLoading = false
      }
    },
    async loadScenario() {
      this.scenarioLoading = true
      this.scenarioError = ''
      try {
        const result = await listLlmStatsByScenario({
          days: this.days,
          only_failures: this.scenarioQuery.onlyFailures,
          scenario_name: this.scenarioQuery.scenario_name,
          keyword: this.scenarioQuery.keyword,
          run_id: this.runIdQuery,
          page: this.scenarioPage,
          page_size: this.scenarioPageSize
        })
        const rows = result && result.items ? result.items : []
        this.scenarioRows = Array.isArray(rows) ? rows : []
        this.scenarioTotal = result && result.total ? result.total : 0
        this.scenarioNames = Array.from(new Set(this.scenarioRows.map(row => row.scenario_name).filter(Boolean))).sort()
      } catch (e) {
        this.scenarioError = this.errorText(e)
      } finally {
        this.scenarioLoading = false
      }
    },
    searchScenario() {
      this.scenarioPage = 1
      this.loadScenario()
    },
    handleScenarioPageChange(page) {
      this.scenarioPage = page
      this.loadScenario()
    },
    handleScenarioSizeChange(size) {
      this.scenarioPageSize = size
      this.scenarioPage = 1
      this.loadScenario()
    },
    async loadFailures() {
      this.failureLoading = true
      this.failureError = ''
      try {
        const result = await listLlmStatsFailures({
          days: this.days,
          page: this.failurePage,
          page_size: this.failurePageSize,
          scenario_name: this.failureQuery.scenario_name,
          error_type: this.failureQuery.error_type,
          keyword: this.failureQuery.keyword
        })
        this.failures = result && result.items ? result.items : []
        this.failureTotal = result && result.total ? result.total : 0
      } catch (e) {
        this.failureError = this.errorText(e)
      } finally {
        this.failureLoading = false
      }
    },
    searchFailures() {
      this.failurePage = 1
      this.loadFailures()
    },
    handleFailurePageChange(page) {
      this.failurePage = page
      this.loadFailures()
    },
    handleFailureSizeChange(size) {
      this.failurePageSize = size
      this.failurePage = 1
      this.loadFailures()
    },
    openFailuresTab() {
      this.activeTab = 'failures'
      this.searchFailures()
    },
    async openRunDrawer(runId) {
      if (!runId) return
      this.drawerRunId = runId
      this.drawerVisible = true
      this.drawerLoading = true
      this.drawerError = ''
      this.drawerData = null
      try {
        this.drawerData = await getLlmStatsByRun(runId)
      } catch (e) {
        this.drawerError = this.errorText(e)
      } finally {
        this.drawerLoading = false
      }
    },
    openHtmlTab(title) {
      const tab = window.open('', '_blank')
      if (!tab) {
        this.$message.warning('浏览器拦截了新窗口，请允许弹窗后重试')
        return null
      }

      tab.opener = null
      tab.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${title}</title></head><body style="margin:0;padding:16px;font-family:Arial,Helvetica,sans-serif;color:#334155;">报告加载中...</body></html>`)
      tab.document.close()
      return tab
    },
    writeHtmlTab(tab, html) {
      tab.document.open()
      tab.document.write(html)
      tab.document.close()
    },
    writeHtmlError(tab) {
      tab.document.open()
      tab.document.write('<!doctype html><html><head><meta charset="utf-8"><title>日志详情加载失败</title></head><body style="margin:0;padding:16px;font-family:Arial,Helvetica,sans-serif;color:#b91c1c;">报告加载失败，请稍后重试。</body></html>')
      tab.document.close()
    },
    async openLogByRun(runId) {
      if (!runId) return
      const tab = this.openHtmlTab('日志详情加载中')
      if (!tab) return

      try {
        const html = await getLogHtmlByRun(runId)
        this.writeHtmlTab(tab, html)
      } catch (e) {
        this.writeHtmlError(tab)
      }
    },

    formatLatency(value) {
      if (value === null || value === undefined || value === '') return '-'
      const ms = Number(value) || 0
      return ms >= 1000 ? (ms / 1000).toFixed(1) + 's' : `${ms}ms`
    },
    extraText(extra) {
      const data = extra || {}
      const parts = [data.alert_key, data.system_id, data.alert_source].filter(Boolean)
      return parts.length ? parts.join(' / ') : '-'
    },
    errorText(error) {
      const data = error && error.response && error.response.data
      return (data && (data.detail || data.msg || data.message)) || (error && error.message) || '加载失败'
    }
  }
}
</script>

<style scoped>
.agent-mgmt-page {
  min-height: calc(100vh - 84px);
  background: #f6f8fb;
}

.am-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 16px;
  margin-bottom: 12px;
  background: #fff;
  border: 1px solid #e4e8f0;
  border-radius: 6px;
}

.am-title {
  display: inline-block;
  margin-right: 10px;
  color: #17233d;
  font-size: 18px;
  font-weight: 700;
}

.am-sub {
  color: #6b778c;
  font-size: 13px;
}

.am-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.days-select {
  width: 112px;
}

.llm-tabs {
  padding: 0 16px 16px;
  background: #fff;
  border: 1px solid #e4e8f0;
  border-radius: 6px;
  min-height: calc(100vh - 210px);
}

.am-scroll {
  min-height: 360px;
  padding-top: 10px;
}

.scenario-scroll,
.failure-scroll {
  min-height: calc(100vh - 330px);
}

.stat-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(150px, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}

.stat-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  min-height: 84px;
  padding: 14px;
  background: #fbfcff;
  border: 1px solid #dfe6f2;
  border-radius: 6px;
  color: inherit;
  text-align: left;
}

.stat-card span {
  color: #6b778c;
  font-size: 13px;
}

.stat-card strong {
  margin-top: 10px;
  color: #17233d;
  font-size: 26px;
  line-height: 1;
}

.stat-card.clickable {
  cursor: pointer;
}

.stat-card.clickable:hover {
  border-color: #409eff;
}

.table-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 16px;
}

.section-title {
  margin: 8px 0 10px;
  color: #17233d;
  font-size: 14px;
  font-weight: 700;
}

.scenario-pagination,
.failure-pagination {
  display: flex;
  justify-content: flex-end;
  padding: 12px 0 0;
}

.filterbar {
  display: grid;
  grid-template-columns: 110px minmax(140px, 180px) minmax(170px, 1fr) minmax(180px, 240px) 76px;
  gap: 8px;
  align-items: center;
  padding: 12px 0;
}

.failure-filterbar {
  grid-template-columns: minmax(150px, 210px) minmax(120px, 150px) minmax(260px, 1fr) 76px;
}

.filter-small {
  width: 110px;
}

.run-input {
  min-width: 180px;
}

.drawer-body {
  padding: 0 16px 20px;
}

.drawer-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  padding: 10px 0 14px;
  color: #5f6b7a;
}

.drawer-summary span {
  padding: 6px 10px;
  background: #f6f8fb;
  border: 1px solid #e4e8f0;
  border-radius: 6px;
}

.latency-tip {
  margin-left: 3px;
  color: #909399;
  font-size: 12px;
  cursor: help;
}

.drawer-table {
  width: 100%;
}

.drawer-table ::v-deep .compact-column {
  padding-left: 0;
  padding-right: 0;
}

.drawer-table ::v-deep .compact-column .cell,
.drawer-table ::v-deep .error-column .cell {
  padding-left: 6px;
  padding-right: 6px;
}

.drawer-table ::v-deep th.compact-column .cell,
.drawer-table ::v-deep th.error-column .cell {
  white-space: nowrap;
}

.mono-link {
  font-family: Menlo, Monaco, Consolas, "Courier New", monospace;
}

.ok {
  color: #16a36b;
}

.warn {
  color: #d48806;
}

.danger {
  color: #d93026;
}

.error-text {
  margin: 10px 0;
  padding: 8px 10px;
  color: #b42318;
  background: #fff2f0;
  border: 1px solid #ffccc7;
  border-radius: 4px;
}

@media (max-width: 1200px) {
  .stat-grid,
  .table-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .filterbar {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 720px) {
  .am-topbar {
    align-items: flex-start;
    flex-direction: column;
  }

  .stat-grid,
  .table-grid,
  .filterbar {
    grid-template-columns: 1fr;
  }

  .am-actions,
  .days-select,
  .filter-small {
    width: 100%;
  }
}
</style>
