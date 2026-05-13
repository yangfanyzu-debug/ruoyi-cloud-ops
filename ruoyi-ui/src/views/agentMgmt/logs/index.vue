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
        <el-input v-model="query.scenario_name" size="mini" clearable placeholder="场景名" @keyup.enter.native="search" />
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
      <div v-if="rows.length" class="log-list">
        <div v-for="row in rows" :key="row.id" class="log-card">
          <div class="log-main">
            <div class="log-head">
              <span class="log-scenario">{{ row.scenario_name || '-' }}</span>
              <span class="log-id">#{{ row.id }}</span>
            </div>
            <div class="log-name">{{ row.log_name || '未命名日志' }}</div>
            <div class="log-meta">
              <span>系统 <strong>{{ extra(row).system_id || '-' }}</strong></span>
              <span>告警 <strong>{{ extra(row).alert_key || '-' }}</strong></span>
              <span>{{ row.created_at || '-' }}</span>
            </div>
          </div>
          <el-button size="mini" @click="openHtml(row)">查看详情</el-button>
        </div>
      </div>
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
import { listLogs, logHtmlUrl } from '@/api/agentMgmt'

export default {
  name: 'AgentMgmtLogs',
  data() {
    return {
      loading: false,
      rows: [],
      total: 0,
      query: { page: 1, page_size: 20, scenario_name: '', system_id: '', alert_key: '' }
    }
  },
  created() {
    this.getList()
  },
  methods: {
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
        return row.extra_data ? JSON.parse(row.extra_data) : {}
      } catch (e) {
        return {}
      }
    },
    openHtml(row) {
      window.open(logHtmlUrl(row.id), '_blank')
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
.filter-actions {
  display: flex;
  gap: 6px;
}
.am-scroll {
  min-height: 260px;
  padding-top: 14px;
}
.log-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.log-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 12px 14px;
  border: 1px solid var(--am-border);
  border-radius: 8px;
  background: var(--am-bg);
  transition: border-color .15s, box-shadow .15s;
}
.log-card:hover {
  border-color: var(--am-border2);
  box-shadow: 0 8px 20px rgba(15, 23, 42, .04);
}
.log-main {
  min-width: 0;
}
.log-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 5px;
}
.log-scenario {
  font-family: Consolas, Monaco, monospace;
  font-size: 13px;
  font-weight: 600;
  color: var(--am-text);
}
.log-id {
  padding: 2px 7px;
  border-radius: 8px;
  font-size: 10px;
  color: #475569;
  background: #f1f5f9;
}
.log-name {
  margin-bottom: 7px;
  font-size: 12px;
  color: var(--am-text2);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.log-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.log-meta span {
  padding: 3px 7px;
  border-radius: 8px;
  background: var(--am-bg2);
  font-size: 10px;
  color: var(--am-text2);
}
.log-meta strong {
  font-family: Consolas, Monaco, monospace;
  font-weight: 500;
  color: var(--am-text);
}
@media (max-width: 768px) {
  .am-topbar,
  .log-card {
    align-items: flex-start;
    flex-direction: column;
  }
  .log-filterbar label {
    width: 100%;
  }
}
</style>
