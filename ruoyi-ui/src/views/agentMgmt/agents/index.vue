<template>
  <div class="app-container agent-mgmt-page">
    <div class="am-topbar">
      <div>
        <span class="am-title">Agents</span>
        <span class="am-sub">{{ rows.length }} 个 Agent</span>
      </div>
      <div class="am-actions">
        <el-button size="mini" icon="el-icon-refresh" @click="getList">刷新</el-button>
        <el-button size="mini" type="primary" icon="el-icon-plus" @click="openCreate">新增 Agent</el-button>
      </div>
    </div>

    <div class="am-filterbar">
      <span class="filter-label">范围：</span>
      <button class="filter-btn" :class="{ active: query.scope === 'mine' }" @click="setFilter('scope', 'mine')">我的</button>
      <button class="filter-btn" :class="{ active: query.scope === 'all' }" @click="setFilter('scope', 'all')">所有</button>
      <span class="filter-label">状态：</span>
      <button v-for="item in statusFilters" :key="item.value" class="filter-btn" :class="{ active: query.status === item.value }" @click="setFilter('status', item.value)">
        {{ item.label }}
      </button>
      <span class="filter-label">类型：</span>
      <button v-for="item in typeFilters" :key="item.value" class="filter-btn" :class="{ active: query.type === item.value }" @click="setFilter('type', item.value)">
        {{ item.label }}
      </button>
    </div>

    <div v-loading="loading" class="am-scroll">
      <div v-if="rows.length" class="agent-card-grid">
        <div v-for="row in rows" :key="row.id" class="agent-card" :class="{ readonly: !row.can_edit }">
          <div class="card-head">
            <div>
              <div class="card-name">{{ row.agent_name }}</div>
              <div class="card-role">{{ contentSummary(row) }}</div>
            </div>
            <span class="status-badge" :class="'st-' + row.status">{{ statusText(row.status) }}</span>
          </div>
          <div class="badge-row">
            <span class="badge" :class="row.type === 'planner' ? 'bp' : 'bs'">{{ typeText(row.type) }}</span>
            <span v-if="!row.can_edit" class="badge ro">只读</span>
            <span v-for="tag in tagList(row.tags)" :key="tag" class="badge tag">{{ tag }}</span>
          </div>
          <div class="meta-grid">
            <div>
              <span>版本</span>
              <strong>{{ row.version || '-' }}</strong>
            </div>
            <div>
              <span>创建人</span>
              <strong>{{ row.created_by_username || '-' }}</strong>
            </div>
            <div class="wide">
              <span>更新</span>
              <strong>{{ row.updated_at || '-' }}</strong>
            </div>
          </div>
          <div class="card-foot">
            <el-button size="mini" @click="openEdit(row, true)">查看</el-button>
            <el-button size="mini" type="primary" :disabled="!row.can_edit" @click="openEdit(row, false)">编辑</el-button>
            <el-button v-if="row.status !== 'active'" size="mini" type="success" :disabled="!row.can_edit" @click="activate(row)">激活</el-button>
            <el-button v-else size="mini" :disabled="!row.can_edit" @click="deactivate(row)">停用</el-button>
            <el-dropdown trigger="click" @command="cmd => handleMore(cmd, row)">
              <el-button size="mini">更多<i class="el-icon-arrow-down el-icon--right" /></el-button>
              <el-dropdown-menu slot="dropdown">
                <el-dropdown-item command="versions">历史版本</el-dropdown-item>
                <el-dropdown-item command="delete" :disabled="!row.can_edit || row.status === 'active'">删除</el-dropdown-item>
              </el-dropdown-menu>
            </el-dropdown>
          </div>
        </div>
      </div>
      <el-empty v-else description="暂无 Agent，点击右上角新增" />
    </div>

    <el-dialog :visible.sync="dialogVisible" width="1080px" class="am-dialog wizard-dialog" :show-close="false">
      <div class="wizard-shell">
        <div class="wizard-topbar">
          <div>
            <span class="wizard-title">{{ dialogTitle }}</span>
            <span class="wizard-sub">{{ readonly ? '只读查看' : '填写配置并确认保存' }}</span>
          </div>
          <button class="ghost-close" @click="dialogVisible = false">关闭</button>
        </div>
        <div class="wizard-steps">
          <div class="step-dot" :class="{ cur: wizardStep === 0, done: wizardStep > 0 }">{{ wizardStep > 0 ? '✓' : '1' }}</div>
          <span class="step-label" :class="{ cur: wizardStep === 0 }">填写配置</span>
          <div class="step-line" :class="{ done: wizardStep > 0 }" />
          <div class="step-dot" :class="{ cur: wizardStep === 1 }">2</div>
          <span class="step-label" :class="{ cur: wizardStep === 1 }">确认保存</span>
        </div>
        <div class="wizard-split">
          <div v-show="wizardStep === 0" class="wizard-left">
            <div class="section-title">基本信息</div>
            <div class="type-row">
              <button type="button" class="type-btn" :class="{ active: form.type === 'expert' }" :disabled="form.id || readonly" @click="form.type = 'expert'">
                <span class="type-icon">EX</span>
                Expert
                <small>执行专家</small>
              </button>
              <button type="button" class="type-btn" :class="{ active: form.type === 'planner' }" :disabled="form.id || readonly" @click="form.type = 'planner'">
                <span class="type-icon">PL</span>
                Planner
                <small>规划调度</small>
              </button>
            </div>
            <div class="fr">
              <label class="fl">名称 <span class="fkey">name</span></label>
              <input v-model="form.agent_name" type="text" :disabled="form.id || readonly" placeholder="es_expert_agent">
              <div class="hint">全局唯一，保存后名称不可修改</div>
            </div>
            <div class="fr">
              <label class="fl">标签 <span class="fkey">tags</span> <span class="fopt">逗号分隔</span></label>
              <input v-model="form.tags" type="text" :disabled="readonly" placeholder="ops, es, alert">
            </div>
            <div class="divider"></div>
            <div class="fr">
              <label class="fl">YAML 内容 <span class="fkey">content</span></label>
              <textarea v-model="form.content" :disabled="readonly" placeholder="粘贴或编辑 agent YAML..." />
              <div class="hint">保持与原页面一致：左侧编辑，右侧实时预览即将保存的 YAML</div>
            </div>
          </div>
          <div v-show="wizardStep === 1" class="wizard-left">
            <div class="section-title">确认信息</div>
            <div class="sum-grid">
              <div class="sum-cell">
                <div class="sum-lbl">类型</div>
                <div class="sum-val">{{ typeText(form.type) }}</div>
              </div>
              <div class="sum-cell">
                <div class="sum-lbl">标签</div>
                <div class="sum-val">{{ form.tags || '-' }}</div>
              </div>
              <div class="sum-cell wide">
                <div class="sum-lbl">名称</div>
                <div class="sum-val mono">{{ form.agent_name || '-' }}</div>
              </div>
            </div>
            <div class="warn-box" v-if="!readonly">保存后会生成新的版本记录，激活状态需要在卡片上单独操作。</div>
          </div>
          <div class="wizard-right">
            <div class="preview-label">YAML 预览</div>
            <pre class="yaml-block">{{ form.content || '# 暂无 YAML 内容' }}</pre>
          </div>
        </div>
        <div class="wizard-foot">
          <button class="wiz-btn" @click="dialogVisible = false">{{ readonly ? '关闭' : '取消' }}</button>
          <button v-if="wizardStep === 1" class="wiz-btn" @click="wizardStep = 0">上一步</button>
          <button v-if="wizardStep === 0" class="wiz-btn pri" @click="nextStep">{{ readonly ? '查看确认' : '下一步' }}</button>
          <button v-if="wizardStep === 1 && !readonly" class="wiz-btn pri" @click="submit">保存</button>
        </div>
      </div>
    </el-dialog>

    <el-dialog title="历史版本" :visible.sync="versionVisible" width="680px" class="am-dialog">
      <div class="version-list">
        <div v-for="version in versions" :key="version.id" class="version-card">
          <div>
            <div class="version-title">{{ version.version }}</div>
            <div class="version-meta">{{ version.created_by_username || '-' }} · {{ version.created_at || '-' }}</div>
          </div>
          <el-button size="mini" type="text" :disabled="!versionTarget || !versionTarget.can_edit" @click="rollback(version)">回滚</el-button>
        </div>
        <el-empty v-if="!versions.length" description="暂无历史版本" />
      </div>
    </el-dialog>
  </div>
