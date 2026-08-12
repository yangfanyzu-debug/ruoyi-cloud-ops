<template>
  <div class="audit-workbench">
    <header class="workbench-header">
      <div class="report-identity">
        <span class="identity-mark"><i class="el-icon-reading" /></span>
        <div>
          <h1>{{ conversation.title || 'AI审核工作台' }}</h1>
          <p>
            <span>{{ conversation.systemId || '-' }}</span>
            <span>{{ conversation.reportMonth || '-' }}</span>
            <span v-if="conversation.jiraId">{{ conversation.jiraId }}</span>
          </p>
        </div>
      </div>
      <div class="header-actions">
        <el-select v-model="selectedVersionId" size="small" class="version-select" @change="handleVersionChange">
          <el-option
            v-for="version in versions"
            :key="version.versionId"
            :label="`v${version.versionNo} · ${version.fileName}`"
            :value="version.versionId"
          />
        </el-select>
        <el-tooltip content="下载当前版本" placement="bottom">
          <el-button size="small" icon="el-icon-download" aria-label="下载当前版本" @click="downloadCurrent" />
        </el-tooltip>
        <el-tooltip content="刷新审核会话" placement="bottom">
          <el-button size="small" icon="el-icon-refresh" :loading="loading" aria-label="刷新审核会话" @click="loadConversation" />
        </el-tooltip>
      </div>
    </header>

    <main class="workbench-main">
      <section v-loading="documentLoading" class="document-pane">
        <vue-office-docx
          v-if="documentUrl"
          :key="selectedVersionId"
          :src="documentUrl"
          @rendered="documentLoading = false"
          @error="handleDocumentError"
        />
        <div v-else class="document-empty">请选择报告版本</div>
      </section>

      <aside class="conversation-pane">
        <div class="conversation-head">
          <div>
            <strong>审核记录与报告 Agent</strong>
            <span>{{ currentVersion ? `当前查看 v${currentVersion.versionNo}` : '请选择报告版本' }}</span>
          </div>
          <el-tag :type="statusType(currentVersion && currentVersion.auditStatus)" size="mini">
            {{ statusLabel(currentVersion && currentVersion.auditStatus) }}
          </el-tag>
        </div>

        <div ref="messages" v-loading="loading && !versions.length" class="conversation-scroll">
          <div v-if="!versions.length && !loading" class="conversation-empty">
            <i class="el-icon-chat-dot-square" />
            <span>暂无审核记录</span>
          </div>
          <div
            v-for="version in versions"
            :key="version.versionId"
            class="version-thread"
            :class="{ active: version.versionId === selectedVersionId }"
            @click="selectVersion(version.versionId)"
          >
            <div class="message message-user">
              <div class="message-avatar"><i :class="version.source === 'batch' ? 'el-icon-document-add' : 'el-icon-upload2'" /></div>
              <div class="message-content">
                <div class="message-meta">
                  <strong>{{ version.source === 'batch' ? '批次任务' : (version.uploader || '用户') }}</strong>
                  <span>{{ version.createTime }}</span>
                </div>
                <p>{{ version.source === 'batch' ? '生成初始报告' : '上传修订报告' }} v{{ version.versionNo }}</p>
                <small>{{ version.fileName }}</small>
              </div>
            </div>

            <div class="message message-ai">
              <div class="message-avatar ai-avatar">AI</div>
              <div class="message-content ai-content">
                <div class="message-meta">
                  <strong>AI审核助手</strong>
                  <span>{{ version.finishedAt || version.startedAt || '' }}</span>
                </div>
                <div v-if="isProcessing(version.auditStatus)" class="streaming-state">
                  <div class="typing-line"><i /><i /><i /></div>
                  <span>{{ version.auditStatus === 'pending' ? '等待后台审核任务' : '正在分析当前报告' }}</span>
                </div>
                <audit-markdown v-if="messageText(version)" :content="messageText(version)" />
                <el-alert
                  v-if="version.errorMessage"
                  :title="version.errorMessage"
                  type="error"
                  :closable="false"
                  show-icon
                />
                <div v-if="version.checkpointSnapshot && version.checkpointSnapshot.length" class="checkpoint-note">
                  本次使用 {{ version.checkpointSnapshot.length }} 个审核检查点
                </div>
              </div>
            </div>
          </div>

          <div v-if="currentVersion" class="agent-thread">
            <div class="agent-thread-title">
              <span>与报告 Agent 对话</span>
              <small>基于 v{{ currentVersion.versionNo }} 文档及审核结果</small>
            </div>
            <div v-if="!agentMessages.length" class="agent-empty">
              可继续追问问题原因、修改位置和推荐替换文本
            </div>
            <div
              v-for="message in agentMessages"
              :key="message.id"
              class="agent-message"
              :class="`agent-message-${message.role}`"
            >
              <div class="message-avatar" :class="{ 'ai-avatar': message.role === 'assistant' }">
                <span v-if="message.role === 'assistant'">AI</span>
                <i v-else class="el-icon-user" />
              </div>
              <div class="message-content" :class="{ 'ai-content': message.role === 'assistant' }">
                <div class="message-meta">
                  <strong>{{ message.role === 'assistant' ? '报告 Agent' : '用户' }}</strong>
                  <span>{{ message.finishedAt || message.createTime }}</span>
                </div>
                <div v-if="isAgentProcessing(message.status)" class="streaming-state">
                  <div class="typing-line"><i /><i /><i /></div>
                  <span>{{ message.status === 'pending' ? '等待 Agent 响应' : '正在生成回复' }}</span>
                </div>
                <audit-markdown v-if="message.content" :content="message.content" />
                <el-alert
                  v-if="message.errorMessage"
                  :title="message.errorMessage"
                  type="error"
                  :closable="false"
                  show-icon
                />
              </div>
            </div>
          </div>
        </div>

        <div class="agent-composer">
          <el-input
            v-model="agentQuestion"
            type="textarea"
            :rows="2"
            maxlength="2000"
            resize="none"
            placeholder="询问当前报告的问题、原因或修改建议"
            :disabled="!currentVersion || sendingMessage"
            @keydown.native.enter.exact.prevent="sendMessage"
          />
          <div class="composer-actions">
            <span>Enter 发送，Shift + Enter 换行</span>
            <el-button
              type="primary"
              size="mini"
              icon="el-icon-s-promotion"
              :loading="sendingMessage"
              :disabled="!agentQuestion.trim() || !currentVersion"
              @click="sendMessage"
            >发送</el-button>
          </div>
        </div>
      </aside>
    </main>
  </div>
