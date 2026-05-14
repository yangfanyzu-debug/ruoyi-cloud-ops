<template>
  <div class="app-container agent-mgmt-page">
    <div class="am-topbar">
      <div>
        <span class="am-title">场景</span>
        <span class="am-sub">{{ rows.length }} 个场景</span>
      </div>
      <div class="am-actions">
        <el-button size="mini" icon="el-icon-refresh" @click="refreshAll">刷新</el-button>
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
            <span>更新 {{ row.updated_at || '-' }}</span>
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

    <el-dialog :visible.sync="dialogVisible" width="1180px" class="am-dialog wizard-dialog scenario-wizard-dialog" :show-close="false" top="4vh">
      <div class="wizard-shell">
        <div class="wizard-topbar">
          <div>
            <span class="wizard-title">{{ dialogTitle }}</span>
            <span class="wizard-sub">{{ readonly ? '只读查看' : '配置场景、选择 Planner 和 Expert，并确认保存' }}</span>
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
              <input v-model.trim="form.scenario_name" type="text" :disabled="form.id || readonly" placeholder="alert_analysis" @blur="checkScenarioNameLive">
              <div class="hint">仅英文字母、数字、下划线，以字母开头</div>
              <div class="field-feedback" :class="nameStatus">{{ nameMessage }}</div>
            </div>
            <div class="fr">
              <label class="fl">场景描述 <span class="fkey">description</span></label>
              <textarea v-model="form.description" :disabled="readonly" class="short" rows="2" placeholder="告警根因分析多智能体" />
              <div class="hint">简洁描述该场景适用的业务范围，用于识别和区分不同场景</div>
            </div>

            <div class="divider"></div>
            <div class="section-title">选择 Agents</div>
            <div class="hint agent-select-hint">激活前所有 Agent 必须已关联可用的 Skill；可以先保存场景，之后补充 Skill 再激活。</div>

            <div class="fr">
              <div class="pick-title-row">
                <label class="fl">规划 Agent <span class="fkey">planner</span></label>
                <button v-if="!readonly" type="button" class="mini-action" @click="openAgentDrawer('planner')">+ 新建 Planner</button>
              </div>
              <div class="hint">接收任务指令，按需调度下方 Expert，汇总输出最终结论；每个场景只选一个。</div>
              <div class="pick-list">
                <div
                  v-for="item in plannerAgents"
                  :key="item.agent_name"
                  class="pick-item"
                  :class="{ sel: form.planner === item.agent_name }"
                  @click="pickPlanner(item.agent_name)"
                >
                  <span class="badge bp">Planner</span>
                  <span class="pick-name">{{ item.agent_name }}</span>
                  <span class="pick-role">{{ agentRole(item) }}</span>
                </div>
                <div v-if="!plannerAgents.length" class="pick-empty">暂无 Planner Agent，点击右侧新建</div>
              </div>
            </div>

            <div class="fr">
              <div class="pick-title-row">
                <label class="fl">Expert Agents <span class="fkey">experts</span> <span class="fopt">可多选</span></label>
                <button v-if="!readonly" type="button" class="mini-action" @click="openAgentDrawer('expert')">+ 新建 Expert</button>
              </div>
              <div class="hint">执行具体分析任务的专家，Planner 根据实际情况选择性调用，可配置多个。</div>
              <div class="pick-list">
                <div
                  v-for="item in selectableExperts"
                  :key="item.agent_name"
                  class="pick-item"
                  :class="{ sel: isExpertPicked(item.agent_name) }"
                  @click="toggleExpert(item.agent_name)"
                >
                  <span class="pick-check" :class="{ on: isExpertPicked(item.agent_name) }">{{ isExpertPicked(item.agent_name) ? '✓' : '' }}</span>
                  <span class="pick-name">{{ item.agent_name }}</span>
                  <span class="pick-role">{{ agentRole(item) }}</span>
                </div>
                <div v-if="!selectableExperts.length" class="pick-empty">暂无 Expert Agent，点击右侧新建</div>
              </div>
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
          <button v-if="wizardStep === 1 && !readonly" class="wiz-btn pri" @click="submit">{{ form.id ? '保存修改' : '确认新增' }}</button>
        </div>
      </div>
    </el-dialog>

    <div v-if="drawerVisible" class="drawer-overlay" @click="closeAgentDrawer" />
    <div v-if="drawerVisible" class="agent-drawer">
      <div class="drawer-head">
        <span>{{ drawerTitle }}</span>
        <button type="button" class="ghost-close" @click="closeAgentDrawer">关闭</button>
      </div>
      <div class="drawer-body">
        <div class="fr">
          <label class="fl">Agent 名称 <span class="fkey">name</span></label>
          <input v-model.trim="drawerForm.agent_name" type="text" :placeholder="drawerForm.type === 'planner' ? 'my_planner' : 'my_expert_agent'" @input="syncDrawerName" @blur="checkDrawerNameLive">
          <div class="hint">仅英文字母、数字、下划线，以字母开头</div>
          <div class="field-feedback" :class="drawerNameStatus">{{ drawerNameMessage }}</div>
        </div>

        <div class="fr">
          <div class="pick-title-row">
            <label class="fl">Agent 配置 <span class="fkey">YAML</span></label>
            <button type="button" class="mini-action" @click="resetDrawerTemplate">重置模板</button>
          </div>
          <div class="warn-box compact">
            模板已预填基础结构，可直接修改 role、goal、backstory。Skills 可在下方关联，也可后续在 Agent 编辑页补充。
          </div>
          <div class="field-doc">
            <div><code>role</code><span>角色身份，注入到 LLM 系统提示词。</span></div>
            <div><code>goal</code><span>{{ drawerForm.type === 'planner' ? '规划任务目标和预期输出。' : '专家职责和返回给 Planner 的结论。' }}</span></div>
            <div><code>backstory</code><span>补充约束规则或领域背景。</span></div>
            <div><code>skills</code><span>关联后会自动写入 YAML。</span></div>
          </div>
          <textarea v-model="drawerForm.content" class="drawer-yaml" rows="10" />
        </div>

        <div class="divider"></div>
        <div class="section-title">关联 Skills</div>
        <div class="pill-wrap editable" @click="focusDrawerSkillInput">
          <span v-for="skill in drawerForm.skills" :key="skill" class="pill">
            {{ skill }}<span class="pill-x" @click.stop="removeDrawerSkill(skill)">×</span>
          </span>
          <input ref="drawerSkillInput" v-model.trim="drawerSkillInput" class="pill-input" placeholder="输入 skill 名回车添加..." @keydown.enter.prevent="addDrawerSkill">
        </div>
        <div class="hint">如果不确定 skill 名，可保存后在 Agent 编辑中关联。</div>
      </div>
      <div class="drawer-foot">
        <button type="button" class="wiz-btn" @click="closeAgentDrawer">取消</button>
        <button type="button" class="wiz-btn pri" @click="saveAgentFromDrawer">保存</button>
      </div>
    </div>

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
  checkAgentName,
  checkScenarioName,
  createAgent,
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