</template>

<script>
import {
  activateAgent,
  createAgent,
  deactivateAgent,
  deleteAgent,
  getAgent,
  listAgents,
  listAgentVersions,
  rollbackAgent,
  updateAgent
} from '@/api/agentMgmt'

export default {
  name: 'AgentMgmtAgents',
  data() {
    return {
      loading: false,
      rows: [],
      query: { scope: 'mine', status: '', type: '' },
      statusFilters: [
        { label: '全部', value: '' },
        { label: '草稿', value: 'draft' },
        { label: '已激活', value: 'active' },
        { label: '已停用', value: 'inactive' }
      ],
      typeFilters: [
        { label: '全部', value: '' },
        { label: 'Planner', value: 'planner' },
        { label: 'Expert', value: 'expert' }
      ],
      dialogVisible: false,
      readonly: false,
      wizardStep: 0,
      form: { agent_name: '', type: 'expert', tags: '', content: '' },
      rules: {
        agent_name: [{ required: true, message: '请输入名称', trigger: 'blur' }],
        type: [{ required: true, message: '请选择类型', trigger: 'change' }],
        content: [{ required: true, message: '请输入 YAML', trigger: 'blur' }]
      },
      versionVisible: false,
      versions: [],
      versionTarget: null
    }
  },
  computed: {
    dialogTitle() {
      if (this.readonly) return '查看 Agent'
      return this.form.id ? '编辑 Agent' : '新增 Agent'
    },
    previewSummary() {
      return this.summarizeText(this.form.content)
    }
  },
  created() {
    this.getList()
  },
  methods: {
    setFilter(key, value) {
      this.query[key] = value
      this.getList()
    },
    statusText(status) {
      return ({ draft: '草稿', active: '已激活', inactive: '已停用' })[status] || status
    },
    typeText(type) {
      return type === 'planner' ? 'Planner' : 'Expert'
    },
    tagList(tags) {
      if (!tags) return []
      return String(tags).split(',').map(item => item.trim()).filter(Boolean).slice(0, 4)
    },
    summarizeText(text) {
      if (!text) return '暂无配置内容'
      const line = String(text).split('\n').map(item => item.trim()).find(Boolean)
      return line ? line.slice(0, 90) : '暂无配置内容'
    },
    contentSummary(row) {
      return this.summarizeText(row.content || row.description || row.tags)
    },
    async getList() {
      this.loading = true
      try {
        this.rows = await listAgents(this.query)
      } finally {
        this.loading = false
      }
    },
    openCreate() {
      this.readonly = false
      this.wizardStep = 0
      this.form = { agent_name: '', type: 'expert', tags: '', content: '' }
      this.dialogVisible = true
    },
    async openEdit(row, readonly) {
      this.readonly = readonly || !row.can_edit
      this.wizardStep = 0
      this.form = await getAgent(row.id)
      this.dialogVisible = true
    },
    nextStep() {
      if (this.validateAgentForm()) this.wizardStep = 1
    },
    validateAgentForm() {
      if (!this.form.agent_name) {
        this.$message.warning('请输入 Agent 名称')
        return false
      }
      if (!this.form.content) {
        this.$message.warning('请输入 YAML 内容')
        return false
      }
      return true
    },
    submit() {
      if (this.validateAgentForm()) this.saveAgent()
    },
    async saveAgent() {
      if (this.form.id) await updateAgent(this.form.id, { content: this.form.content, tags: this.form.tags })
      else await createAgent(this.form)
      this.dialogVisible = false
      this.getList()
    },
    async activate(row) {
      await activateAgent(row.id)
      this.getList()
    },
    async deactivate(row) {
      await deactivateAgent(row.id)
      this.getList()
    },
    handleMore(command, row) {
      if (command === 'versions') this.openVersions(row)
      if (command === 'delete') this.remove(row)
    },
    async remove(row) {
      await this.$confirm(`确认删除 ${row.agent_name}？`, '提示', { type: 'warning' })
      await deleteAgent(row.id)
      this.getList()
    },
    async openVersions(row) {
      this.versionTarget = row
      this.versions = await listAgentVersions(row.id)
      this.versionVisible = true
    },
    async rollback(version) {
      await this.$confirm(`确认回滚到 ${version.version}？`, '提示', { type: 'warning' })
      await rollbackAgent(this.versionTarget.id, version.id)
      this.versionVisible = false
      this.getList()
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
  --am-primary-bg: #eff6ff;
  --am-primary-text: #1d4ed8;
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
.am-actions {
  display: flex;
  gap: 6px;
}
.am-filterbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  padding: 12px 0;
  border-bottom: 1px solid var(--am-border);
}
.filter-label {
  margin-left: 6px;
  font-size: 11px;
  color: var(--am-text2);
}
.filter-label:first-child {
  margin-left: 0;
}
.filter-btn {
  padding: 4px 10px;
  font-size: 11px;
  border: 1px solid var(--am-border);
  border-radius: 20px;
  cursor: pointer;
  background: var(--am-bg);
  color: var(--am-text2);
  transition: all .15s;
}
.filter-btn:hover {
  border-color: var(--am-border2);
}
.filter-btn.active {
  background: var(--am-primary-bg);
  border-color: var(--am-primary);
  color: var(--am-primary-text);
  font-weight: 500;
}
.am-scroll {
  min-height: 260px;
  padding-top: 14px;
}
.agent-card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(330px, 1fr));
  gap: 12px;
}
.agent-card {
  background: var(--am-bg);
  border: 1px solid var(--am-border);
  border-radius: 8px;
  padding: 11px 12px 10px;
  transition: border-color .15s, box-shadow .15s;
}
.agent-card:hover {
  border-color: var(--am-border2);
  box-shadow: 0 8px 20px rgba(15, 23, 42, .04);
}
.agent-card.readonly {
  background: #fbfdff;
}
.card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 6px;
}
.card-name {
  font-family: Consolas, Monaco, monospace;
  font-size: 13px;
  font-weight: 600;
  color: var(--am-text);
  line-height: 1.35;
  word-break: break-word;
}
.card-role {
  margin-top: 3px;
  font-size: 11px;
  color: var(--am-text2);
  line-height: 1.4;
  word-break: break-word;
  display: -webkit-box;
  overflow: hidden;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}
