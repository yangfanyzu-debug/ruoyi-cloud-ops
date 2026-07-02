<template>
  <div class="alert-rule-page" v-loading="loading">
    <div class="alert-rule-page__breadcrumb">配置中心 <i class="el-icon-arrow-right" /> 告警匹配规则</div>
    <header class="alert-rule-page__header">
      <div>
        <h1>告警匹配规则配置</h1>
        <p>配置 System 与告警源的组合匹配规则，激活后对告警校验实时生效</p>
      </div>
      <div class="alert-rule-page__top-actions">
        <el-button :disabled="!draft" :loading="saving" @click="handleSaveDraft">保存草稿</el-button>
        <el-button type="primary" :disabled="!draft || !draft.id" :loading="activating" @click="handleActivate">激活配置</el-button>
      </div>
    </header>

    <div class="alert-rule-page__top-grid">
      <section class="alert-panel active-panel">
        <h2><svg-icon icon-class="validCode" /> 当前生效配置</h2>
        <template v-if="activeConfig">
          <div class="active-panel__meta">
            <span>当前生效版本： <b>v{{ activeConfig.version }}</b></span>
            <span>状态： <el-tag size="small" type="success">生效中</el-tag></span>
            <span>生效时间： {{ displayTime(activeConfig.activatedAt) }}</span>
            <span>操作人： {{ activeConfig.activatedBy || activeConfig.updatedBy || '-' }}</span>
            <span class="active-panel__description">说明： {{ activeConfig.description || '-' }}</span>
          </div>
          <div class="rule-summary-list">
            <div v-for="(rule, index) in activeConfig.rules || []" :key="rule.id || index" class="rule-summary-list__item">
              <b>{{ index + 1 }}</b><span>规则{{ index + 1 }}：</span><p>{{ buildRuleText(rule) }}</p>
            </div>
          </div>
          <div class="logic-tip"><i class="el-icon-info" /> 满足以下任意一条规则，则校验通过（规则间为 OR，单条规则内为 AND）</div>
        </template>
        <div v-else class="panel-empty"><i class="el-icon-document" /><span>暂无生效配置</span><small>保存并激活草稿后，将在此展示生效规则</small></div>
      </section>

      <section class="alert-panel preview-panel">
        <h2><svg-icon icon-class="component" /> 规则预览 / 逻辑结果</h2>
        <div class="expression-box" :class="{ 'expression-box--empty': !previewRules.length }">
          {{ previewRules.length ? expression : '暂无可预览规则' }}
        </div>
        <div class="test-box">
          <h3>在线测试</h3>
          <el-form :inline="true" :model="testForm" class="test-box__form" @submit.native.prevent>
            <el-form-item label="System">
              <el-select v-model="testForm.system" clearable filterable placeholder="请选择">
                <el-option v-for="option in systemOptions" :key="option.value" :label="option.label" :value="option.value" />
              </el-select>
            </el-form-item>
            <el-form-item label="告警源">
              <el-select v-model="testForm.source" clearable filterable placeholder="请选择">
                <el-option v-for="option in sourceOptions" :key="option.value" :label="option.label" :value="option.value" />
              </el-select>
            </el-form-item>
            <el-form-item><el-button type="primary" :loading="testing" @click="handleOnlineTest">校验</el-button></el-form-item>
          </el-form>
          <div v-if="testResult" class="test-result" :class="testResult.matched ? 'test-result--success' : 'test-result--failure'">
            <i :class="testResult.matched ? 'el-icon-success' : 'el-icon-error'" />
            <span>{{ testResult.matched ? `匹配成功：true，命中规则 ${matchedIndex}` : '未匹配：false' }}</span>
          </div>
        </div>
      </section>
    </div>

    <section ref="draftSection" class="alert-panel draft-panel">
      <div class="panel-heading">
        <h2><svg-icon icon-class="edit" /> 草稿配置 <template v-if="draft"><em>v{{ draft.version || '待分配' }}</em></template><el-tag v-else size="small" type="info">待新建</el-tag></h2>
        <span v-if="draft" class="panel-heading__hint">新增或编辑规则后，保存为草稿；点击激活后才会正式生效</span>
      </div>

      <div v-if="!draft" class="draft-empty">
        <i class="el-icon-edit-outline" />
        <strong>当前没有草稿</strong>
        <span>新建草稿后即可配置匹配规则</span>
        <el-button type="primary" plain icon="el-icon-plus" @click="createLocalDraft">新建草稿</el-button>
      </div>
      <template v-else>
        <el-button class="draft-panel__add" type="primary" plain size="small" icon="el-icon-plus" @click="addRule">新增规则</el-button>
        <div class="draft-panel__grid">
          <rule-card
            v-for="(rule, index) in rules"
            :key="rule.localKey || rule.id || index"
            :rule="rule"
            :index="index"
            :system-options="systemOptions"
            :source-options="sourceOptions"
            :errors="validation.cardErrors[index] || []"
            @change="updateRule"
            @copy="copyRule"
            @remove="removeRule"
          />
        </div>
        <div v-if="validation.summary.length" class="validation-summary"><i class="el-icon-warning-outline" /><b>校验规则：</b>{{ validation.summary.join('；') }}</div>
      </template>
    </section>

    <section class="alert-panel history-panel">
      <h2><svg-icon icon-class="time" /> 历史版本</h2>
      <el-table :data="history" border size="small" empty-text="暂无历史版本">
        <el-table-column label="版本号" min-width="90" align="center"><template slot-scope="scope">v{{ scope.row.version }}</template></el-table-column>
        <el-table-column label="状态" min-width="105" align="center"><template slot-scope="scope"><el-tag :type="statusMeta(scope.row.status).type" size="small">{{ statusMeta(scope.row.status).label }}</el-tag></template></el-table-column>
        <el-table-column prop="ruleCount" label="规则数" min-width="90" align="center"><template slot-scope="scope">{{ scope.row.ruleCount != null ? scope.row.ruleCount : (scope.row.rules || []).length }}</template></el-table-column>
        <el-table-column prop="createdBy" label="创建人" min-width="110" align="center" show-overflow-tooltip />
        <el-table-column label="创建时间" min-width="175" align="center"><template slot-scope="scope">{{ displayTime(scope.row.createdAt) }}</template></el-table-column>
        <el-table-column label="激活时间" min-width="175" align="center"><template slot-scope="scope">{{ displayTime(scope.row.activatedAt) }}</template></el-table-column>
        <el-table-column label="操作" min-width="190" align="center" fixed="right">
          <template slot-scope="scope">
            <template v-if="scope.row.status === 'DRAFT'">
              <el-button type="text" @click="handleEditDraft">编辑</el-button><span class="action-divider">/</span>
              <el-button type="text" @click="handleActivate(scope.row)">激活</el-button><span class="action-divider">/</span>
              <el-button type="text" class="danger-action" @click="handleDeleteVersion(scope.row)">删除</el-button>
            </template>
            <template v-else>
              <el-button type="text" @click="handleViewVersion(scope.row)">查看</el-button><span class="action-divider">/</span>
              <el-button type="text" @click="handleCopyVersion(scope.row)">复制</el-button>
            </template>
          </template>
        </el-table-column>
      </el-table>
      <pagination v-show="historyTotal > historyQuery.pageSize" :total="historyTotal" :page.sync="historyQuery.pageNo" :limit.sync="historyQuery.pageSize" @pagination="loadHistory" />
    </section>

    <version-detail-dialog :visible.sync="detailVisible" :version="detailVersion" />
  </div>
