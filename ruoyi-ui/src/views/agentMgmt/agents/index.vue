<template>
  <div class="app-container agent-mgmt-page">
    <div class="am-topbar">
      <div>
        <span class="am-title">Agents</span>
        <span class="am-sub">{{ rows.length }} 个 Agent</span>
      </div>
      <div class="am-actions">
        <el-button size="mini" icon="el-icon-refresh" @click="getList">刷新</el-button>
        <el-button size="mini" icon="el-icon-upload2" @click="openImport">从 YAML 导入</el-button>
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
        <div v-for="row in rows" :key="row.id" class="agent-card" :class="[{ readonly: !row.can_edit }, 'type-' + row.type, 'status-' + row.status]">
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

    <el-dialog :visible.sync="dialogVisible" width="1120px" class="am-dialog wizard-dialog agent-wizard-dialog" :show-close="false" top="4vh">
      <div class="wizard-shell">
        <div class="wizard-topbar">
          <div>
            <span class="wizard-title">{{ dialogTitle }}</span>
            <span class="wizard-sub">{{ readonly ? '只读查看' : '填写字段并实时生成 Agent YAML' }}</span>
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
              <button type="button" class="type-btn" :class="{ active: form.type === 'expert' }" :disabled="form.id || readonly" @click="setAgentType('expert')">
                <span class="type-icon">EX</span>
                Expert
                <small>执行专家</small>
              </button>
              <button type="button" class="type-btn" :class="{ active: form.type === 'planner' }" :disabled="form.id || readonly" @click="setAgentType('planner')">
                <span class="type-icon">PL</span>
                Planner
                <small>规划调度</small>
              </button>
            </div>
            <div class="hint role-hint">{{ typeHint }}</div>

            <div class="fr">
              <label class="fl">名称 <span class="fkey">name</span></label>
              <input v-model.trim="form.agent_name" type="text" :disabled="form.id || readonly" :placeholder="form.type === 'planner' ? 'planner_agent' : 'es_expert_agent'" @blur="checkNameLive">
              <div class="hint">仅英文字母、数字、下划线，以字母开头；作为 Agent 的唯一标识</div>
              <div class="field-feedback" :class="nameStatus">{{ nameMessage }}</div>
            </div>

            <div class="fr">
              <label class="fl">Role <span class="fkey">role</span></label>
              <input v-model="form.role" type="text" :disabled="readonly" :placeholder="form.type === 'planner' ? '告警根因分析规划专家' : 'Elasticsearch集群专家'">
              <div class="hint">LLM 的角色身份，注入到系统提示词，影响模型定位和输出风格</div>
            </div>

            <div class="fr">
              <label class="fl">Goal <span class="fkey">goal</span></label>
              <textarea v-model="form.goal" :disabled="readonly" rows="3" />
              <div class="hint">{{ form.type === 'planner' ? '描述规划任务目标和预期输出；具体如何调度由 Skill 文档定义' : '描述该专家的核心职责，LLM 将以此为目标执行具体分析' }}</div>
            </div>

            <div class="fr">
              <label class="fl">Backstory <span class="fkey">backstory</span> <span class="fopt">选填</span></label>
              <textarea v-model="form.backstory" :disabled="readonly" rows="3" />
              <div class="hint">{{ form.type === 'planner' ? '补充约束规则，例如数据传递、何时禁止调用某类专家等' : '补充领域背景，例如擅长识别的异常类型和关键字段' }}</div>
            </div>

            <div class="divider"></div>
            <div class="section-title">能力配置</div>
            <div class="hint capability-hint">{{ form.type === 'planner' ? 'Planner 的 Skill 提供领域知识文档，作为提示词背景上下文' : 'Expert 的 Skill 提供工具调用能力，供 LLM 与外部系统交互' }}</div>
            <div class="fr">
              <label class="fl">Skills <span class="fkey">skills</span></label>
              <div class="pill-wrap editable" :class="{ disabled: readonly }" @click="focusSkillInput">
                <span v-for="skill in form.skills" :key="skill" class="pill">
                  {{ skill }}<span v-if="!readonly" class="pill-x" @click.stop="removeSkill(skill)">×</span>
                </span>
                <input v-if="!readonly" ref="skillInput" v-model.trim="newSkill" class="pill-input" placeholder="输入 skill 名回车添加..." @keydown.enter.prevent="addSkill">
                <span v-if="readonly && !form.skills.length" class="pill muted">未配置</span>
              </div>
              <div class="hint">当前环境没有 Skill 列表接口时，可手动输入 skill 名；保存时会自动写入 YAML</div>
            </div>

            <div class="divider"></div>
            <div class="fr">
              <label class="fl">分类标签</label>
              <select v-model="form.tags" :disabled="readonly">
                <option value="">请选择...</option>
                <option v-for="cat in categories" :key="cat" :value="cat">{{ cat }}</option>
              </select>
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
              <div class="sum-cell wide">
                <div class="sum-lbl">Role</div>
                <div class="sum-val">{{ form.role || '-' }}</div>
              </div>
              <div class="sum-cell wide">
                <div class="sum-lbl">Skills</div>
                <div class="sum-val">{{ form.skills.length ? form.skills.join(', ') : '-' }}</div>
              </div>
            </div>
            <div class="warn-box" v-if="!readonly">保存后会生成新的版本记录，激活状态需要在卡片上单独操作。</div>
          </div>

          <div class="wizard-right">
            <div class="preview-label">YAML 预览</div>
            <pre class="yaml-block">{{ agentYaml || '# 暂无 YAML 内容' }}</pre>
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

    <el-dialog title="从 YAML 导入 Agent" :visible.sync="importVisible" width="720px" class="am-dialog import-dialog">
      <div class="fr">
        <label class="fl">Agent YAML</label>
        <textarea v-model="importYaml" rows="16" class="import-yaml" placeholder="粘贴包含 name、role、goal、backstory、skills 的 YAML..." />
        <div class="hint">解析成功后会跳转到 Agent 编辑向导，你可以继续调整字段后保存。</div>
      </div>
      <span slot="footer" class="dialog-footer">
        <el-button size="mini" @click="importVisible = false">取消</el-button>
        <el-button size="mini" type="primary" @click="parseImportYaml">解析并编辑</el-button>
      </span>
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
  checkAgentName,
  createAgent,
  deactivateAgent,
  deleteAgent,
  getAgent,
  listAgents,
  listAgentVersions,
  rollbackAgent,
  updateAgent
} from '@/api/agentMgmt'