.status-badge,
.badge {
  display: inline-flex;
  align-items: center;
  font-size: 10px;
  padding: 2px 7px;
  border-radius: 8px;
  font-weight: 500;
  white-space: nowrap;
}
.st-active {
  color: #047857;
  background: #ecfdf5;
}
.st-inactive {
  color: #64748b;
  background: #f1f5f9;
}
.st-draft {
  color: #b45309;
  background: #fffbeb;
}
.badge-row {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 8px;
}
.bp {
  color: var(--am-primary-text);
  background: var(--am-primary-bg);
}
.bs {
  color: #047857;
  background: #ecfdf5;
}
.ro {
  color: #475569;
  background: #f1f5f9;
}
.tag {
  color: #7c3aed;
  background: #f5f3ff;
}
.meta-grid {
  display: grid;
  grid-template-columns: .8fr 1fr 1.6fr;
  gap: 0;
  margin-bottom: 8px;
  border: 1px solid var(--am-border);
  border-radius: 6px;
  background: var(--am-bg2);
  overflow: hidden;
}
.meta-grid div {
  padding: 6px 8px;
  min-width: 0;
  border-left: 1px solid var(--am-border);
}
.meta-grid div:first-child {
  border-left: 0;
}
.meta-grid .wide {
  grid-column: auto;
}
.meta-grid span {
  display: block;
  margin-bottom: 2px;
  font-size: 10px;
  color: var(--am-text2);
}
.meta-grid strong {
  display: block;
  font-size: 11px;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.card-foot {
  display: flex;
  align-items: center;
  flex-wrap: nowrap;
  gap: 5px;
  padding-top: 8px;
  border-top: 1px solid var(--am-border);
  overflow-x: auto;
  scrollbar-width: none;
}
.card-foot::-webkit-scrollbar {
  display: none;
}
.card-foot .el-button {
  flex: 0 0 auto;
  padding: 6px 9px;
  margin-left: 0;
  white-space: nowrap;
}
.card-foot .el-dropdown {
  flex: 0 0 auto;
}
.card-foot .el-icon--right {
  margin-left: 3px;
}
.split-editor {
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr);
  gap: 18px;
}
.preview-card {
  margin-top: 12px;
  padding: 12px;
  border: 1px solid var(--am-border);
  border-radius: 8px;
  background: var(--am-bg2);
}
.preview-label {
  margin-bottom: 5px;
  font-size: 10px;
  color: var(--am-text2);
}
.preview-name {
  margin-bottom: 5px;
  font-family: Consolas, Monaco, monospace;
  font-size: 12px;
  font-weight: 600;
}
.preview-text {
  font-size: 11px;
  color: var(--am-text2);
  line-height: 1.45;
  word-break: break-word;
}
.agent-mgmt-page ::v-deep .el-textarea__inner {
  font-family: Consolas, Monaco, monospace;
  font-size: 12px;
}
.wizard-dialog ::v-deep .el-dialog {
  max-width: calc(100vw - 48px);
  margin-top: 7vh !important;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 18px 48px rgba(15, 23, 42, .18);
}
.wizard-dialog ::v-deep .el-dialog__header,
.wizard-dialog ::v-deep .el-dialog__footer {
  display: none;
}
.wizard-dialog ::v-deep .el-dialog__body {
  padding: 0;
}
.wizard-shell {
  display: flex;
  flex-direction: column;
  height: 78vh;
  min-height: 620px;
  max-height: 820px;
  background: var(--am-bg);
}
.wizard-topbar {
  flex: 0 0 auto;
  min-height: 52px;
  padding: 11px 18px;
  border-bottom: 1px solid var(--am-border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.wizard-title {
  display: block;
  font-size: 15px;
  font-weight: 600;
  line-height: 1.35;
}
.wizard-sub {
  display: block;
  margin-top: 2px;
  margin-left: 0;
  font-size: 11px;
  color: var(--am-text2);
}
.ghost-close {
  padding: 5px 12px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: var(--am-text2);
  cursor: pointer;
  font-size: 12px;
}
.ghost-close:hover {
  color: var(--am-text);
  background: var(--am-bg2);
}
.wizard-steps {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  padding: 10px 18px;
  border-bottom: 1px solid var(--am-border);
  background: var(--am-bg);
}
.step-dot {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 1.5px solid var(--am-border2);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  color: var(--am-text2);
  flex-shrink: 0;
}
.step-dot.cur {
  border-color: var(--am-primary);
  color: var(--am-primary);
}
.step-dot.done {
  border-color: var(--am-primary);
  background: var(--am-primary);
  color: #fff;
}
.step-line {
  flex: 1;
  height: 1px;
  margin: 0 4px;
  background: var(--am-border);
}
.step-line.done {
  background: var(--am-primary);
}
.step-label {
  padding: 0 6px;
  font-size: 11px;
  color: var(--am-text2);
  white-space: nowrap;
}
.step-label.cur {
  color: var(--am-primary-text);
  font-weight: 500;
}
.wizard-split {
  display: grid;
  grid-template-columns: minmax(340px, 400px) minmax(0, 1fr);
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
}
.wizard-left {
  padding: 16px 18px;
  border-right: 1px solid var(--am-border);
  overflow-y: auto;
  background: #fff;
}
.wizard-right {
  padding: 16px 18px;
  background: var(--am-bg2);
  overflow: auto;
}
.wizard-foot {
  flex: 0 0 auto;
  padding: 10px 18px;
  border-top: 1px solid var(--am-border);
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  background: var(--am-bg);
}
.type-row {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}
.type-btn {
  flex: 1;
  min-height: 64px;
  padding: 8px 10px;
  border: 1px solid var(--am-border2);
  border-radius: 6px;
  background: var(--am-bg);
  color: var(--am-text2);
  cursor: pointer;
  font-size: 12px;
  text-align: center;
  transition: all .15s;
}
.type-btn:hover {
  border-color: var(--am-primary);
  color: var(--am-primary-text);
}
.type-btn.active {
  border-color: var(--am-primary);
  background: var(--am-primary-bg);
  color: var(--am-primary-text);
}
.type-btn:disabled {
  cursor: not-allowed;
  opacity: .75;
}
.type-icon {
  display: block;
  margin: 0 auto 4px;
  height: 20px;
  line-height: 20px;
  font-family: Consolas, Monaco, monospace;
  font-size: 16px;
}
.type-btn small {
  display: block;
  margin-top: 2px;
  font-size: 10px;
  color: var(--am-text2);
}
.yaml-block {
  height: calc(100% - 20px);
  min-height: 0;
  margin: 0;
  padding: 12px 14px;
  border: 1px solid var(--am-border);
  border-radius: 8px;
  background: var(--am-bg);
  color: var(--am-text);
  font-family: Consolas, Monaco, monospace;
  font-size: 11px;
  line-height: 1.85;
  white-space: pre;
  overflow-x: auto;
}
.fr {
  float: none !important;
  clear: both;
  display: block;
  width: 100%;
  box-sizing: border-box;
  margin-bottom: 12px;
}
.fr:last-child {
  margin-bottom: 0;
}
label.fl {
  float: none !important;
  clear: both;
  display: block;
  margin-bottom: 4px;
  color: var(--am-text2);
  font-size: 11px;
  font-weight: 500;
}
.fkey {
  margin-left: 3px;
  color: #94a3b8;
  font-family: Consolas, Monaco, monospace;
  font-size: 10px;
  font-weight: 400;
}
.fopt,
.hint {
  color: #94a3b8;
  font-size: 10px;
}
.hint {
  margin-top: 3px;
}
.divider {
  height: 1px;
  margin: 14px 0;
  background: var(--am-border);
}
.wizard-left input,
.wizard-left textarea {
  display: block;
  clear: both;
  width: 100%;
  padding: 8px 10px;
  border: 1px solid var(--am-border2);
  border-radius: 6px;
  outline: none;
  background: var(--am-bg);
  color: var(--am-text);
  font-family: inherit;
  font-size: 12px;
  transition: border-color .15s;
  box-sizing: border-box;
}
.wizard-left input:focus,
.wizard-left textarea:focus {
  border-color: var(--am-primary);
}
.wizard-left textarea {
  min-height: 260px;
  resize: vertical;
  font-family: Consolas, Monaco, monospace;
  font-size: 11px;
  line-height: 1.65;
}
.wiz-btn {
  padding: 5px 12px;
  border: 1px solid var(--am-border2);
  border-radius: 6px;
  background: var(--am-bg);
  color: var(--am-text);
  cursor: pointer;
  font-size: 12px;
  transition: all .15s;
}
.wiz-btn:hover {
  background: var(--am-bg2);
}
.wiz-btn.pri {
  border-color: var(--am-primary);
  background: var(--am-primary);
  color: #fff;
}
.wiz-btn.pri:hover {
  background: #1d4ed8;
}
.sum-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.sum-cell {
  padding: 9px 11px;
  border-radius: 6px;
  background: var(--am-bg2);
}
.sum-cell.wide {
  grid-column: 1 / -1;
}
.sum-lbl {
  margin-bottom: 3px;
  font-size: 10px;
  color: var(--am-text2);
}
.sum-val {
  font-size: 12px;
  font-weight: 500;
  word-break: break-word;
}
.mono {
  font-family: Consolas, Monaco, monospace;
}
.warn-box {
  margin-top: 12px;
  padding: 9px 11px;
  border: 1px solid #fde68a;
  border-radius: 6px;
  background: #fffbeb;
  color: #92400e;
  font-size: 11px;
  line-height: 1.5;
}
.version-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.version-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border: 1px solid var(--am-border);
  border-radius: 8px;
}
.version-title {
  font-family: Consolas, Monaco, monospace;
  font-size: 12px;
  font-weight: 600;
}
.version-meta {
  margin-top: 4px;
  font-size: 11px;
  color: var(--am-text2);
}
@media (max-width: 768px) {
  .wizard-dialog ::v-deep .el-dialog {
    max-width: calc(100vw - 24px);
    margin-top: 4vh !important;
  }
  .wizard-shell {
    height: auto;
    min-height: 0;
    max-height: 90vh;
  }
  .am-topbar {
    align-items: flex-start;
    flex-direction: column;
  }
  .split-editor {
    grid-template-columns: 1fr;
  }
  .wizard-split {
    grid-template-columns: 1fr;
    overflow-y: auto;
  }
  .wizard-left {
    border-right: 0;
    border-bottom: 1px solid var(--am-border);
  }
  .wizard-right {
    min-height: 260px;
  }
  .yaml-block {
    min-height: 240px;
  }
}
</style>
