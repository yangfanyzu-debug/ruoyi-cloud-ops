<template>
  <div class="app-container audit-config-page">
    <div class="config-toolbar">
      <div>
        <strong>AI审核配置</strong>
        <span>模型配置保存后仅影响后续审核，历史审核保留当时的配置与检查点快照</span>
      </div>
      <el-button icon="el-icon-refresh" size="mini" @click="loadAll">刷新</el-button>
    </div>

    <el-tabs v-model="activeTab" class="config-tabs">
      <el-tab-pane label="模型与提示词" name="model">
        <el-form ref="form" :model="form" :rules="rules" class="config-form" label-width="110px" size="small">
          <div class="section-heading">
            <div><strong>模型连接</strong><span>配置兼容 Chat Completions 的大模型服务</span></div>
            <el-tag v-if="form.version" size="mini" effect="plain">当前 v{{ form.version }}</el-tag>
          </div>
          <el-row :gutter="16">
            <el-col :span="12">
              <el-form-item label="配置名称" prop="name"><el-input v-model="form.name" /></el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="模型名称" prop="modelName"><el-input v-model="form.modelName" /></el-form-item>
            </el-col>
          </el-row>
          <el-form-item label="模型URL" prop="apiUrl"><el-input v-model="form.apiUrl" /></el-form-item>
          <el-form-item label="API Key">
            <el-input v-model="form.apiKey" type="password" show-password autocomplete="new-password" :placeholder="apiKeyPlaceholder" />
            <div class="form-tip">留空将沿用当前密钥，接口不会返回密钥明文。</div>
          </el-form-item>

          <div class="section-heading prompt-heading">
            <div><strong>基础提示词</strong><span>描述审核角色、范围和表达要求，检查项目由“审核检查点”单独维护</span></div>
          </div>
          <el-form-item label="提示词" prop="promptContent">
            <el-input
              v-model="form.promptContent"
              type="textarea"
              :rows="14"
              resize="vertical"
              placeholder="例如：你是性能容量报告审核助手，仅审核DOCX中的文字、表格和章节结构……"
            />
          </el-form-item>
          <div class="form-actions">
            <el-button type="primary" icon="el-icon-check" :loading="saving" @click="submitForm">保存为新版本</el-button>
          </div>
        </el-form>
      </el-tab-pane>

      <el-tab-pane name="checkpoints">
        <span slot="label">审核检查点 <el-badge :value="enabledCount" :max="99" class="checkpoint-badge" /></span>
        <div class="checkpoint-panel">
          <div class="checkpoint-toolbar">
            <div>
              <strong>审核检查点</strong>
              <span>审核任务开始时会固化当前启用项，修改不会影响历史结果</span>
            </div>
            <el-button type="primary" size="mini" icon="el-icon-plus" @click="openCheckpointDialog()">新增检查点</el-button>
          </div>
          <el-table v-loading="checkpointLoading" :data="checkpoints" class="checkpoint-table">
            <el-table-column label="顺序" width="72" align="center">
              <template slot-scope="scope"><span class="order-mark">{{ scope.row.sortOrder }}</span></template>
            </el-table-column>
            <el-table-column label="检查点" min-width="190">
              <template slot-scope="scope"><strong class="checkpoint-name">{{ scope.row.name }}</strong></template>
            </el-table-column>
            <el-table-column label="检查要求" min-width="460" show-overflow-tooltip prop="content" />
            <el-table-column label="状态" width="90" align="center">
              <template slot-scope="scope">
                <el-switch v-model="scope.row.enabled" @change="quickToggle(scope.row)" />
              </template>
            </el-table-column>
            <el-table-column label="操作" width="90" align="right">
              <template slot-scope="scope"><el-button type="text" icon="el-icon-edit" @click="openCheckpointDialog(scope.row)">编辑</el-button></template>
            </el-table-column>
            <template slot="empty"><div class="checkpoint-empty">暂无审核检查点</div></template>
          </el-table>
        </div>
      </el-tab-pane>
    </el-tabs>

    <el-dialog :title="checkpointForm.id ? '编辑检查点' : '新增检查点'" :visible.sync="checkpointDialogVisible" width="620px" append-to-body>
      <el-form ref="checkpointForm" :model="checkpointForm" :rules="checkpointRules" label-width="86px" size="small">
        <el-form-item label="名称" prop="name"><el-input v-model="checkpointForm.name" maxlength="128" show-word-limit /></el-form-item>
        <el-form-item label="检查要求" prop="content">
          <el-input v-model="checkpointForm.content" type="textarea" :rows="6" maxlength="2000" show-word-limit />
        </el-form-item>
        <el-row :gutter="16">
          <el-col :span="12"><el-form-item label="排序"><el-input-number v-model="checkpointForm.sortOrder" :min="0" :max="9999" controls-position="right" /></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="启用"><el-switch v-model="checkpointForm.enabled" /></el-form-item></el-col>
        </el-row>
      </el-form>
      <div slot="footer">
        <el-button @click="checkpointDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="checkpointSaving" @click="saveCheckpoint">保存</el-button>
      </div>
    </el-dialog>
  </div>
</template>

<script>
import {
  createAuditCheckpoint, createPromptVersion, getActivePrompt,
  listAuditCheckpoints, updateAuditCheckpoint
} from '@/api/report-management/auditPrompt'

const emptyCheckpoint = () => ({ id: null, name: '', content: '', sortOrder: 10, enabled: true })