</template>

<script>
import { activateDraft, copyRuleSet, deleteDraft, getActiveRuleSet, getRuleSet, listRuleSets, saveDraft, testRules } from '@/api/alertConfig'
import RuleCard from './components/RuleCard.vue'
import VersionDetailDialog from './components/VersionDetailDialog.vue'
import { SOURCE_OPTIONS, STATUS_META, SYSTEM_OPTIONS } from './constants'
import { buildExpression, buildRuleText, cloneRules, normalizeRule, validateRules } from './rule-utils'

let localKey = 0
const emptyRule = () => ({ systems: [], sources: [], localKey: `local-${++localKey}` })

export default {
  name: 'AlertMatchingRules',
  components: { RuleCard, VersionDetailDialog },
  data() {
    return {
      activeConfig: null,
      draft: null,
      rules: [],
      dirty: false,
      history: [],
      historyTotal: 0,
      historyQuery: { pageNo: 1, pageSize: 10 },
      loading: false,
      saving: false,
      activating: false,
      testing: false,
      testForm: { system: '', source: '' },
      testResult: null,
      detailVisible: false,
      detailVersion: null,
      systemOptions: SYSTEM_OPTIONS,
      sourceOptions: SOURCE_OPTIONS
    }
  },
  computed: {
    operator() { return this.$store.getters.name || 'anonymous' },
    previewRules() { return this.draft ? this.rules : ((this.activeConfig && this.activeConfig.rules) || []) },
    expression() { return buildExpression(this.previewRules) },
    validation() { return validateRules(this.rules) },
    matchedIndex() { return this.testResult.matchedRuleIndex || this.testResult.matchedIndex || '-' }
  },
  watch: {
    'testForm.system'() { this.clearTestResult() },
    'testForm.source'() { this.clearTestResult() }
  },
  created() { this.loadAll() },
  methods: {
    buildRuleText,
    statusMeta(status) { return STATUS_META[status] || { label: status || '-', type: 'info' } },
    displayTime(value) {
      if (!value) return '-'
      const source = String(value).trim().replace(' ', 'T')
      const timestamp = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(source) ? source : `${source}Z`
      const date = new Date(timestamp)
      if (Number.isNaN(date.getTime())) return '-'
      const pad = part => String(part).padStart(2, '0')
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
    },
    clearTestResult() { this.testResult = null },
    async loadAll() {
      this.loading = true
      try {
        const [active, list] = await Promise.all([getActiveRuleSet(), listRuleSets(this.historyQuery)])
        this.activeConfig = active || null
        this.assignHistory(list)
        const draftItem = this.history.find(item => item.status === 'DRAFT')
        if (draftItem) {
          const detail = draftItem.rules ? draftItem : await getRuleSet(draftItem.id)
          this.setDraft(detail)
        } else {
          this.draft = null
          this.rules = []
          this.dirty = false
        }
      } finally { this.loading = false }
    },
    assignHistory(response) {
      this.history = Array.isArray(response) ? response : ((response && (response.items || response.rows)) || [])
      this.historyTotal = Array.isArray(response) ? response.length : Number(response && response.total) || 0
    },
    async loadHistory() {
      const response = await listRuleSets(this.historyQuery)
      this.assignHistory(response)
    },
    setDraft(draft) {
      this.draft = draft
      this.rules = cloneRules(draft.rules || []).map(rule => ({ ...rule, localKey: `local-${++localKey}` }))
      if (!this.rules.length) this.rules = [emptyRule()]
      this.dirty = false
      this.testResult = null
    },
    createLocalDraft() {
      this.draft = { id: null, version: null, status: 'DRAFT', description: '' }
      this.rules = [emptyRule()]
      this.dirty = true
    },
    addRule() { this.rules.push(emptyRule()); this.dirty = true; this.testResult = null },
    updateRule(index, rule) { this.$set(this.rules, index, { ...rule, localKey: this.rules[index].localKey }); this.dirty = true; this.testResult = null },
    copyRule(index) { this.rules.splice(index + 1, 0, { ...normalizeRule(this.rules[index]), localKey: `local-${++localKey}` }); this.dirty = true; this.testResult = null },
    removeRule(index) {
      if (this.rules.length === 1) return this.$message.warning('至少保留一条规则')
      this.rules.splice(index, 1)
      this.dirty = true
      this.testResult = null
    },
    payloadRules() { return cloneRules(this.rules).map(({ systems, sources, sortOrder }) => ({ systems, sources, sortOrder })) },
    ensureValidRules() {
      if (this.validation.valid) return true
      this.$message.warning(this.validation.summary[0] || '请完善规则配置')
      return false
    },
    async handleSaveDraft() {
      if (!this.draft || !this.ensureValidRules()) return
      this.saving = true
      try {
        await saveDraft({ id: this.draft.id || undefined, rules: this.payloadRules(), operator: this.operator })
        this.$message.success('草稿保存成功')
        await this.loadAll()
      } finally { this.saving = false }
    },
    async handleActivate(row) {
      const target = row && row.id ? row : this.draft
      if (!target || !target.id) return
      if (this.dirty) return this.$message.warning('请先保存草稿后再激活')
      await this.$confirm(`确认激活 v${target.version}？激活后将替换当前生效配置。`, '激活配置', { type: 'warning' })
      this.activating = true
      try {
        await activateDraft(target.id, { operator: this.operator })
        this.$message.success('配置激活成功')
        await this.loadAll()
      } finally { this.activating = false }
    },
    async handleOnlineTest() {
      if (!this.testForm.system || !this.testForm.source) return this.$message.warning('请选择 System 和告警源')
      if (!this.previewRules.length) return this.$message.warning('暂无可测试规则')
      if (this.draft && !this.ensureValidRules()) return
      this.testing = true
      try {
        this.testResult = await testRules({ system: this.testForm.system, source: this.testForm.source, rules: cloneRules(this.previewRules) })
      } finally { this.testing = false }
    },
    handleEditDraft() {
      if (!this.draft) return
      this.$nextTick(() => this.$refs.draftSection && this.$refs.draftSection.scrollIntoView({ behavior: 'smooth', block: 'start' }))
    },
    async handleViewVersion(row) {
      this.detailVersion = await getRuleSet(row.id)
      this.detailVisible = true
    },
    async handleCopyVersion(row) {
      const suffix = this.draft ? '，当前草稿将被替换' : ''
      await this.$confirm(`确认复制 v${row.version} 为新草稿${suffix}？`, '复制版本', { type: 'warning' })
      await copyRuleSet(row.id, { operator: this.operator })
      this.$message.success('已复制为新草稿')
      await this.loadAll()
      this.handleEditDraft()
    },
    async handleDeleteVersion(row) {
      await this.$confirm(`确认删除草稿 v${row.version}？`, '删除草稿', { type: 'warning' })
      await deleteDraft(row.id, this.operator)
      this.$message.success('草稿已删除')
      await this.loadAll()
    }
  }
}
</script>

