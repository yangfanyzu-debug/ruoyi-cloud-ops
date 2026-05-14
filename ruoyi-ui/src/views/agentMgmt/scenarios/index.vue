<template>
  <div class="app-container agent-mgmt-page">
    <div class="am-topbar">
      <div>
        <span class="am-title">场景</span>
        <span class="am-sub">{{ rows.length }} 个场景</span>
      </div>
      <div class="am-actions">
        <el-button size="mini" icon="el-icon-refresh" @click="getList">刷新</el-button>
        <el-button size="mini" type="primary" icon="el-icon-plus" @click="openCreate">新增场景</el-button>
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
    </div>

    <div v-loading="loading" class="am-scroll">
      <div v-if="rows.length" class="scenario-list">
        <div v-for="row in rows" :key="row.id" class="scenario-card" :class="{ readonly: !row.can_edit }">
          <div class="scard-head">
            <div>
              <div class="scard-name">{{ row.scenario_name }}</div>
              <div class="scard-desc">{{ row.description || '暂无描述' }}</div>
            </div>
            <span class="status-badge" :class="'st-' + row.status">{{ statusText(row.status) }}</span>
          </div>
          <div class="scard-meta">
            Planner: <span>{{ related(row).planner || '-' }}</span>
            <em>·</em>
            Experts: <span>{{ expertNames(row) || '-' }}</span>
          </div>
          <div class="meta-strip">
            <span>{{ row.version || '-' }}</span>
            <span>创建人 {{ row.created_by_username || '-' }}</span>
            <span>更新于 {{ row.updated_at || '-' }}</span>
            <span v-if="!row.can_edit" class="readonly-mark">只读</span>
          </div>
          <div class="scard-foot">
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
      <el-empty v-else description="暂无场景，点击右上角新增" />
    </div>

    <el-dialog :visible.sync="dialogVisible" width="1180px" class="am-dialog wizard-dialog" :show-close="false">
      <div class="wizard-shell">
        <div class="wizard-topbar">
          <div>
            <span class="wizard-title">{{ dialogTitle }}</span>
            <span class="wizard-sub">{{ readonly ? '只读查看' : '配置场景并确认保存' }}</span>
          </div>
          <button class="ghost-close" @click="dialogVisible = false">关闭</button>
        </div>
        <div class="wizard-steps">
          <div class="step-dot" :class="{ cur: wizardStep === 0, done: wizardStep > 0 }">{{ wizardStep > 0 ? '✓' : '1' }}</div>
          <span class="step-label" :class="{ cur: wizardStep === 0 }">配置场景</span>
          <div class="step-line" :class="{ done: wizardStep > 0 }" />
          <div class="step-dot" :class="{ cur: wizardStep === 1 }">2</div>
          <span class="step-label" :class="{ cur: wizardStep === 1 }">确认保存</span>
        </div>
        <div class="wizard-split" :class="{ confirming: wizardStep === 1 }">
          <div v-show="wizardStep === 0" class="wizard-left">
            <div class="section-title">基本信息</div>
            <div class="fr">
              <label class="fl">场景名 <span class="fkey">key</span></label>
              <input v-model="form.scenario_name" type="text" :disabled="form.id || readonly" placeholder="alert_analysis">
              <div class="hint">仅英文字母、数字、下划线，以字母开头</div>
            </div>
            <div class="fr">
              <label class="fl">场景描述 <span class="fkey">description</span></label>
              <textarea v-model="form.description" :disabled="readonly" class="short" placeholder="描述这个场景处理什么告警" />
            </div>

            <div class="divider"></div>
            <div class="collapse-hd" @click="advOpen = !advOpen">
              <span class="collapse-arrow" :class="{ open: advOpen }">›</span>
              <span>Planner Skill 路由配置</span>
              <span class="fopt">（动态选择本次使用的 Planner Skill，可选）</span>
            </div>
            <div v-show="advOpen" class="collapse-body open">
              <div class="fr">
                <label class="fl">子类型字段提示 <span class="fkey">sub_type_hint</span></label>
                <input v-model="form.sub_type_hint" type="text" :disabled="readonly" placeholder="如 alertSource">
                <div class="hint">意图识别时从请求附带数据中提取该字段的值，作为 Skill 路由的子类型依据</div>
              </div>
              <div class="fr">
                <label class="fl">关键字字段提示 <span class="fkey">keyword_hint</span></label>
                <input v-model="form.keyword_hint" type="text" :disabled="readonly">
                <div class="hint">意图识别时额外提取一个关键字，与子类型组合后参与 Skill 路由匹配</div>
              </div>
              <div class="fr">
                <label class="fl">路由匹配维度 <span class="fkey">skill_selector_dims</span> <span class="fopt">回车添加</span></label>
                <div class="pill-wrap editable">
                  <span v-for="dim in form.skill_selector_dims" :key="dim" class="pill">
                    {{ dim }}<span v-if="!readonly" class="pill-x" @click.stop="removeDim(dim)">×</span>
                  </span>
                  <input v-if="!readonly" v-model="newDim" class="pill-input" placeholder="如 systemId、sub_type..." @keydown.enter.prevent="addDim">
                  <span v-if="readonly && !form.skill_selector_dims.length" class="pill muted">未设置</span>
                </div>
                <div class="hint">指定用哪些维度组合去匹配 Planner 的 dynamic_skill_map，从而决定本次请求使用哪个 Skill</div>
              </div>
            </div>
          </div>
          <div v-show="wizardStep === 0" class="wizard-middle">
            <div class="section-title">选择 Planner</div>
            <div class="pick-list">
              <div v-for="item in plannerAgents" :key="item.agent_name" class="pick-item" :class="{ sel: form.planner === item.agent_name }" @click="pickPlanner(item.agent_name)">
                <span class="pick-check" :class="{ on: form.planner === item.agent_name }">{{ form.planner === item.agent_name ? '✓' : '' }}</span>
                <span class="pick-name">{{ item.agent_name }}</span>
                <span class="pick-role">{{ contentSummary(item) }}</span>
              </div>
              <div v-if="!plannerAgents.length" class="pick-empty">暂无可选 Planner</div>
            </div>

            <div class="divider"></div>
            <div class="section-title">选择 Experts</div>
            <div class="pick-list">
              <div v-for="item in expertAgents" :key="item.agent_name" class="pick-item" :class="{ sel: isExpertPicked(item.agent_name) }" @click="toggleExpert(item.agent_name)">
                <span class="pick-check" :class="{ on: isExpertPicked(item.agent_name) }">{{ isExpertPicked(item.agent_name) ? '✓' : '' }}</span>
                <span class="pick-name">{{ item.agent_name }}</span>
                <span class="pick-role">{{ contentSummary(item) }}</span>
              </div>
              <div v-if="!expertAgents.length" class="pick-empty">暂无可选 Expert</div>
            </div>
          </div>
          <div v-show="wizardStep === 1" class="wizard-left confirm-left">
            <div class="section-title">确认场景信息</div>
            <div class="sum-grid">
              <div class="sum-cell wide">
                <div class="sum-lbl">场景名</div>
                <div class="sum-val mono">{{ form.scenario_name || '-' }}</div>
              </div>
              <div class="sum-cell wide">
                <div class="sum-lbl">描述</div>
                <div class="sum-val">{{ form.description || '-' }}</div>
              </div>
              <div class="sum-cell">
                <div class="sum-lbl">Planner</div>
                <div class="sum-val mono">{{ form.planner || '-' }}</div>
              </div>
              <div class="sum-cell">
                <div class="sum-lbl">Experts</div>
                <div class="sum-val">{{ form.experts.length }}</div>
              </div>
            </div>
            <div class="warn-box" v-if="!readonly">保存后会生成新的场景版本记录，激活状态需要在卡片上单独操作。</div>
          </div>
          <div class="wizard-right">
            <div class="preview-label">配置预览</div>
            <pre class="yaml-block">{{ scenarioPreview }}</pre>
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
  activateScenario,
  createScenario,
  deactivateScenario,
  deleteScenario,
  getScenario,
  listAgents,
  listScenarios,
  listScenarioVersions,
  rollbackScenario,
  updateScenario
} from '@/api/agentMgmt'