</template>

<script>
import VueOfficeDocx from '@vue-office/docx'
import '@vue-office/docx/lib/index.css'
import AuditMarkdown from './AuditMarkdown.vue'
import {
  downloadUrl,
  getAgentMessages,
  getAuditConversation,
  getAuditEvents,
  previewUrl,
  sendAgentMessage
} from '@/api/report-management/report'

export default {
  name: 'ReportAuditWorkbench',
  components: { AuditMarkdown, VueOfficeDocx },
  data() {
    return {
      loading: false,
      documentLoading: true,
      conversation: {},
      selectedVersionId: null,
      streamText: {},
      agentMessages: [],
      agentProcessing: false,
      agentQuestion: '',
      sendingMessage: false,
      pollTimer: null
    }
  },
  computed: {
    versions() {
      return this.conversation.versions || []
    },
    currentVersion() {
      return this.versions.find(item => item.versionId === this.selectedVersionId) || null
    },
    documentUrl() {
      return this.selectedVersionId ? previewUrl(this.selectedVersionId) : ''
    },
    hasProcessing() {
      return this.agentProcessing || this.versions.some(item => this.isProcessing(item.auditStatus))
    }
  },
  created() {
    this.loadConversation(true)
  },
  beforeDestroy() {
    this.stopPolling()
  },
  methods: {
    loadConversation(initial = false) {
      this.loading = true
      getAuditConversation(this.$route.params.reportId).then(response => {
        this.conversation = response || {}
        if (initial) {
          const auditId = Number(this.$route.query.auditId)
          const target = this.versions.find(item => item.auditId === auditId) || this.versions[this.versions.length - 1]
          this.selectedVersionId = target ? target.versionId : null
        }
        return Promise.all([this.loadActiveStreams(), this.loadAgentMessages()])
      }).then(() => {
        if (this.hasProcessing) this.startPolling()
        else this.stopPolling()
      }).finally(() => {
        this.loading = false
      })
    },
    loadActiveStreams() {
      const active = this.versions.filter(item => this.isProcessing(item.auditStatus) && item.auditId)
      if (!active.length) return Promise.resolve()
      return Promise.all(active.map(version => getAuditEvents(version.auditId, 0).then(response => {
        this.$set(this.streamText, version.auditId, (response.events || [])
          .filter(event => event.type === 'model')
          .map(event => event.content)
          .join(''))
      }).catch(() => {})))
    },
    loadAgentMessages(scrollToBottom = false) {
      if (!this.selectedVersionId) {
        this.agentMessages = []
        this.agentProcessing = false
        return Promise.resolve()
      }
      return getAgentMessages(this.$route.params.reportId, this.selectedVersionId).then(response => {
        const previousContent = this.agentMessages.map(item => `${item.id}:${item.status}:${item.content}`).join('|')
        this.agentMessages = response.messages || []
        this.agentProcessing = Boolean(response.processing)
        const currentContent = this.agentMessages.map(item => `${item.id}:${item.status}:${item.content}`).join('|')
        if (scrollToBottom || previousContent !== currentContent) this.scrollMessagesToBottom()
      }).catch(() => {
        this.agentMessages = []
        this.agentProcessing = false
      })
    },
    startPolling() {
      if (this.pollTimer) return
      this.pollTimer = window.setInterval(() => this.loadConversation(), 1800)
    },
    stopPolling() {
      if (!this.pollTimer) return
      window.clearInterval(this.pollTimer)
      this.pollTimer = null
    },
    selectVersion(versionId) {
      if (this.selectedVersionId === versionId) return
      this.selectedVersionId = versionId
      this.handleVersionChange()
    },
    handleVersionChange() {
      this.documentLoading = true
      this.agentMessages = []
      this.agentProcessing = false
      this.loadAgentMessages(true).then(() => {
        if (this.hasProcessing) this.startPolling()
      })
    },
    sendMessage() {
      const content = this.agentQuestion.trim()
      if (!content || !this.selectedVersionId || this.sendingMessage) return
      this.sendingMessage = true
      sendAgentMessage(this.$route.params.reportId, this.selectedVersionId, content).then(() => {
        this.agentQuestion = ''
        this.agentProcessing = true
        this.startPolling()
        return this.loadAgentMessages(true)
      }).finally(() => {
        this.sendingMessage = false
      })
    },
    scrollMessagesToBottom() {
      this.$nextTick(() => {
        const container = this.$refs.messages
        if (container) container.scrollTop = container.scrollHeight
      })
    },
    messageText(version) {
      return version.resultText || this.streamText[version.auditId] || ''
    },
    downloadCurrent() {
      if (this.selectedVersionId) window.open(downloadUrl(this.selectedVersionId), '_blank')
    },
    handleDocumentError() {
      this.documentLoading = false
      this.$modal.msgError('当前报告版本预览失败')
    },
    isProcessing(status) {
      return ['pending', 'running'].includes(status)
    },
    isAgentProcessing(status) {
      return ['pending', 'running'].includes(status)
    },
    statusLabel(status) {
      return {
        pending: '等待审核', running: 'AI审核中', passed: '审核通过', failed: '审核不通过',
        completed: '审核完成', error: '审核失败'
      }[status] || '暂无审核'
    },
    statusType(status) {
      return { pending: 'info', running: 'warning', passed: 'success', failed: 'danger', completed: '', error: 'danger' }[status] || 'info'
    }
  }
}
</script>

