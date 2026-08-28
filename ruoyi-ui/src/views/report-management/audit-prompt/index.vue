<template>
  <div class="app-container audit-config-page">
    <section class="model-panel">
      <div class="section-bar">
        <div><strong>模型连接配置</strong><span>初始审核和修订审核共用同一模型服务</span></div>
        <div class="section-actions">
          <el-tag :type="modelConfig.apiKeyConfigured ? 'success' : 'info'" size="mini" effect="plain">{{ modelConfig.apiKeyConfigured ? '密钥已配置' : '密钥未配置' }}</el-tag>
          <el-button icon="el-icon-refresh" size="mini" :loading="loading" @click="loadAll">刷新</el-button>
        </div>
      </div>
      <el-form ref="modelForm" :model="modelConfig" :rules="modelRules" inline size="small" class="model-form">
        <el-form-item label="模型 URL" prop="apiUrl" class="url-field"><el-input v-model="modelConfig.apiUrl" placeholder="Chat Completions API 地址" /></el-form-item>
        <el-form-item label="模型名称" prop="modelName" class="model-field"><el-input v-model="modelConfig.modelName" placeholder="例如 ark-code-latest" /></el-form-item>
        <el-form-item label="API Key" class="key-field">
          <el-input v-model="modelConfig.apiKey" type="password" show-password autocomplete="new-password" :placeholder="apiKeyPlaceholder" />
        </el-form-item>
        <el-form-item class="save-field"><el-button type="primary" icon="el-icon-check" :loading="modelSaving" @click="saveModelConfig">保存连接</el-button></el-form-item>
      </el-form>
      <div class="config-hint">API Key 留空将沿用当前密钥，服务端不会返回密钥明文。</div>
    </section>

    <section class="prompt-panel">
      <el-tabs v-model="activeTab" class="prompt-tabs">
        <el-tab-pane name="initial">
          <span slot="label"><i class="el-icon-document" /> 初始审核提示词</span>
          <div class="prompt-editor">
            <div class="prompt-heading"><div><strong>初始审核提示词</strong><span>用于批次生成的初始版本，检查文字质量、目录、标题与基础文档结构</span></div><div class="prompt-meta"><el-tag v-if="prompts.initial.version" size="mini" effect="plain">当前 v{{ prompts.initial.version }}</el-tag><span v-if="prompts.initial.updateTime">{{ prompts.initial.updateTime }}</span></div></div>
            <el-form :model="prompts.initial" label-width="92px" size="small">
              <el-form-item label="配置名称"><el-input v-model="prompts.initial.name" maxlength="128" /></el-form-item>
              <el-form-item label="提示词内容"><el-input v-model="prompts.initial.promptContent" type="textarea" :rows="18" resize="vertical" placeholder="请输入初始审核角色、范围和输出要求" /></el-form-item>
              <div class="prompt-actions"><el-button type="primary" icon="el-icon-check" :loading="promptSaving === 'initial'" @click="savePrompt('initial')">保存为新版本</el-button></div>
            </el-form>
          </div>
        </el-tab-pane>
        <el-tab-pane name="revision">
          <span slot="label"><i class="el-icon-edit-outline" /> 修订审核提示词</span>
          <div class="prompt-editor">
            <div class="prompt-heading"><div><strong>修订审核提示词</strong><span>用于用户上传的修订版本，检查性能容量分析、数据一致性、风险与建议，不重复初始检查</span></div><div class="prompt-meta"><el-tag v-if="prompts.revision.version" size="mini" effect="plain">当前 v{{ prompts.revision.version }}</el-tag><span v-if="prompts.revision.updateTime">{{ prompts.revision.updateTime }}</span></div></div>
            <el-form :model="prompts.revision" label-width="92px" size="small">
              <el-form-item label="配置名称"><el-input v-model="prompts.revision.name" maxlength="128" /></el-form-item>
              <el-form-item label="提示词内容"><el-input v-model="prompts.revision.promptContent" type="textarea" :rows="18" resize="vertical" placeholder="请输入修订审核角色、范围和输出要求" /></el-form-item>
              <div class="prompt-actions"><el-button type="primary" icon="el-icon-check" :loading="promptSaving === 'revision'" @click="savePrompt('revision')">保存为新版本</el-button></div>
            </el-form>
          </div>
        </el-tab-pane>
      </el-tabs>
    </section>
  </div>
</template>

<script>
import { createPromptVersion, getActivePrompt, getAiConfig, updateAiConfig } from '@/api/report-management/auditPrompt'

const emptyPrompt = type => ({
  auditType: type,
  name: type === 'initial' ? '初始审核提示词' : '修订审核提示词',
  promptContent: '', version: null, updateTime: ''
})

