<template>
  <div class="app-container agent-mgmt-page">
    <div class="am-topbar">
      <div>
        <span class="am-title">执行日志</span>
        <span class="am-sub">{{ total }} 条记录</span>
      </div>
      <el-button size="mini" icon="el-icon-refresh" @click="getList">刷新</el-button>
    </div>

    <div class="log-filterbar">
      <label>
        <span>场景</span>
        <el-select
          v-model="query.scenario_name"
          size="mini"
          clearable
          filterable
          :loading="scenarioLoading"
          placeholder="请选择场景"
          @change="search"
        >
          <el-option
            v-for="scenario in scenarioOptions"
            :key="scenario.id || scenario.scenario_name"
            :label="scenario.scenario_name"
            :value="scenario.scenario_name"
          />
        </el-select>
      </label>
      <label>
        <span>系统</span>
        <el-input v-model="query.system_id" size="mini" clearable placeholder="systemId" @keyup.enter.native="search" />
      </label>
      <label>
        <span>告警</span>
        <el-input v-model="query.alert_key" size="mini" clearable placeholder="alertKey" @keyup.enter.native="search" />
      </label>
      <div class="filter-actions">
        <el-button size="mini" type="primary" icon="el-icon-search" @click="search">查询</el-button>
        <el-button size="mini" icon="el-icon-refresh-left" @click="reset">重置</el-button>
      </div>
    </div>

    <div v-loading="loading" class="am-scroll">
      <el-table v-if="rows.length" :data="rows" size="mini" border class="log-table">
        <el-table-column prop="created_at" label="时间" width="160" />
        <el-table-column prop="scenario_name" label="场景" min-width="130" show-overflow-tooltip />
        <el-table-column prop="log_name" label="日志名称" min-width="180" show-overflow-tooltip>
          <template slot-scope="{ row }">{{ row.log_name || '未命名日志' }}</template>
        </el-table-column>
        <el-table-column label="系统" width="120">
          <template slot-scope="{ row }">{{ extra(row).system_id || '-' }}</template>
        </el-table-column>
        <el-table-column label="告警" width="130">
          <template slot-scope="{ row }">{{ extra(row).alert_key || '-' }}</template>
        </el-table-column>
        <el-table-column prop="run_id" label="run_id" width="190" show-overflow-tooltip>
          <template slot-scope="{ row }">
            <el-button v-if="row.run_id" type="text" class="mono-link" @click="openHtmlByRun(row.run_id)">{{ row.run_id }}</el-button>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column prop="remark" label="备注" min-width="120" show-overflow-tooltip />
        <el-table-column label="操作" width="96" fixed="right">
          <template slot-scope="{ row }">
            <el-button size="mini" type="text" @click="openHtml(row)">查看详情</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-else description="暂无执行日志数据" />
    </div>

    <pagination
      v-show="total > 0"
      :total="total"
      :page.sync="query.page"
      :limit.sync="query.page_size"
      @pagination="getList"
    />
  </div>
</template>

<script>
import { getLogHtml, getLogHtmlByRun, listLogs, listScenarios } from '@/api/agentMgmt'

export default {
  name: 'AgentMgmtLogs',
  data() {
    return {
      loading: false,
      scenarioLoading: false,
      scenarioOptions: [],
      rows: [],
      total: 0,
      query: { page: 1, page_size: 20, scenario_name: '', system_id: '', alert_key: '' }
    }
  },
  created() {
    this.loadScenarioOptions()
    this.getList()
  },
  methods: {
    async loadScenarioOptions() {
      this.scenarioLoading = true
      try {
        const data = await listScenarios({ scope: 'all' })
        this.scenarioOptions = Array.isArray(data) ? data : []
      } finally {
        this.scenarioLoading = false
      }
    },
    async getList() {
      this.loading = true
      try {
        const data = await listLogs(this.query)
        this.rows = data.items
        this.total = data.total
      } finally {
        this.loading = false
      }
    },
    search() {
      this.query.page = 1
      this.getList()
    },
    reset() {
      this.query = { page: 1, page_size: 20, scenario_name: '', system_id: '', alert_key: '' }
      this.getList()
    },
    extra(row) {
      try {
        if (!row.extra_data) return {}
        return typeof row.extra_data === 'string' ? JSON.parse(row.extra_data) : row.extra_data
      } catch (e) {
        return {}
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
    async openHtml(row) {
      const tab = this.openHtmlTab('日志详情加载中')
      if (!tab) return

      try {
        const html = await getLogHtml(row.id)
        this.writeHtmlTab(tab, html)
      } catch (e) {
        this.writeHtmlError(tab)
      }
    },
    async openHtmlByRun(runId) {
      if (!runId) return
      const tab = this.openHtmlTab('日志详情加载中')
      if (!tab) return

      try {
        const html = await getLogHtmlByRun(runId)
        this.writeHtmlTab(tab, html)
      } catch (e) {
        this.writeHtmlError(tab)
      }
    }
  }
}
</script>

<style scoped>
.agent-mgmt-page {
  --am-bg: #fff;
  --am-bg2: #f8fafc;
  --am-border: #e5e7eb;
  --am-border2: #cbd5e1;
  --am-text: #1f2937;
  --am-text2: #64748b;
  --am-primary: #2563eb;
  color: var(--am-text);
}
.am-topbar {
  min-height: 48px;
  padding: 10px 0 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border-bottom: 1px solid var(--am-border);
}
.am-title {
  font-size: 15px;
  font-weight: 600;
}
.am-sub {
  margin-left: 8px;
  font-size: 11px;
  color: var(--am-text2);
}
.log-filterbar {
  display: flex;
  align-items: flex-end;
  flex-wrap: wrap;
  gap: 10px;
  padding: 12px 0;
  border-bottom: 1px solid var(--am-border);
}
.log-filterbar label {
  width: 180px;
}
.log-filterbar span {
  display: block;
  margin-bottom: 5px;
  font-size: 11px;
  color: var(--am-text2);
}
.log-filterbar .el-select {
  display: block;
  width: 100%;
}
.filter-actions {
  display: flex;
  gap: 6px;
}
.am-scroll {
  min-height: 260px;
  padding-top: 14px;
}
.log-table {
  width: 100%;
}
.mono-link {
  font-family: Consolas, Monaco, monospace;
}
@media (max-width: 768px) {
  .am-topbar {
    align-items: flex-start;
    flex-direction: column;
  }
  .log-filterbar label {
    width: 100%;
  }
}
</style>