const NAME_RE = /^[a-zA-Z][a-zA-Z0-9_]*$/

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
      categories: ['数据处理', '内容生成', '工作流', '分析', '通知', '集成', '自定义'],
      dialogVisible: false,
      readonly: false,
      wizardStep: 0,
      nameStatus: '',
      nameMessage: '',
      newSkill: '',
      form: this.emptyForm(),
      importVisible: false,
      importYaml: '',
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
    typeHint() {
      return this.form.type === 'planner'
        ? 'Planner 负责接收任务、拆解目标、按需调度 Expert，最终汇总输出报告。'
        : 'Expert 负责执行具体分析或操作任务，由 Planner 按需调用，结果返回给 Planner 汇总。'
    },
    agentYaml() {
      return this.buildAgentYaml(this.form)
    }
  },
  created() {
    this.getList()
  },
  watch: {
    '$route.query.editAgent'(name) {
      if (name) this.openAgentFromRoute(name)
    }
  },
  methods: {
    emptyForm() {
      return { id: null, agent_name: '', type: 'expert', role: '', goal: '', backstory: '', skills: [], tags: '', content: '' }
    },
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
    parseYamlField(content, key) {
      const match = String(content || '').match(new RegExp(`^${key}:\\s*(.+)$`, 'm'))
      return match ? match[1].trim() : ''
    },
    summarizeText(text) {
      if (!text) return '暂无配置内容'
      const role = this.parseYamlField(text, 'role')
      if (role) return role.slice(0, 90)
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
        if (this.$route.query.editAgent) this.openAgentFromRoute(this.$route.query.editAgent)
      } finally {
        this.loading = false
      }
    },
    async openAgentFromRoute(name) {
      if (!name || this.dialogVisible) return
      let target = this.rows.find(row => row.agent_name === name)
      if (!target && this.query.scope !== 'all') {
        this.query.scope = 'all'
        this.rows = await listAgents(this.query)
        target = this.rows.find(row => row.agent_name === name)
      }
      if (!target) {
        this.$message.warning(`未找到 Agent：${name}`)
        return
      }
      await this.openEdit(target, false)
      this.$router.replace({ path: this.$route.path, query: {} })
    },
    setAgentType(type) {
      if (this.form.id || this.readonly) return
      this.form.type = type
    },
    openCreate() {
      this.readonly = false
      this.wizardStep = 0
      this.nameStatus = ''
      this.nameMessage = ''
      this.newSkill = ''
      this.form = this.emptyForm()
      this.dialogVisible = true
    },
    async openEdit(row, readonly) {
      const data = await getAgent(row.id)
      this.readonly = readonly || !data.can_edit
      this.wizardStep = 0
      this.nameStatus = ''
      this.nameMessage = ''
      this.newSkill = ''
      this.form = {
        ...this.emptyForm(),
        ...this.parseAgentYaml(data.content, data.type),
        id: data.id,
        agent_name: data.agent_name,
        type: data.type,
        tags: data.tags || '',
        content: data.content || ''
      }
      this.dialogVisible = true
    },
    openImport() {
      this.importYaml = ''
      this.importVisible = true
    },
    parseImportYaml() {
      const parsed = this.parseAgentYaml(this.importYaml)
      this.form = {
        ...this.emptyForm(),
        ...parsed,
        agent_name: parsed.agent_name || 'imported_agent'
      }
      this.readonly = false
      this.wizardStep = 0
      this.nameStatus = ''
      this.nameMessage = '解析成功，请确认字段后保存'
      this.importVisible = false
      this.dialogVisible = true
    },
    parseAgentYaml(content, fallbackType = 'expert') {
      const raw = String(content || '')
      const get = key => {
        const match = raw.match(new RegExp(`^${key}:[ \\t]*([^\\r\\n]*)`, 'm'))
        return match ? this.cleanYamlFieldValue(match[1]) : ''
      }
      const getBlock = key => {
        const match = raw.match(new RegExp(`^${key}:[ \\t]*(?:[|>]|&gt;|&vert;)-?\\n((?:[ \\t]+.*\\n?)*)`, 'm'))
        return match ? this.cleanYamlFieldValue(match[1].replace(/^[ \t]{2}/gm, '').trimEnd()) : null
      }
      const skillBlock = raw.match(/^skills:\s*\n((?:[ \t]+-[ \t]+.+\n?)*)/m)
      const skills = skillBlock ? skillBlock[1].split('\n').map(line => line.replace(/^\s*-\s*/, '').trim()).filter(Boolean) : []
      const detectedType = get('type') || (raw.toLowerCase().includes('planner') ? 'planner' : fallbackType)
      const goalBlock = getBlock('goal')
      const backstoryBlock = getBlock('backstory')
      return {
        agent_name: get('name'),
        type: detectedType === 'planner' ? 'planner' : 'expert',
        role: get('role'),
        goal: goalBlock !== null ? goalBlock : get('goal'),
        backstory: backstoryBlock !== null ? backstoryBlock : get('backstory'),
        skills
      }
    },
    cleanYamlFieldValue(value) {
      const text = String(value || '').trim()
      if (['>', '|', '&gt;', '&vert;'].includes(text)) return ''
      return text
    },
    buildAgentYaml(data) {
      const lines = []
      const goalOp = data.type === 'planner' ? '|' : '>'
      const replacements = {
        name: [`name: ${data.agent_name || ''}`],
        role: [`role: ${data.role || ''}`],
        goal: [
          `goal: ${goalOp}`,
          ...this.toYamlBlock(data.goal).map(line => `  ${line}`)
        ],
        backstory: [
          'backstory: >',
          ...this.toYamlBlock(data.backstory).map(line => `  ${line}`)
        ],
        skills: this.buildSkillsYaml(data.skills)
      }
      if (data.id && data.content) return this.mergeAgentYaml(data.content, replacements)
      lines.push(...replacements.name)
      lines.push(...replacements.role)
      lines.push('')
      lines.push(...replacements.goal)
      lines.push('')
      lines.push(...replacements.backstory)
      lines.push('')
      lines.push(...replacements.skills)
      return lines.join('\n')
    },
    buildSkillsYaml(skills) {
      if (skills && skills.length) return ['skills:', ...skills.map(skill => `  - ${skill}`)]
      return ['skills: []']
    },
    mergeAgentYaml(content, replacements) {
      const lines = String(content || '').replace(/\r\n/g, '\n').split('\n')
      const out = []
      const seen = {}
      const keyRe = /^([A-Za-z_][A-Za-z0-9_-]*):/
      let i = 0
      while (i < lines.length) {
        const match = lines[i].match(keyRe)
        if (match && replacements[match[1]]) {
          const key = match[1]
          if (!seen[key]) {
            if (out.length && out[out.length - 1] !== '') out.push('')
            out.push(...replacements[key])
            seen[key] = true
          }
          i += 1
          while (i < lines.length && !keyRe.test(lines[i])) i += 1
        } else {
          out.push(lines[i])
          i += 1
        }
      }
      Object.keys(replacements).forEach(key => {
        if (!seen[key]) {
          if (out.length && out[out.length - 1] !== '') out.push('')
          out.push(...replacements[key])
        }
      })
      return out.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd()
    },
    toYamlBlock(value) {
      const text = String(value || '').trimEnd()
      return text ? text.split('\n') : ['']
    },
    extractErrorMessage(error) {
      const data = error && error.response && error.response.data
      return (data && (data.detail || data.msg || data.message)) || (error && error.message) || ''
    },
    agentActionError(error, action) {
      const message = this.extractErrorMessage(error)
      if (message.includes('Agent is used by active scenarios:')) {
        const scenarios = message.split('Agent is used by active scenarios:')[1].trim()
        return `当前 Agent 已被启用中的场景引用，不能停用。请先停用相关场景：${scenarios}`
      }
      return `${action}失败：${message || '请稍后重试'}`
    },
    focusSkillInput() {
      if (!this.readonly && this.$refs.skillInput) this.$refs.skillInput.focus()
    },
    addSkill() {
      const value = this.newSkill.trim()
      if (!value || this.form.skills.includes(value)) return
      this.form.skills.push(value)
      this.newSkill = ''
    },
    removeSkill(skill) {
      this.form.skills = this.form.skills.filter(item => item !== skill)
    },
    async checkNameLive() {
      if (this.form.id || !this.form.agent_name) return
      if (!NAME_RE.test(this.form.agent_name)) {
        this.nameStatus = 'err'
        this.nameMessage = '格式不正确'
        return
      }
      try {
        const result = await checkAgentName(this.form.agent_name)
        this.nameStatus = result.available ? 'ok' : 'err'
        this.nameMessage = result.available ? '名称可用' : result.message
      } catch (e) {
        this.nameStatus = ''
        this.nameMessage = ''
      }
    },
    nextStep() {
      if (this.validateAgentForm()) this.wizardStep = 1
    },
    validateAgentForm() {
      if (!this.form.agent_name) {
        this.$message.warning('请填写 Agent 名称')
        return false
      }
      if (!NAME_RE.test(this.form.agent_name)) {
        this.$message.warning('Agent 名称格式不正确')
        return false
      }
      if (!this.form.role) {
        this.$message.warning('请填写 Role')
        return false
      }
      return true
    },
    submit() {
      if (this.validateAgentForm()) this.saveAgent()
    },
    async saveAgent() {
      const content = this.agentYaml
      const isEdit = !!this.form.id
      if (isEdit) await updateAgent(this.form.id, { content, tags: this.form.tags || null })
      else await createAgent({ agent_name: this.form.agent_name, type: this.form.type, content, tags: this.form.tags || null })
      this.$message.success(isEdit ? 'Agent 已保存' : 'Agent 已创建')
      this.dialogVisible = false
      this.getList()
    },
    async activate(row) {
      try {
        await activateAgent(row.id)
        this.$message.success(`Agent「${row.agent_name}」已激活`)
        this.getList()
      } catch (error) {
        this.$message.warning(this.agentActionError(error, '激活'))
      }
    },
    async deactivate(row) {
      try {
        await deactivateAgent(row.id)
        this.$message.success(`Agent「${row.agent_name}」已停用`)
        this.getList()
      } catch (error) {
        this.$message.warning(this.agentActionError(error, '停用'))
      }
    },
    handleMore(command, row) {
      if (command === 'versions') this.openVersions(row)
      if (command === 'delete') this.remove(row)
    },
    async remove(row) {
      await this.$confirm(`确认删除 ${row.agent_name}？`, '提示', { type: 'warning' })
      await deleteAgent(row.id)
      this.$message.success(`Agent「${row.agent_name}」已删除`)
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
      this.$message.success(`Agent 已回滚到 ${version.version}`)
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
.am-actions { display: flex; gap: 6px; flex-wrap: wrap; justify-content: flex-end; }
.am-filterbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  padding: 8px;
  margin: 10px 0 0;
  border-bottom: 1px solid var(--am-border);
  border: 1px solid var(--am-border);
  border-radius: 8px;
  background: #f8fafc;
}
.filter-label { margin-left: 6px; font-size: 11px; color: var(--am-text2); }
.filter-label:first-child { margin-left: 0; }
.filter-btn {
  height: 24px;
  padding: 0 10px;
  border: 1px solid var(--am-border);
  border-radius: 5px;
  background: #fff;
  color: var(--am-text2);
  font-size: 11px;
  cursor: pointer;
}
.filter-btn.active {
  border-color: var(--am-primary);
  background: var(--am-primary-bg);
  color: var(--am-primary-text);
  font-weight: 600;
}
.am-scroll { min-height: 360px; padding-top: 12px; }
.agent-card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 10px;
}
.agent-card {
  position: relative;
  overflow: hidden;
  padding: 12px;
  border: 1px solid var(--am-border);
  border-radius: 8px;
  background: var(--am-bg);
  transition: border-color .15s, box-shadow .15s, transform .15s;
}
.agent-card::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  width: 3px;
  background: var(--am-primary);
}
.agent-card.type-expert::before { background: #0f766e; }
.agent-card.type-planner::before { background: var(--am-primary); }
.agent-card.status-inactive::before { background: #9f1239; }
.agent-card.status-draft::before { background: #94a3b8; }
.agent-card:hover {
  border-color: #cbd5e1;
  box-shadow: 0 8px 20px rgba(15, 23, 42, .055);
  transform: translateY(-1px);
}
.agent-card.readonly { background: #fbfdff; }
.card-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; margin-bottom: 8px; padding-left: 2px; }
.card-head > div:first-child { min-width: 0; }
.card-name {
  overflow: hidden;
  color: var(--am-text);
  font-family: Consolas, Monaco, monospace;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.card-role {
  margin-top: 3px;
  overflow: hidden;
  color: var(--am-text2);
  font-size: 11px;
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.status-badge, .badge {
  display: inline-flex;
  align-items: center;
  height: 18px;
  padding: 0 6px;
  border-radius: 5px;
  font-size: 10px;
  white-space: nowrap;
}
.st-draft { color: #6b7280; background: #f3f4f6; }
.st-active { color: #047857; background: #ecfdf5; }
.st-inactive { color: #9f1239; background: #fff1f2; }
.badge-row { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 8px; }
.badge.bp { color: var(--am-primary-text); background: var(--am-primary-bg); }
.badge.bs { color: #0f766e; background: #ecfdf5; }
.badge.ro { color: #7c2d12; background: #fffbeb; }
.badge.tag { color: #475569; background: var(--am-bg3); }
.meta-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
  margin-bottom: 10px;
  padding-top: 8px;
  border-top: 1px solid #eef2f7;
}
.meta-grid .wide { grid-column: auto; }
.meta-grid div {
  min-width: 0;
  padding: 6px 8px;
  border-radius: 6px;
  background: var(--am-bg2);
}
.meta-grid span { display: block; margin-bottom: 2px; font-size: 10px; color: var(--am-text2); }
.meta-grid strong {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 11px;
  font-weight: 500;
  line-height: 1.3;
}
.card-foot { display: flex; align-items: center; gap: 5px; flex-wrap: nowrap; padding-top: 9px; border-top: 1px solid #eef2f7; }
.card-foot .el-button { margin-left: 0; }
::v-deep .card-foot .el-button--mini {
  min-width: 54px;
  padding: 6px 9px;
  border-radius: 5px;
}
::v-deep .card-foot .el-dropdown .el-button--mini {
  min-width: 64px;
}
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
.wizard-title { display: block; font-size: 15px; font-weight: 600; color: var(--am-text); }
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
.step-dot.cur, .step-dot.done {
  border-color: var(--am-primary);
  color: var(--am-primary);
}
.step-label { margin: 0 10px 0 7px; font-size: 11px; color: var(--am-text2); }
.step-label.cur { color: var(--am-primary-text); font-weight: 600; }
.step-line { flex: 1; height: 1px; background: var(--am-border); }
.step-line.done { background: var(--am-primary); }
.wizard-split {
  flex: 1 1 auto;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(390px, 440px) minmax(0, 1fr);
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
.wiz-btn.pri {
  border-color: var(--am-primary);
  background: var(--am-primary);
  color: #fff;
}
.section-title { margin-bottom: 10px; font-size: 12px; font-weight: 600; color: #334155; }
.type-row { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 6px; }
.type-btn {
  height: 72px;
  border: 1px solid var(--am-border2);
  border-radius: 7px;
  background: #fff;
  color: #334155;
  cursor: pointer;
  text-align: center;
}
.type-btn.active {
  border-color: var(--am-primary);
  background: var(--am-primary-bg);
  color: var(--am-primary);
}
.type-btn:disabled { cursor: not-allowed; opacity: .7; }
.type-icon { display: block; margin-bottom: 3px; font-size: 14px; font-weight: 700; }
.type-btn small { display: block; margin-top: 2px; font-size: 10px; color: var(--am-text2); }
.role-hint, .capability-hint { margin-bottom: 12px; }
.fr {
  float: none !important;
  clear: both;
  display: block;
  width: 100%;
  box-sizing: border-box;
  margin-bottom: 12px;
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
.fkey {
  margin-left: 3px;
  font-family: Consolas, Monaco, monospace;
  font-size: 10px;
  color: #64748b;
}
.fopt { font-size: 10px; color: #94a3b8; }
.fr input,
.fr textarea,
.fr select {
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
.fr textarea {
  min-height: 82px;
  resize: vertical;
  line-height: 1.55;
}
.fr input:focus,
.fr textarea:focus,
.fr select:focus {
  border-color: var(--am-primary);
  box-shadow: 0 0 0 2px rgba(37, 99, 235, .08);
}
.hint {
  margin-top: 5px;
  font-size: 10px;
  line-height: 1.5;
  color: var(--am-text2);
}
.field-feedback {
  min-height: 16px;
  margin-top: 4px;
  font-size: 10px;
}
.field-feedback.ok { color: var(--am-green); }
.field-feedback.err { color: var(--am-red); }
.divider { height: 1px; margin: 15px 0; background: var(--am-border); }
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
.pill-wrap.disabled { background: #f8fafc; }
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
.pill.muted { color: var(--am-text2); background: var(--am-bg3); }
.pill-x { cursor: pointer; font-weight: 700; }
.pill-input {
  flex: 1 1 160px;
  min-width: 140px;
  border: 0 !important;
  padding: 2px !important;
  box-shadow: none !important;
}
.preview-label {
  margin-bottom: 8px;
  font-size: 11px;
  font-weight: 600;
  color: #475569;
}
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
.sum-cell {
  padding: 10px 11px;
  border-radius: 7px;
  background: var(--am-bg2);
}
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
.import-yaml {
  min-height: 320px;
  font-family: Consolas, Monaco, monospace;
  line-height: 1.6;
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
  .agent-card-grid { grid-template-columns: 1fr; }
}
@media (max-width: 640px) {
  .am-topbar { align-items: flex-start; flex-direction: column; }
  .card-foot { flex-wrap: wrap; }
  .type-row, .sum-grid, .meta-grid { grid-template-columns: 1fr; }
}
</style>