<style scoped>
.audit-workbench { --line:#dfe5ec; --muted:#7b8794; display:flex; height:100vh; height:100dvh; min-width:1080px; min-height:0; flex-direction:column; overflow:hidden; box-sizing:border-box; background:#edf1f5; color:#25313d; }
.workbench-header { display:flex; align-items:center; flex:0 0 66px; justify-content:space-between; height:66px; padding:0 20px; box-sizing:border-box; background:#fff; border-bottom:1px solid var(--line); }
.report-identity { display:flex; align-items:center; min-width:0; gap:11px; }
.identity-mark { display:grid; flex:none; width:34px; height:34px; place-items:center; color:#1f6fb2; background:#eaf4fc; border:1px solid #cfe3f3; border-radius:5px; }
.report-identity h1 { max-width:680px; margin:0; overflow:hidden; color:#1f2d3d; font-size:16px; line-height:22px; text-overflow:ellipsis; white-space:nowrap; }
.report-identity p { display:flex; gap:14px; margin:3px 0 0; color:var(--muted); font-size:12px; }
.header-actions { display:flex; align-items:center; gap:7px; }
.header-actions /deep/ .el-button + .el-button { margin-left:0; }
.version-select { width:260px; }
.workbench-main { display:grid; flex:1 1 auto; grid-template-columns:minmax(620px, 1fr) 430px; min-height:0; overflow:hidden; gap:1px; background:var(--line); }
.document-pane { height:100%; min-width:0; min-height:0; overflow:auto; padding:14px 18px 32px; box-sizing:border-box; background:#e9edf2; }
.document-pane /deep/ .vue-office-docx { min-height:100%; }
.document-empty { display:grid; height:100%; place-items:center; color:var(--muted); }
.conversation-pane { display:flex; height:100%; min-width:0; min-height:0; flex-direction:column; overflow:hidden; box-sizing:border-box; background:#f7f9fb; }
.conversation-head { display:flex; align-items:center; flex:0 0 62px; justify-content:space-between; padding:0 16px; box-sizing:border-box; background:#fff; border-bottom:1px solid var(--line); }
.conversation-head strong,.conversation-head span { display:block; }
.conversation-head strong { font-size:14px; }
.conversation-head div > span { margin-top:4px; color:var(--muted); font-size:12px; }
.conversation-scroll { flex:1 1 auto; min-height:0; overflow-y:auto; padding:14px 15px 26px; box-sizing:border-box; scroll-behavior:smooth; }
.conversation-empty { display:flex; align-items:center; justify-content:center; flex-direction:column; height:100%; gap:8px; color:#9aa6b2; }
.conversation-empty i { font-size:30px; }
.version-thread { position:relative; padding:10px 8px 6px 13px; margin-bottom:8px; border-left:2px solid #dce4ec; cursor:pointer; transition:background .16s,border-color .16s; }
.version-thread:hover { background:#f1f5f8; border-left-color:#9bbbd5; }
.version-thread.active { background:#fff; border-left-color:#409eff; box-shadow:0 1px 5px rgba(43,91,132,.07); }
.message { display:flex; align-items:flex-start; gap:9px; margin-bottom:13px; }
.message-avatar { display:grid; flex:none; width:28px; height:28px; place-items:center; color:#60758a; background:#fff; border:1px solid #dce4ec; border-radius:50%; font-size:12px; }
.message-content { min-width:0; flex:1; padding:10px 12px; background:#fff; border:1px solid #e1e7ee; border-radius:2px 6px 6px 6px; box-shadow:0 1px 2px rgba(35,54,72,.03); }
.message-meta { display:flex; align-items:center; justify-content:space-between; gap:8px; color:#8995a2; font-size:11px; }
.message-meta strong { color:#52616f; font-size:12px; }
.message-content p { margin:7px 0 3px; font-size:13px; }
.message-content small { display:block; overflow:hidden; color:var(--muted); font-size:11px; text-overflow:ellipsis; white-space:nowrap; }
.message-ai { margin-left:20px; margin-bottom:8px; }
.ai-avatar { color:#fff; background:#2879bc; border-color:#2879bc; font-weight:600; }
.ai-content { background:#f2f7fb; border-color:#cfdfec; }
.ai-content /deep/ .audit-markdown { margin-top:9px; }
.streaming-state { display:flex; align-items:center; gap:9px; margin-top:9px; color:#5d7184; font-size:12px; }
.typing-line { display:inline-flex; gap:3px; }
.typing-line i { width:5px; height:5px; background:#409eff; border-radius:50%; animation:typing 1.1s ease-in-out infinite; }
.typing-line i:nth-child(2) { animation-delay:.14s; }.typing-line i:nth-child(3) { animation-delay:.28s; }
.checkpoint-note { margin-top:10px; padding-top:8px; color:#7e8c99; border-top:1px solid #d7e5f0; font-size:11px; }
.agent-thread { padding-top:6px; margin-top:12px; border-top:1px solid #dfe5ec; }
.agent-thread-title { display:flex; align-items:baseline; justify-content:space-between; gap:10px; padding:14px 3px 12px; }
.agent-thread-title span { color:#344454; font-size:13px; font-weight:600; }
.agent-thread-title small { color:#8995a2; font-size:11px; }
.agent-empty { padding:18px 12px; margin-bottom:12px; color:#8794a1; background:#fff; border:1px dashed #d7e0e9; border-radius:5px; font-size:12px; text-align:center; }
.agent-message { display:flex; align-items:flex-start; gap:9px; margin-bottom:15px; }
.agent-message .message-content { max-width:calc(100% - 38px); }
.agent-message-user { padding-left:42px; flex-direction:row-reverse; }
.agent-message-user .message-content { background:#eaf4ff; border-color:#bdd8f0; border-radius:6px 2px 6px 6px; }
.agent-message-user .message-meta { flex-direction:row-reverse; }
.agent-message-assistant .message-content { border-radius:2px 6px 6px 6px; }
.agent-composer { flex:0 0 auto; padding:11px 13px 10px; box-sizing:border-box; background:#fff; border-top:1px solid var(--line); box-shadow:0 -2px 8px rgba(42,60,76,.04); }
.agent-composer /deep/ .el-textarea__inner { min-height:54px!important; padding:8px 10px; border-radius:5px; font-family:inherit; line-height:19px; }
.composer-actions { display:flex; align-items:center; justify-content:space-between; margin-top:7px; }
.composer-actions > span { color:#9aa6b2; font-size:11px; }
@keyframes typing { 0%,60%,100% { opacity:.35; transform:translateY(0); } 30% { opacity:1; transform:translateY(-3px); } }
@media (max-width:1280px) { .workbench-main { grid-template-columns:minmax(600px,1fr) 390px; } .report-identity h1 { max-width:520px; } }
@media (prefers-reduced-motion:reduce) { .typing-line i { animation:none; } }
</style>
