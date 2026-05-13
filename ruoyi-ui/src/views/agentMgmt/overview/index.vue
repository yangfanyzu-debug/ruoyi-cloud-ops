<template>
  <div class="app-container agent-mgmt-page">
    <div class="am-topbar">
      <div>
        <span class="am-title">运营首页</span>
        <span class="am-sub">各场景处理统计</span>
      </div>
      <el-button size="mini" icon="el-icon-refresh" @click="load">刷新</el-button>
    </div>

    <div v-loading="loading" class="am-scroll">
      <div v-if="stats.length" class="stat-grid">
        <div v-for="item in stats" :key="item.scenario_name" class="stat-card">
          <div class="stat-head">
            <span class="stat-name">{{ item.scenario_name }}</span>
            <strong>{{ item.total }}</strong>
          </div>
          <div class="group-title">系统分布</div>
          <div v-for="sys in item.by_system" :key="sys.system_id" class="bar-row">
            <span>{{ sys.system_id }}</span>
            <div class="track"><i :style="{ width: percent(sys.count, item.total) + '%' }" /></div>
            <em>{{ sys.count }}</em>
          </div>
          <div class="group-title">告警源分布</div>
          <div v-for="source in item.by_alert_source" :key="source.alert_source" class="bar-row green">
            <span>{{ source.alert_source }}</span>
            <div class="track"><i :style="{ width: percent(source.count, item.total) + '%' }" /></div>
            <em>{{ source.count }}</em>
          </div>
        </div>
      </div>
      <el-empty v-else description="暂无执行日志数据" />
    </div>
  </div>
</template>

<script>
import { listLogStats } from '@/api/agentMgmt'

export default {
  name: 'AgentMgmtOverview',
  data() {
    return { loading: false, stats: [] }
  },
  created() {
    this.load()
  },
  methods: {
    async load() {
      this.loading = true
      try {
        this.stats = await listLogStats()
      } finally {
        this.loading = false
      }
    },
    percent(count, total) {
      return total ? Math.round((count / total) * 100) : 0
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
.am-scroll {
  min-height: 260px;
  padding-top: 14px;
}
.stat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 10px;
}
.stat-card {
  padding: 14px;
  border: 1px solid var(--am-border);
  border-radius: 8px;
  background: var(--am-bg);
}
.stat-card:hover {
  border-color: var(--am-border2);
}
.stat-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--am-border);
}
.stat-name {
  font-family: Consolas, Monaco, monospace;
  font-size: 13px;
  font-weight: 600;
  word-break: break-all;
}
.stat-head strong {
  font-size: 18px;
  color: var(--am-primary);
}
.group-title {
  margin: 12px 0 8px;
  font-size: 11px;
  font-weight: 600;
  color: var(--am-text2);
}
.bar-row {
  display: grid;
  grid-template-columns: minmax(72px, 120px) 1fr 36px;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.bar-row span {
  font-size: 11px;
  color: var(--am-text2);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.bar-row em {
  font-style: normal;
  font-size: 11px;
  color: var(--am-text2);
  text-align: right;
}
.track {
  height: 7px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--am-bg2);
}
.track i {
  display: block;
  height: 100%;
  min-width: 2px;
  border-radius: inherit;
  background: var(--am-primary);
}
.bar-row.green .track i {
  background: #10b981;
}
@media (max-width: 768px) {
  .am-topbar {
    align-items: flex-start;
    flex-direction: column;
  }
  .stat-grid {
    grid-template-columns: 1fr;
  }
}
</style>