export default {
  name: 'AgentMgmtScenarios',
  data() {
    return {
      loading: false,
      rows: [],
      agents: [],
      query: { scope: 'mine', status: '' },
      statusFilters: [
        { label: '全部', value: '' },
        { label: '草稿', value: 'draft' },
        { label: '已激活', value: 'active' },
        { label: '已停用', value: 'inactive' }
      ],
      dialogVisible: false,
      readonly: false,
      wizardStep: 0,
      advOpen: false,
      newDim: '',
      form: this.emptyForm(),
      rules: {
        scenario_name: [{ required: true, message: '请输入场景名称', trigger: 'blur' }],
        planner: [{ required: true, message: '请选择 Planner', trigger: 'change' }]
      },
      versionVisible: false,
      versions: [],
      versionTarget: null
    }
  },
  computed: {
    plannerAgents() {
      return this.agents.filter(item => item.type === 'planner')
    },
    expertAgents() {
      return this.agents.filter(item => item.type === 'expert')
    },
    dialogTitle() {
      if (this.readonly) return '查看场景'
      return this.form.id ? '编辑场景' : '新增场景'
    },
    scenarioPreview() {
      return [
        `scenario_name: ${this.form.scenario_name || '(未填)'}`,
        `description: ${this.form.description || ''}`,
        `sub_type_hint: ${this.form.sub_type_hint || ''}`,
        `keyword_hint: ${this.form.keyword_hint || ''}`,
        'skill_selector_dims:',
        ...(this.form.skill_selector_dims.length ? this.form.skill_selector_dims.map(item => `  - ${item}`) : ['  []']),
        'related_agents:',
        `  planner: ${this.form.planner || '(未选择)'}`,
        '  experts:',
        ...(this.form.experts.length ? this.form.experts.map(name => `    - name: ${name}`) : ['    []'])
      ].join('\n')
    }
  },
  created() {
    this.getList()
    this.loadAgents()
  },
  methods: {
    emptyForm() {
      return { scenario_name: '', description: '', sub_type_hint: '', keyword_hint: '', skill_selector_dims: [], planner: '', experts: [] }
    },
    setFilter(key, value) {
      this.query[key] = value
      this.getList()
    },
    statusText(status) {
      return ({ draft: '草稿', active: '已激活', inactive: '已停用' })[status] || status
    },
    parseJson(text, fallback) {
      try {
        return text ? JSON.parse(text) : fallback
      } catch (e) {
        return fallback
      }
    },
    related(row) {
      return this.parseJson(row.related_agents, { planner: '', experts: [] })
    },
    expertNames(row) {
      const experts = this.related(row).experts || []
      return experts.filter(item => item.enabled !== false).map(item => item.name).join(', ')
    },
    summarizeText(text) {
      if (!text) return ''
      const line = String(text).split('\n').map(item => item.trim()).find(Boolean)
      return line ? line.slice(0, 42) : ''
    },
    contentSummary(row) {
      return this.summarizeText(row.content || row.description || row.tags) || '-'
    },
    isExpertPicked(name) {
      return this.form.experts.includes(name)
    },
    pickPlanner(name) {
      if (this.readonly) return
      this.form.planner = name
      this.form.experts = this.form.experts.filter(item => item !== name)
    },
    toggleExpert(name) {
      if (this.readonly || name === this.form.planner) return
      if (this.isExpertPicked(name)) this.form.experts = this.form.experts.filter(item => item !== name)
      else this.form.experts.push(name)
    },
    addDim() {
      const value = this.newDim.trim()
      if (!value || this.form.skill_selector_dims.includes(value)) return
      this.form.skill_selector_dims.push(value)
      this.newDim = ''
    },
    removeDim(dim) {
      this.form.skill_selector_dims = this.form.skill_selector_dims.filter(item => item !== dim)
    },
    async loadAgents() {
      this.agents = await listAgents({ scope: 'all' })
    },
    async getList() {
      this.loading = true
      try {
        this.rows = await listScenarios(this.query)
      } finally {
        this.loading = false
      }
    },
    openCreate() {
      this.readonly = false
      this.wizardStep = 0
      this.advOpen = false
      this.newDim = ''
      this.form = this.emptyForm()
      this.dialogVisible = true
    },
    async openEdit(row, readonly) {
      const data = await getScenario(row.id)
      const related = this.parseJson(data.related_agents, { planner: '', experts: [] })
      this.readonly = readonly || !data.can_edit
      this.wizardStep = 0
      this.advOpen = Boolean(data.sub_type_hint || data.keyword_hint || data.skill_selector_dims)
      this.newDim = ''
      this.form = {
        ...data,
        skill_selector_dims: this.parseJson(data.skill_selector_dims, []),
        planner: related.planner || '',
        experts: (related.experts || []).filter(item => item.enabled !== false).map(item => item.name)
      }
      this.dialogVisible = true
    },
    nextStep() {
      if (this.validateScenarioForm()) this.wizardStep = 1
    },
    validateScenarioForm() {
      if (!this.form.scenario_name) {
        this.$message.warning('请输入场景名称')
        return false
      }
      if (!this.form.planner) {
        this.$message.warning('请选择 Planner')
        return false
      }
      return true
    },
    buildPayload() {
      return {
        scenario_name: this.form.scenario_name,
        description: this.form.description,
        sub_type_hint: this.form.sub_type_hint,
        keyword_hint: this.form.keyword_hint,
        skill_selector_dims: this.form.skill_selector_dims,
        related_agents: {
          planner: this.form.planner,
          experts: this.form.experts.map(name => ({ name, enabled: true }))
        }
      }
    },
    submit() {
      if (!this.validateScenarioForm()) return
      this.saveScenario()
    },
    async saveScenario() {
      const payload = this.buildPayload()
      if (this.form.id) await updateScenario(this.form.id, payload)
      else await createScenario(payload)
      this.dialogVisible = false
      this.getList()
    },
    async activate(row) {
      await activateScenario(row.id)
      this.getList()
    },
    async deactivate(row) {
      await deactivateScenario(row.id)
      this.getList()
    },
    handleMore(command, row) {
      if (command === 'versions') this.openVersions(row)
      if (command === 'delete') this.remove(row)
    },
    async remove(row) {
      await this.$confirm(`确认删除 ${row.scenario_name}？`, '提示', { type: 'warning' })
      await deleteScenario(row.id)
      this.getList()
    },
    async openVersions(row) {
      this.versionTarget = row
      this.versions = await listScenarioVersions(row.id)
      this.versionVisible = true
    },
    async rollback(version) {
      await this.$confirm(`确认回滚到 ${version.version}？`, '提示', { type: 'warning' })
      await rollbackScenario(this.versionTarget.id, version.id)
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
.scenario-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
  gap: 10px;
}
.scenario-card {
  background: var(--am-bg);
  border: 1px solid var(--am-border);
  border-radius: 8px;
  padding: 14px;
  transition: border-color .15s, box-shadow .15s;
}
.scenario-card:hover {
  border-color: var(--am-border2);
  box-shadow: 0 8px 20px rgba(15, 23, 42, .04);
}
.scenario-card.readonly {
  background: #fbfdff;
}
.scard-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
}
.scard-name {
  font-family: Consolas, Monaco, monospace;
  font-size: 13px;
  font-weight: 600;
  word-break: break-all;
}
.scard-desc {
  margin-top: 5px;
  min-height: 18px;
  font-size: 11px;
  color: var(--am-text2);
  line-height: 1.5;
  word-break: break-word;
}
.scard-meta {
  margin-bottom: 8px;
  font-size: 11px;
  color: var(--am-text2);
  line-height: 1.6;
}
.scard-meta span {
  font-family: Consolas, Monaco, monospace;
  font-weight: 500;
  color: var(--am-text);
}
.scard-meta em {
  margin: 0 6px;
  color: #cbd5e1;
  font-style: normal;
}
.status-badge {
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
.meta-strip {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 10px;
}
.meta-strip span {
  font-size: 10px;
  color: var(--am-text2);
  background: var(--am-bg2);
  border-radius: 8px;
  padding: 3px 7px;
}
.meta-strip .readonly-mark {
  color: #475569;
  background: #f1f5f9;
}
.scard-foot {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding-top: 10px;
  border-top: 1px solid var(--am-border);
}
.split-editor {
  display: grid;
  grid-template-columns: minmax(260px, 360px) minmax(0, 1fr);
  gap: 18px;
}
.section-title {
  margin-bottom: 12px;
  font-size: 11px;
  font-weight: 600;
  color: var(--am-text2);
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
.pill-wrap {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 10px;
}
.pill {
  display: inline-flex;
  align-items: center;
  padding: 2px 7px;
  border-radius: 8px;
  font-size: 10px;
  color: var(--am-primary-text);
  background: var(--am-primary-bg);
}
.pill.muted {
  color: var(--am-text2);
  background: #f1f5f9;
}
.wizard-dialog ::v-deep .el-dialog {
  max-width: calc(100vw - 48px);
  margin-top: 6vh !important;
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
  height: 80vh;
  min-height: 640px;
  max-height: 840px;
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
  grid-template-columns: minmax(300px, 340px) minmax(320px, 360px) minmax(0, 1fr);
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
}
.wizard-split.confirming {
  grid-template-columns: minmax(360px, 420px) minmax(0, 1fr);
}
.wizard-left,
.wizard-middle {
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
.pill.green {
  color: #047857;
  background: #ecfdf5;
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
  line-height: 1.45;
}
.divider {
  height: 1px;
  margin: 14px 0;
  background: var(--am-border);
}
.wizard-left input,
.wizard-left textarea,
.pill-input {
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
.wizard-left textarea:focus,
.pill-input:focus {
  border-color: var(--am-primary);
}
.wizard-left textarea {
  min-height: 74px;
  resize: vertical;
  font-size: 12px;
  line-height: 1.55;
}
.wizard-left textarea.short {
  min-height: 72px;
}
.collapse-hd {
  clear: both;
  display: grid;
  grid-template-columns: 16px minmax(0, 1fr);
  align-items: start;
  gap: 2px 6px;
  padding: 8px 0;
  color: var(--am-text2);
  cursor: pointer;
  font-size: 11px;
  font-weight: 500;
  user-select: none;
}
.collapse-hd:hover {
  color: var(--am-text);
}
.collapse-arrow {
  grid-row: 1 / span 2;
  font-size: 14px;
  line-height: 1;
  transition: transform .2s;
}
.collapse-hd .fopt {
  grid-column: 2;
  line-height: 1.4;
}
.collapse-arrow.open {
  transform: rotate(90deg);
}
.collapse-body {
  padding-top: 4px;
}
.pill-wrap.editable {
  min-height: 34px;
  padding: 5px 7px;
  border: 1px solid var(--am-border2);
  border-radius: 6px;
  background: var(--am-bg);
  cursor: text;
}
.pill-x {
  margin-left: 3px;
  cursor: pointer;
  font-size: 11px;
  line-height: 1;
  opacity: .6;
}
.pill-x:hover {
  opacity: 1;
}
.pill-input {
  flex: 1;
  min-width: 80px;
  padding: 1px 2px;
  border: 0;
  background: transparent;
  font-size: 11px;
}
.pick-list {
  max-height: 210px;
  overflow-y: auto;
  border: 1px solid var(--am-border2);
  border-radius: 8px;
}
.pick-item {
  display: grid;
  grid-template-columns: 18px minmax(0, 1fr);
  align-items: center;
  gap: 5px 7px;
  padding: 7px 9px;
  border-bottom: 1px solid var(--am-border);
  cursor: pointer;
  font-size: 12px;
}
.pick-item:last-child {
  border-bottom: 0;
}
.pick-item:hover {
  background: var(--am-bg2);
}
.pick-item.sel {
  background: var(--am-primary-bg);
}
.pick-check {
  width: 14px;
  height: 14px;
  border: 1.5px solid var(--am-border2);
  border-radius: 3px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 9px;
}
.pick-check.on {
  border-color: var(--am-primary);
  background: var(--am-primary);
  color: #fff;
}
.pick-name {
  font-family: Consolas, Monaco, monospace;
  font-size: 12px;
}
.pick-role {
  grid-column: 2;
  min-width: 0;
  color: var(--am-text2);
  font-size: 10px;
  line-height: 1.35;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}
.pick-empty {
  padding: 9px 12px;
  color: #94a3b8;
  font-size: 11px;
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
  .scenario-list,
  .split-editor {
    grid-template-columns: 1fr;
  }
  .wizard-split,
  .wizard-split.confirming {
    grid-template-columns: 1fr;
    overflow-y: auto;
  }
  .wizard-left,
  .wizard-middle {
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