const NAME_RE = /^[a-zA-Z][a-zA-Z0-9_]*$/

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
      nameStatus: '',
      nameMessage: '',
      form: this.emptyForm(),
      drawerVisible: false,
      drawerForm: this.emptyDrawerForm('expert'),
      drawerSkillInput: '',
      drawerNameStatus: '',
      drawerNameMessage: '',
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
    selectableExperts() {
      return this.expertAgents.filter(item => item.agent_name !== this.form.planner)
    },
    dialogTitle() {
      if (this.readonly) return '查看场景'
      return this.form.id ? '编辑场景' : '新增场景'
    },
    drawerTitle() {
      return this.drawerForm.type === 'planner' ? '新建 Planner Agent' : '新建 Expert Agent'
    },
    scenarioPreview() {
      const experts = this.form.experts.map(name => `${name}.yaml`)
      return [
        'scenarios:',
        `  ${this.form.scenario_name || '(场景名)'}:`,
        `    description: ${this.form.description || '(未填)'}`,
        `    planner: ${this.form.planner ? `${this.form.planner}.yaml` : '(步骤中选择)'}`,
        `    experts: [${experts.length ? experts.join(', ') : '(步骤中选择)'}]`
      ].join('\n')
    }
  },
  created() {
    this.refreshAll()
  },
  methods: {
    emptyForm() {
      return {
        id: null,
        scenario_name: '',
        description: '',
        sub_type_hint: '',
        keyword_hint: '',
        skill_selector_dims: [],
        planner: '',
        experts: []
      }
    },
    emptyDrawerForm(type) {
      return { type, agent_name: '', content: this.agentTemplate(type), skills: [] }
    },
    setFilter(key, value) {
      this.query[key] = value
      this.getList()
    },
    refreshAll() {
      this.getList()
      this.loadAgents()
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
    parseYamlField(content, key) {
      const match = String(content || '').match(new RegExp(`^${key}:\\s*(.+)$`, 'm'))
      return match ? match[1].trim() : ''
    },
    agentRole(agent) {
      return this.parseYamlField(agent.content, 'role') || this.summarizeText(agent.content || agent.tags) || '-'
    },
    summarizeText(text) {
      if (!text) return ''
      const line = String(text).split('\n').map(item => item.trim()).find(Boolean)
      return line ? line.slice(0, 48) : ''
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
      this.nameStatus = ''
      this.nameMessage = ''
      this.form = this.emptyForm()
      this.dialogVisible = true
    },
    async openEdit(row, readonly) {
      const data = await getScenario(row.id)
      const related = this.parseJson(data.related_agents, { planner: '', experts: [] })
      this.readonly = readonly || !data.can_edit
      this.wizardStep = 0
      this.nameStatus = ''
      this.nameMessage = ''
      this.form = {
        ...this.emptyForm(),
        ...data,
        skill_selector_dims: this.parseJson(data.skill_selector_dims, []),
        planner: related.planner || '',
        experts: (related.experts || []).filter(item => item.enabled !== false).map(item => item.name)
      }
      this.dialogVisible = true
    },
    async checkScenarioNameLive() {
      if (this.form.id || !this.form.scenario_name) return
      if (!NAME_RE.test(this.form.scenario_name)) {
        this.nameStatus = 'err'
        this.nameMessage = '格式不正确'
        return
      }
      try {
        const result = await checkScenarioName(this.form.scenario_name)
        this.nameStatus = result.available ? 'ok' : 'err'
        this.nameMessage = result.available ? '名称可用' : result.message
      } catch (e) {
        this.nameStatus = ''
        this.nameMessage = ''
      }
    },
    nextStep() {
      if (this.validateScenarioForm()) this.wizardStep = 1
    },
    validateScenarioForm() {
      if (!this.form.scenario_name) {
        this.$message.warning('请填写场景名')
        return false
      }
      if (!NAME_RE.test(this.form.scenario_name)) {
        this.$message.warning('场景名格式不正确')
        return false
      }
      if (!this.form.description) {
        this.$message.warning('请填写场景描述')
        return false
      }
      if (!this.form.planner) {
        this.$message.warning('请选择规划 Agent')
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
    openAgentDrawer(type) {
      this.drawerForm = this.emptyDrawerForm(type)
      this.drawerSkillInput = ''
      this.drawerNameStatus = ''
      this.drawerNameMessage = ''
      this.drawerVisible = true
    },
    closeAgentDrawer() {
      this.drawerVisible = false
    },
    agentTemplate(type) {
      if (type === 'planner') {
        return [
          'name: ',
          'role: 规划专家',
          'goal: |',
          '  协调专家团队进行系统性分析，委派相应专家并汇总结论，输出完整报告。',
          'backstory: |',
          '  【数据传递约束】',
          '  - 未出现对应异常类型时，严禁调用对应专家',
          'skills: []',
          ''
        ].join('\n')
      }
      return [
        'name: ',
        'role: 专家',
        'goal: >',
        '  负责分析指定领域的问题，提供详细的诊断结果和修复建议。',
        'backstory: >',
        '  你是一位领域专家，擅长快速定位问题根因，提供准确的技术分析。',
        'skills: []',
        ''
      ].join('\n')
    },
    syncDrawerName() {
      this.drawerForm.content = this.drawerForm.content.replace(/^name:.*$/m, `name: ${this.drawerForm.agent_name}`)
    },
    resetDrawerTemplate() {
      const name = this.drawerForm.agent_name
      this.drawerForm.content = this.agentTemplate(this.drawerForm.type).replace(/^name:.*$/m, `name: ${name}`)
      this.injectDrawerSkills()
    },
    focusDrawerSkillInput() {
      if (this.$refs.drawerSkillInput) this.$refs.drawerSkillInput.focus()
    },
    addDrawerSkill() {
      const value = this.drawerSkillInput.trim()
      if (!value || this.drawerForm.skills.includes(value)) return
      this.drawerForm.skills.push(value)
      this.drawerSkillInput = ''
      this.injectDrawerSkills()
    },
    removeDrawerSkill(skill) {
      this.drawerForm.skills = this.drawerForm.skills.filter(item => item !== skill)
      this.injectDrawerSkills()
    },
    injectDrawerSkills() {
      const lines = this.drawerForm.content.split('\n')
      const out = []
      let inSkills = false
      let injected = false
      lines.forEach(line => {
        if (/^skills:/.test(line)) {
          injected = true
          inSkills = true
          if (this.drawerForm.skills.length) {
            out.push('skills:')
            this.drawerForm.skills.forEach(skill => out.push(`  - ${skill}`))
          } else {
            out.push('skills: []')
          }
          return
        }
        if (inSkills && /^\s/.test(line)) return
        inSkills = false
        out.push(line)
      })
      if (!injected) {
        if (this.drawerForm.skills.length) {
          out.push('skills:')
          this.drawerForm.skills.forEach(skill => out.push(`  - ${skill}`))
        } else {
          out.push('skills: []')
        }
      }
      this.drawerForm.content = out.join('\n')
    },
    async checkDrawerNameLive() {
      if (!this.drawerForm.agent_name) return
      if (!NAME_RE.test(this.drawerForm.agent_name)) {
        this.drawerNameStatus = 'err'
        this.drawerNameMessage = '格式不正确'
        return
      }
      try {
        const result = await checkAgentName(this.drawerForm.agent_name)
        this.drawerNameStatus = result.available ? 'ok' : 'err'
        this.drawerNameMessage = result.available ? '名称可用' : result.message
      } catch (e) {
        this.drawerNameStatus = ''
        this.drawerNameMessage = ''
      }
    },
    async saveAgentFromDrawer() {
      if (!this.drawerForm.agent_name) {
        this.$message.warning('请填写 Agent 名称')
        return
      }
      if (!NAME_RE.test(this.drawerForm.agent_name)) {
        this.$message.warning('Agent 名称格式不正确')
        return
      }
      const result = await checkAgentName(this.drawerForm.agent_name).catch(() => ({ available: true }))
      if (!result.available) {
        this.$message.warning(result.message || 'Agent 名称已存在')
        return
      }
      await createAgent({
        agent_name: this.drawerForm.agent_name,
        type: this.drawerForm.type,
        content: this.drawerForm.content,
        tags: '自定义'
      })
      await this.loadAgents()
      if (this.drawerForm.type === 'planner') this.pickPlanner(this.drawerForm.agent_name)
      else if (!this.form.experts.includes(this.drawerForm.agent_name)) this.form.experts.push(this.drawerForm.agent_name)
      this.closeAgentDrawer()
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
  --am-bg3: #f1f5f9;
  --am-border: #e5e7eb;
  --am-border2: #cbd5e1;
  --am-text: #1f2937;
  --am-text2: #64748b;
  --am-text3: #94a3b8;
  --am-primary: #2563eb;
  --am-primary-bg: #eff6ff;
  --am-primary-text: #1d4ed8;
  --am-green: #16a34a;
  --am-red: #dc2626;
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
.am-title { font-size: 15px; font-weight: 600; }
.am-sub { margin-left: 8px; font-size: 11px; color: var(--am-text2); }
.am-actions { display: flex; gap: 6px; }
.am-filterbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 7px;
  padding: 12px 0;
  border-bottom: 1px solid var(--am-border);
}
.filter-label { margin-left: 6px; font-size: 11px; color: var(--am-text2); }
.filter-label:first-child { margin-left: 0; }
.filter-btn {
  height: 26px;
  padding: 0 10px;
  border: 1px solid var(--am-border);
  border-radius: 6px;
  background: #fff;
  color: var(--am-text2);
  font-size: 11px;
  cursor: pointer;
}
.filter-btn.active {
  border-color: var(--am-primary);
  background: var(--am-primary-bg);
  color: var(--am-primary-text);
}
.am-scroll { min-height: 360px; padding-top: 14px; }
.scenario-list { display: flex; flex-direction: column; gap: 10px; }
.scenario-card {
  padding: 14px;
  border: 1px solid var(--am-border);
  border-radius: 8px;
  background: var(--am-bg);
  transition: border-color .15s, box-shadow .15s;
}
.scenario-card:hover { border-color: var(--am-border2); box-shadow: 0 8px 20px rgba(15, 23, 42, .04); }
.scenario-card.readonly { background: #fbfdff; }
.scard-head { display: flex; justify-content: space-between; gap: 12px; margin-bottom: 8px; }
.scard-name { font-family: Consolas, Monaco, monospace; font-size: 14px; font-weight: 600; }
.scard-desc { margin-top: 4px; color: var(--am-text2); font-size: 12px; line-height: 1.45; }
.scard-meta { margin-bottom: 8px; font-size: 11px; color: var(--am-text2); }
.scard-meta span { color: var(--am-text); font-family: Consolas, Monaco, monospace; }
.scard-meta em { margin: 0 8px; color: var(--am-border2); font-style: normal; }
.meta-strip { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; color: var(--am-text2); font-size: 10px; }
.readonly-mark { color: #7c2d12; }
.scard-foot { display: flex; align-items: center; gap: 6px; flex-wrap: nowrap; }
.scard-foot .el-button { margin-left: 0; }
.status-badge, .badge {
  display: inline-flex;
  align-items: center;
  height: 20px;
  padding: 0 7px;
  border-radius: 6px;
  font-size: 10px;
  white-space: nowrap;
}
.st-draft { color: #6b7280; background: #f3f4f6; }
.st-active { color: #047857; background: #ecfdf5; }
.st-inactive { color: #9f1239; background: #fff1f2; }
.badge.bp { color: var(--am-primary-text); background: var(--am-primary-bg); }
::v-deep .wizard-dialog .el-dialog {
  margin-bottom: 0;
  border-radius: 8px;
  overflow: hidden;
}
::v-deep .wizard-dialog .el-dialog__header,
::v-deep .wizard-dialog .el-dialog__body {
  padding: 0;
}
.wizard-shell {
  height: min(760px, 90vh);
  display: flex;
  flex-direction: column;
  background: #fff;
}
.wizard-topbar {
  flex: 0 0 auto;
  padding: 18px 20px 14px;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  border-bottom: 1px solid var(--am-border);
}
.wizard-title { display: block; font-size: 15px; font-weight: 600; }
.wizard-sub { display: block; margin-top: 5px; font-size: 11px; color: var(--am-text2); }
.ghost-close {
  border: 0;
  background: transparent;
  color: #475569;
  font-size: 12px;
  cursor: pointer;
}
.wizard-steps {
  flex: 0 0 auto;
  height: 44px;
  padding: 0 18px;
  display: flex;
  align-items: center;
  border-bottom: 1px solid var(--am-border);
}
.step-dot {
  width: 22px;
  height: 22px;
  border: 1px solid var(--am-border2);
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  color: var(--am-text2);
  background: #fff;
}
.step-dot.cur, .step-dot.done { border-color: var(--am-primary); color: var(--am-primary); }
.step-label { margin: 0 10px 0 7px; font-size: 11px; color: var(--am-text2); }
.step-label.cur { color: var(--am-primary-text); font-weight: 600; }
.step-line { flex: 1; height: 1px; background: var(--am-border); }
.step-line.done { background: var(--am-primary); }
.wizard-split {
  flex: 1 1 auto;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(430px, 500px) minmax(0, 1fr);
}
.wizard-left {
  min-width: 0;
  padding: 18px;
  overflow-y: auto;
  border-right: 1px solid var(--am-border);
}
.wizard-right {
  min-width: 0;
  padding: 18px 20px;
  overflow: auto;
  background: var(--am-bg2);
}
.wizard-foot {
  flex: 0 0 auto;
  padding: 12px 18px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  border-top: 1px solid var(--am-border);
}
.wiz-btn {
  min-width: 72px;
  height: 30px;
  border: 1px solid var(--am-border2);
  border-radius: 6px;
  background: #fff;
  color: var(--am-text);
  font-size: 12px;
  cursor: pointer;
}
.wiz-btn.pri { border-color: var(--am-primary); background: var(--am-primary); color: #fff; }
.section-title { margin-bottom: 10px; font-size: 12px; font-weight: 600; color: #334155; }
.fr {
  float: none !important;
  clear: both;
  display: block;
  width: 100%;
  box-sizing: border-box;
  margin-bottom: 14px;
}
label.fl {
  float: none !important;
  clear: both;
  display: block;
  width: 100%;
  margin: 0 0 5px;
  font-size: 11px;
  font-weight: 500;
  color: #475569;
}
.fkey { margin-left: 3px; font-family: Consolas, Monaco, monospace; font-size: 10px; color: #64748b; }
.fopt { font-size: 10px; color: #94a3b8; }
.fr input,
.fr textarea {
  display: block;
  width: 100%;
  box-sizing: border-box;
  border: 1px solid #cbd5e1;
  border-radius: 7px;
  padding: 8px 9px;
  color: #1f2937;
  font-size: 12px;
  outline: none;
  background: #fff;
}
.fr textarea { resize: vertical; line-height: 1.55; }
.fr textarea.short { min-height: 64px; }
.fr input:focus, .fr textarea:focus {
  border-color: var(--am-primary);
  box-shadow: 0 0 0 2px rgba(37, 99, 235, .08);
}
.hint { margin-top: 5px; font-size: 10px; line-height: 1.5; color: var(--am-text2); }
.field-feedback { min-height: 16px; margin-top: 4px; font-size: 10px; }
.field-feedback.ok { color: var(--am-green); }
.field-feedback.err { color: var(--am-red); }
.divider { height: 1px; margin: 16px 0; background: var(--am-border); }
.agent-select-hint { margin-bottom: 12px; }
.pick-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 4px;
}
.pick-title-row label.fl { margin-bottom: 0; }
.mini-action {
  height: 24px;
  padding: 0 8px;
  border: 1px solid var(--am-border2);
  border-radius: 6px;
  background: #fff;
  color: var(--am-primary-text);
  font-size: 11px;
  cursor: pointer;
  white-space: nowrap;
}
.pick-list {
  margin-top: 8px;
  border: 1px solid var(--am-border2);
  border-radius: 7px;
  overflow: hidden;
}
.pick-item {
  min-height: 42px;
  padding: 8px 10px;
  display: flex;
  align-items: center;
  gap: 8px;
  border-bottom: 1px solid var(--am-border);
  background: #fff;
  cursor: pointer;
}
.pick-item:last-child { border-bottom: 0; }
.pick-item:hover { background: #f8fbff; }
.pick-item.sel { background: var(--am-primary-bg); }
.pick-check {
  width: 16px;
  height: 16px;
  border: 1px solid #cbd5e1;
  border-radius: 4px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--am-primary);
  font-size: 11px;
  flex: 0 0 auto;
}
.pick-check.on { border-color: var(--am-primary); background: #fff; }
.pick-name { font-family: Consolas, Monaco, monospace; font-size: 12px; color: var(--am-text); }
.pick-role {
  min-width: 0;
  color: var(--am-text2);
  font-size: 11px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pick-empty { padding: 10px 12px; color: var(--am-text3); font-size: 11px; }
.preview-label { margin-bottom: 8px; font-size: 11px; font-weight: 600; color: #475569; }
.yaml-block {
  min-height: 100%;
  margin: 0;
  padding: 14px;
  border: 1px solid #dbe3ef;
  border-radius: 8px;
  background: #fff;
  color: #0f172a;
  font-family: Consolas, Monaco, monospace;
  font-size: 12px;
  line-height: 1.75;
  white-space: pre-wrap;
}
.sum-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 9px; }
.sum-cell { padding: 10px 11px; border-radius: 7px; background: var(--am-bg2); }
.sum-cell.wide { grid-column: 1 / -1; }
.sum-lbl { margin-bottom: 5px; font-size: 10px; color: var(--am-text2); }
.sum-val { font-size: 12px; font-weight: 500; line-height: 1.5; color: var(--am-text); }
.sum-val.mono { font-family: Consolas, Monaco, monospace; }
.warn-box {
  margin-top: 12px;
  padding: 9px 10px;
  border-radius: 7px;
  background: #fffbeb;
  color: #92400e;
  font-size: 11px;
  line-height: 1.5;
}
.warn-box.compact { margin: 0 0 8px; }
.drawer-overlay {
  position: fixed;
  inset: 0;
  z-index: 3000;
  background: rgba(15, 23, 42, .35);
}
.agent-drawer {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  z-index: 3001;
  width: 520px;
  max-width: 100vw;
  display: flex;
  flex-direction: column;
  background: #fff;
  box-shadow: -4px 0 24px rgba(15, 23, 42, .18);
}
.drawer-head,
.drawer-foot {
  flex: 0 0 auto;
  padding: 14px 18px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--am-border);
  font-size: 13px;
  font-weight: 600;
}
.drawer-foot {
  justify-content: flex-end;
  gap: 8px;
  border-top: 1px solid var(--am-border);
  border-bottom: 0;
}
.drawer-body {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding: 18px;
}
.field-doc {
  margin-bottom: 8px;
  border: 1px solid var(--am-border);
  border-radius: 7px;
  overflow: hidden;
  font-size: 11px;
}
.field-doc div {
  display: grid;
  grid-template-columns: 88px 1fr;
  gap: 8px;
  padding: 6px 10px;
  border-bottom: 1px solid var(--am-border);
}
.field-doc div:last-child { border-bottom: 0; }
.field-doc code { color: var(--am-primary-text); font-family: Consolas, Monaco, monospace; font-weight: 600; }
.field-doc span { color: var(--am-text2); line-height: 1.45; }
.drawer-yaml {
  min-height: 220px;
  font-family: Consolas, Monaco, monospace;
  font-size: 11px;
  line-height: 1.7;
}
.pill-wrap {
  min-height: 38px;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  padding: 6px 8px;
  border: 1px solid #cbd5e1;
  border-radius: 7px;
  background: #fff;
}
.pill-wrap.editable { cursor: text; }
.pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 22px;
  padding: 0 8px;
  border-radius: 6px;
  background: var(--am-primary-bg);
  color: var(--am-primary-text);
  font-size: 11px;
}
.pill-x { cursor: pointer; font-weight: 700; }
.pill-input {
  flex: 1 1 150px;
  min-width: 120px;
  border: 0 !important;
  padding: 2px !important;
  box-shadow: none !important;
}
.version-list { display: flex; flex-direction: column; gap: 8px; }
.version-card {
  padding: 10px 12px;
  border: 1px solid var(--am-border);
  border-radius: 7px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.version-title { font-weight: 600; color: var(--am-text); }
.version-meta { margin-top: 3px; font-size: 11px; color: var(--am-text2); }
@media (max-width: 900px) {
  .wizard-shell { height: 88vh; }
  .wizard-split { grid-template-columns: 1fr; }
  .wizard-left { border-right: 0; border-bottom: 1px solid var(--am-border); }
}
@media (max-width: 640px) {
  .am-topbar { align-items: flex-start; flex-direction: column; }
  .scard-foot { flex-wrap: wrap; }
  .sum-grid { grid-template-columns: 1fr; }
}
</style>