export default {
  name: 'ReportAuditPrompt',
  data() {
    return {
      loading: false, modelSaving: false, promptSaving: '', activeTab: 'initial',
      modelConfig: { apiUrl: '', modelName: '', apiKey: '', apiKeyMasked: '', apiKeyConfigured: false },
      prompts: { initial: emptyPrompt('initial'), revision: emptyPrompt('revision') },
      modelRules: {
        apiUrl: [{ required: true, message: '模型 URL 不能为空', trigger: 'blur' }],
        modelName: [{ required: true, message: '模型名称不能为空', trigger: 'blur' }]
      }
    }
  },
  computed: {
    apiKeyPlaceholder() {
      return this.modelConfig.apiKeyConfigured && this.modelConfig.apiKeyMasked
        ? `已配置：${this.modelConfig.apiKeyMasked}` : '请输入 API Key'
    }
  },
  created() { this.loadAll() },
  methods: {
    loadAll() {
      this.loading = true
      return Promise.all([this.loadModelConfig(), this.loadPrompt('initial'), this.loadPrompt('revision')])
        .finally(() => { this.loading = false })
    },
    loadModelConfig() {
      return getAiConfig().then(response => {
        this.modelConfig = {
          apiUrl: response.apiUrl || '', modelName: response.modelName || '', apiKey: '',
          apiKeyMasked: response.apiKeyMasked || '', apiKeyConfigured: Boolean(response.apiKeyConfigured)
        }
      }).catch(error => { if (!(error && error.response && error.response.status === 404)) throw error })
    },
    loadPrompt(auditType) {
      return getActivePrompt(auditType).then(response => {
        this.$set(this.prompts, auditType, {
          auditType, name: response.name || this.prompts[auditType].name,
          promptContent: response.promptContent || '', version: response.version || null,
          updateTime: response.updateTime || ''
        })
      }).catch(error => { if (!(error && error.response && error.response.status === 404)) throw error })
    },
    saveModelConfig() {
      this.$refs.modelForm.validate(valid => {
        if (!valid) return
        this.modelSaving = true
        updateAiConfig({ apiUrl: this.modelConfig.apiUrl, modelName: this.modelConfig.modelName, apiKey: this.modelConfig.apiKey })
          .then(response => {
            this.modelConfig.apiKey = ''
            this.modelConfig.apiKeyMasked = response.apiKeyMasked || ''
            this.modelConfig.apiKeyConfigured = Boolean(response.apiKeyConfigured)
            this.$modal.msgSuccess('模型连接已保存')
          }).finally(() => { this.modelSaving = false })
      })
    },
    savePrompt(auditType) {
      const form = this.prompts[auditType]
      if (!form.name.trim() || !form.promptContent.trim()) {
        this.$modal.msgError('配置名称和提示词内容不能为空')
        return
      }
      this.promptSaving = auditType
      createPromptVersion(auditType, { name: form.name.trim(), promptContent: form.promptContent.trim() })
        .then(response => {
          this.$set(this.prompts, auditType, { ...form, version: response.version, updateTime: response.updateTime || '' })
          this.$modal.msgSuccess(`已保存为 v${response.version}`)
        }).finally(() => { this.promptSaving = '' })
    }
  }
}
</script>

<style scoped>
.audit-config-page { min-height:calc(100vh - 84px); background:#f5f7fa; color:#273746; }
.model-panel,.prompt-panel { background:#fff; border:1px solid #dfe5ec; border-radius:6px; }
.model-panel { padding:18px 20px 12px; margin-bottom:12px; }
.section-bar,.prompt-heading { display:flex; align-items:flex-start; justify-content:space-between; gap:20px; }
.section-bar { margin-bottom:17px; }
.section-bar strong,.section-bar span,.prompt-heading strong,.prompt-heading span { display:block; }
.section-bar strong { font-size:15px; }.section-bar span,.prompt-heading span { margin-top:4px; color:#7c8996; font-size:12px; }
.section-actions { display:flex; align-items:center; gap:8px; }
.model-form { display:flex; align-items:flex-start; gap:12px; }
.model-form /deep/ .el-form-item { display:flex; margin-right:0; }
.model-form /deep/ .el-form-item__content { flex:1; }
.url-field { flex:1.6; }.model-field { flex:.85; }.key-field { flex:1; }.save-field { flex:none; }
.config-hint { margin:-4px 0 0 76px; color:#8b97a3; font-size:12px; }
.prompt-panel { padding:0 20px 20px; }
.prompt-tabs /deep/ .el-tabs__header { margin-bottom:0; }.prompt-tabs /deep/ .el-tabs__item { height:48px; line-height:48px; }
.prompt-editor { max-width:1080px; padding-top:18px; }
.prompt-heading { padding-bottom:14px; margin-bottom:16px; border-bottom:1px solid #edf1f5; }
.prompt-heading strong { font-size:14px; }.prompt-meta { display:flex; align-items:center; gap:10px; color:#8a96a3; font-size:12px; }
.prompt-meta span { margin-top:0; }.prompt-actions { padding-left:92px; }
@media (max-width:1180px) { .model-form { flex-wrap:wrap; }.url-field { flex:1 1 55%; }.model-field,.key-field { flex:1 1 32%; }.save-field { margin-left:auto; } }
</style>