export default {
  name: 'ReportAuditPrompt',
  data() {
    return {
      activeTab: 'model', saving: false, checkpointLoading: false, checkpointSaving: false,
      checkpointDialogVisible: false, checkpoints: [], checkpointForm: emptyCheckpoint(),
      form: {
        name: '默认审核配置', apiUrl: 'https://ark.cn-beijing.volces.com/api/coding/v3', apiKey: '',
        apiKeyMasked: '', apiKeyConfigured: false, promptContent: '', version: '', modelName: 'ark-code-latest'
      },
      rules: {
        name: [{ required: true, message: '配置名称不能为空', trigger: 'blur' }],
        apiUrl: [{ required: true, message: '模型URL不能为空', trigger: 'blur' }],
        modelName: [{ required: true, message: '模型名称不能为空', trigger: 'blur' }],
        promptContent: [{ required: true, message: '提示词不能为空', trigger: 'blur' }]
      },
      checkpointRules: {
        name: [{ required: true, message: '检查点名称不能为空', trigger: 'blur' }],
        content: [{ required: true, message: '检查要求不能为空', trigger: 'blur' }]
      }
    }
  },
  computed: {
    apiKeyPlaceholder() {
      return this.form.apiKeyConfigured && this.form.apiKeyMasked ? `已配置：${this.form.apiKeyMasked}，留空沿用` : '请输入 API Key'
    },
    enabledCount() {
      return this.checkpoints.filter(item => item.enabled).length
    }
  },
  created() { this.loadAll() },
  methods: {
    loadAll() { this.loadActivePrompt(); this.loadCheckpoints() },
    loadActivePrompt() {
      getActivePrompt().then(response => {
        this.form = {
          name: response.name, apiUrl: response.apiUrl, apiKey: '', apiKeyMasked: response.apiKeyMasked || '',
          apiKeyConfigured: Boolean(response.apiKeyConfigured), promptContent: response.promptContent,
          version: response.version, modelName: response.modelName
        }
      })
    },
    loadCheckpoints() {
      this.checkpointLoading = true
      listAuditCheckpoints().then(response => { this.checkpoints = response.rows || [] }).finally(() => { this.checkpointLoading = false })
    },
    submitForm() {
      this.$refs.form.validate(valid => {
        if (!valid) return
        this.saving = true
        createPromptVersion({
          name: this.form.name, apiUrl: this.form.apiUrl, apiKey: this.form.apiKey,
          promptContent: this.form.promptContent, modelName: this.form.modelName
        }).then(response => {
          this.$modal.msgSuccess(`已保存为 v${response.version}`)
          this.form.version = response.version; this.form.apiKey = ''
          this.form.apiKeyMasked = response.apiKeyMasked || ''; this.form.apiKeyConfigured = Boolean(response.apiKeyConfigured)
        }).finally(() => { this.saving = false })
      })
    },
    openCheckpointDialog(row) {
      this.checkpointForm = row ? { ...row } : { ...emptyCheckpoint(), sortOrder: (this.checkpoints.length + 1) * 10 }
      this.checkpointDialogVisible = true
      this.$nextTick(() => this.$refs.checkpointForm && this.$refs.checkpointForm.clearValidate())
    },
    saveCheckpoint() {
      this.$refs.checkpointForm.validate(valid => {
        if (!valid) return
        this.checkpointSaving = true
        const request = this.checkpointForm.id
          ? updateAuditCheckpoint(this.checkpointForm.id, this.checkpointForm)
          : createAuditCheckpoint(this.checkpointForm)
        request.then(() => {
          this.$modal.msgSuccess('检查点已保存')
          this.checkpointDialogVisible = false
          this.loadCheckpoints()
        }).finally(() => { this.checkpointSaving = false })
      })
    },
    quickToggle(row) {
      updateAuditCheckpoint(row.id, row).then(() => this.$modal.msgSuccess(row.enabled ? '检查点已启用' : '检查点已停用'))
        .catch(() => { row.enabled = !row.enabled })
    }
  }
}
</script>

<style scoped>
.audit-config-page { min-height:calc(100vh - 84px); background:#f6f8fb; }
.config-toolbar { display:flex; align-items:center; justify-content:space-between; margin-bottom:12px; }
.config-toolbar strong,.config-toolbar span,.section-heading strong,.section-heading span,.checkpoint-toolbar strong,.checkpoint-toolbar span { display:block; }
.config-toolbar strong { color:#1f2d3d; font-size:16px; }.config-toolbar span { margin-top:4px; color:#7f8c99; font-size:12px; }
.config-tabs { padding:0 20px 20px; background:#fff; border:1px solid #e4e9f0; border-radius:6px; }
.config-tabs /deep/ .el-tabs__header { margin-bottom:18px; }.checkpoint-badge { margin-left:5px; }
.checkpoint-badge /deep/ .el-badge__content { top:3px; }
.config-form { max-width:1040px; }
.section-heading,.checkpoint-toolbar { display:flex; align-items:center; justify-content:space-between; margin-bottom:18px; }
.section-heading strong,.checkpoint-toolbar strong { color:#273746; font-size:14px; }.section-heading span,.checkpoint-toolbar span { margin-top:4px; color:#8492a6; font-size:12px; }
.prompt-heading { padding-top:18px; margin-top:6px; border-top:1px solid #edf1f6; }
.form-tip { margin-top:5px; color:#8492a6; font-size:12px; }.form-actions { padding-left:110px; }
.checkpoint-panel { min-height:420px; }.checkpoint-table { border:1px solid #e8edf3; border-radius:5px; }
.checkpoint-table /deep/ th { background:#f7f9fc; color:#52616f; }.checkpoint-table /deep/::before { display:none; }
.order-mark { display:inline-grid; min-width:28px; height:22px; place-items:center; color:#60758a; background:#edf3f7; border-radius:3px; font-size:12px; }
.checkpoint-name { color:#303a45; font-size:13px; }.checkpoint-empty { padding:40px 0; color:#9aa6b2; }
</style>