<style scoped lang="scss">
.alert-rule-page {
  --primary: #0969eb;
  min-height: calc(100vh - 84px);
  padding: 18px 26px 28px;
  background: #f5f7fa;
  color: #1d2638;
  font-family: "PingFang SC", "Microsoft YaHei", sans-serif;
  &__breadcrumb { margin-bottom: 12px; color: #737d8f; font-size: 13px; i { margin: 0 8px; font-size: 11px; } }
  &__header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 15px; h1 { margin: 0; font-size: 27px; line-height: 38px; letter-spacing: .3px; } p { margin: 3px 0 0; color: #8992a2; font-size: 13px; } }
  &__top-actions { flex: none; margin-left: 20px; .el-button { min-width: 112px; height: 40px; font-size: 15px; } }
  &__top-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.06fr); gap: 16px; }
}
.alert-panel { min-width: 0; margin-bottom: 14px; padding: 17px 18px; border: 1px solid #dce2e9; border-radius: 9px; background: #fff; box-shadow: 0 1px 2px rgba(25, 47, 80, .02); h2 { display: flex; align-items: center; gap: 10px; margin: 0 0 15px; font-size: 16px; svg { color: var(--primary); } em { color: var(--primary); font-size: 15px; font-style: normal; } .el-tag { margin-left: 3px; } } }
.active-panel__meta { display: grid; grid-template-columns: 1.2fr .9fr 1.5fr; gap: 13px 20px; margin: 2px 7px 14px; color: #4f5969; font-size: 13px; b { color: #1e293b; } .active-panel__description { grid-column: span 2; } }
.rule-summary-list { border: 1px solid #dce2e9; border-radius: 5px; overflow: hidden; &__item { display: grid; grid-template-columns: 34px 64px minmax(0, 1fr); align-items: center; min-height: 40px; padding: 0 12px; border-bottom: 1px solid #e5e9ef; font-size: 13px; &:last-child { border-bottom: 0; } b { color: var(--primary); } p { margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #4b5566; } } }
.logic-tip { margin-top: 8px; padding: 8px 11px; border: 1px solid #c9ddfa; border-radius: 5px; background: #edf6ff; color: #1769d9; font-size: 12px; i { margin-right: 8px; } }
.panel-empty, .draft-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 212px; color: #98a2b1; i { margin-bottom: 10px; color: #b4c0ce; font-size: 32px; } span { color: #697486; } small { margin-top: 7px; color: #a0a9b5; } }
.expression-box { display: flex; align-items: center; justify-content: center; min-height: 82px; padding: 13px 22px; border: 1px solid #8eb8fb; border-radius: 7px; background: #f5f9ff; color: #1d2b43; font-size: 15px; font-weight: 600; line-height: 27px; text-align: center; word-break: break-word; &--empty { color: #9aa5b4; font-weight: 400; } }
.test-box { margin-top: 13px; padding: 13px 15px 12px; border: 1px solid #dce2e9; border-radius: 7px; h3 { margin: 0 0 10px; font-size: 14px; } &__form { display: flex; align-items: center; gap: 11px; ::v-deep .el-form-item { display: flex; flex: 1; align-items: center; margin: 0; &:last-child { flex: 0 0 auto; } .el-form-item__label { flex: none; } .el-form-item__content, .el-select { width: 100%; } } }
}
.test-result { margin-top: 11px; padding: 9px 12px; border: 1px solid; border-radius: 5px; font-size: 13px; font-weight: 600; i { margin-right: 9px; } &--success { border-color: #b8e5c4; background: #effbf2; color: #17913c; } &--failure { border-color: #f5c6c6; background: #fff2f2; color: #d64b4b; } }
.panel-heading { display: flex; align-items: center; gap: 16px; h2 { margin-bottom: 0; } &__hint { color: #929aa7; font-size: 12px; } }
.draft-panel { scroll-margin-top: 10px; &__add { margin: 14px 0 5px; } &__grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 13px; margin-top: 0; } }
.draft-empty { min-height: 170px; strong { margin-bottom: 5px; color: #525d6f; } .el-button { margin-top: 14px; } }
.validation-summary { margin-top: 10px; padding: 9px 12px; border: 1px solid #f2d18c; border-radius: 5px; background: #fff9ea; color: #d67b08; font-size: 12px; i, b { margin-right: 7px; } }
.history-panel { margin-bottom: 0; ::v-deep .el-table { border-radius: 6px; overflow: hidden; th { background: #f7f9fb; color: #3c4656; font-weight: 500; } .cell { white-space: nowrap; } .el-button { padding: 4px 2px; } } }
.action-divider { margin: 0 4px; color: #aab1bc; }.danger-action { color: #f04444 !important; }
@media (max-width: 1200px) {
  .alert-rule-page { padding: 16px; &__top-grid { grid-template-columns: 1fr; } }
  .draft-panel__grid { grid-template-columns: 1fr; }
}
@media (max-width: 760px) {
  .alert-rule-page__header { align-items: flex-start; flex-direction: column; }.alert-rule-page__top-actions { margin: 12px 0 0; }
  .active-panel__meta { grid-template-columns: 1fr; .active-panel__description { grid-column: auto; } }
  .test-box__form { align-items: stretch; flex-direction: column; ::v-deep .el-form-item { width: 100%; } }
}
</style>
