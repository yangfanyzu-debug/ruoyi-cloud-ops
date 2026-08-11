<template>
  <div class="app-container audit-config-page">
    <el-form ref="form" :model="form" :rules="rules" class="config-form" label-width="110px" size="small">
      <div class="config-section">
        <div class="section-title">模型配置</div>
        <el-row :gutter="16">
          <el-col :span="8">
            <el-form-item label="配置名称" prop="name">
              <el-input v-model="form.name" placeholder="默认审核配置" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="模型名称" prop="modelName">
              <el-input v-model="form.modelName" placeholder="ark-code-latest" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="当前版本">
              <el-input :value="form.version ? `v${form.version}` : '-'" disabled />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="模型URL" prop="apiUrl">
          <el-input v-model="form.apiUrl" placeholder="https://ark.cn-beijing.volces.com/api/coding/v3" />
        </el-form-item>
        <el-form-item label="API Key">
          <el-input
            v-model="form.apiKey"
            type="password"
            show-password
            autocomplete="new-password"
            :placeholder="apiKeyPlaceholder"
          />
          <div class="form-tip">保存时留空则沿用当前已配置的 API Key；接口不会回显明文 Key。</div>
        </el-form-item>
      </div>

      <div class="config-section">
        <div class="section-title">审核提示词</div>
        <el-form-item label="提示词" prop="promptContent">
          <el-input
            v-model="form.promptContent"
            type="textarea"
            :rows="20"
            resize="vertical"
            placeholder="请输入报告审核规则、输出格式和检查点要求"
          />
        </el-form-item>
      </div>

      <div class="form-actions">
        <el-button type="primary" icon="el-icon-check" :loading="saving" @click="submitForm">保存为新版本</el-button>
        <el-button icon="el-icon-refresh" @click="loadActivePrompt">刷新</el-button>
      </div>
    </el-form>
  </div>
</template>

<script>
import { createPromptVersion, getActivePrompt } from '@/api/report-management/auditPrompt'

export default {
  name: 'ReportAuditPrompt',
  data() {
    return {
      saving: false,
      form: {
        name: '默认审核配置',
        apiUrl: 'https://ark.cn-beijing.volces.com/api/coding/v3',
        apiKey: '',
        apiKeyMasked: '',
        apiKeyConfigured: false,
        promptContent: '',
        version: '',
        modelName: 'ark-code-latest'
      },
      rules: {
        name: [{ required: true, message: '配置名称不能为空', trigger: 'blur' }],
        apiUrl: [{ required: true, message: '模型URL不能为空', trigger: 'blur' }],
        modelName: [{ required: true, message: '模型名称不能为空', trigger: 'blur' }],
        promptContent: [{ required: true, message: '提示词不能为空', trigger: 'blur' }]
      }
    }
  },
  computed: {
    apiKeyPlaceholder() {
      if (this.form.apiKeyConfigured && this.form.apiKeyMasked) {
        return `已配置：${this.form.apiKeyMasked}，留空沿用`
      }
      return '请输入 API Key'
    }
  },
  created() {
    this.loadActivePrompt()
  },
  methods: {
    loadActivePrompt() {
      getActivePrompt().then(response => {
        this.form = {
          name: response.name,
          apiUrl: response.apiUrl || 'https://ark.cn-beijing.volces.com/api/coding/v3',
          apiKey: '',
          apiKeyMasked: response.apiKeyMasked || '',
          apiKeyConfigured: Boolean(response.apiKeyConfigured),
          promptContent: response.promptContent,
          version: response.version,
          modelName: response.modelName
        }
      }).catch(() => {
        this.form.modelName = this.form.modelName || 'ark-code-latest'
      })
    },
    submitForm() {
      this.$refs.form.validate(valid => {
        if (!valid) return
        this.saving = true
        createPromptVersion({
          name: this.form.name,
          apiUrl: this.form.apiUrl,
          apiKey: this.form.apiKey,
          promptContent: this.form.promptContent,
          modelName: this.form.modelName
        }).then(response => {
          this.$modal.msgSuccess(`已保存为 v${response.version}`)
          this.form.version = response.version
          this.form.apiKey = ''
          this.form.apiKeyMasked = response.apiKeyMasked || ''
          this.form.apiKeyConfigured = Boolean(response.apiKeyConfigured)
        }).finally(() => {
          this.saving = false
        })
      })
    }
  }
}
</script>

<style scoped>
.audit-config-page {
  background: #f6f8fb;
  min-height: calc(100vh - 84px);
}

.config-form {
  background: #fff;
  border: 1px solid #e6ebf2;
  border-radius: 6px;
  padding: 18px 20px;
}

.config-section + .config-section {
  margin-top: 18px;
  padding-top: 18px;
  border-top: 1px solid #edf1f7;
}

.section-title {
  margin-bottom: 16px;
  color: #1f2d3d;
  font-size: 15px;
  font-weight: 600;
}

.form-tip {
  margin-top: 6px;
  color: #8492a6;
  font-size: 12px;
  line-height: 18px;
}

.form-actions {
  margin-top: 18px;
  padding-left: 110px;
}
</style>
