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
            <strong>AI审核记录</strong>
            <span>共 {{ versions.length }} 个报告版本</span>
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
                <pre v-if="messageText(version)" class="audit-text">{{ messageText(version) }}</pre>
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
        </div>
      </aside>
    </main>
  </div>
</template>

<script>
import VueOfficeDocx from '@vue-office/docx'
import '@vue-office/docx/lib/index.css'
import { downloadUrl, getAuditConversation, getAuditEvents, previewUrl } from '@/api/report-management/report'

export default {
  name: 'ReportAuditWorkbench',
  components: { VueOfficeDocx },
  data() {
    return {
      loading: false,
      documentLoading: true,
      conversation: {},
      selectedVersionId: null,
      streamText: {},
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
      return this.versions.some(item => this.isProcessing(item.auditStatus))
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
        return this.loadActiveStreams()
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
.audit-workbench { --line:#dfe5ec; --muted:#7b8794; min-width:1080px; min-height:100vh; background:#edf1f5; color:#25313d; }
.workbench-header { display:flex; align-items:center; justify-content:space-between; height:66px; padding:0 20px; background:#fff; border-bottom:1px solid var(--line); }
.report-identity { display:flex; align-items:center; min-width:0; gap:11px; }
.identity-mark { display:grid; flex:none; width:34px; height:34px; place-items:center; color:#1f6fb2; background:#eaf4fc; border:1px solid #cfe3f3; border-radius:5px; }
.report-identity h1 { max-width:680px; margin:0; overflow:hidden; color:#1f2d3d; font-size:16px; line-height:22px; text-overflow:ellipsis; white-space:nowrap; }
.report-identity p { display:flex; gap:14px; margin:3px 0 0; color:var(--muted); font-size:12px; }
.header-actions { display:flex; align-items:center; gap:7px; }
.header-actions /deep/ .el-button + .el-button { margin-left:0; }
.version-select { width:260px; }
.workbench-main { display:grid; grid-template-columns:minmax(620px, 1fr) 430px; height:calc(100vh - 66px); gap:1px; background:var(--line); }
.document-pane { min-width:0; overflow:auto; padding:14px 18px 32px; background:#e9edf2; }
.document-pane /deep/ .vue-office-docx { min-height:100%; }
.document-empty { display:grid; height:100%; place-items:center; color:var(--muted); }
.conversation-pane { display:flex; min-width:0; flex-direction:column; background:#f7f9fb; }
.conversation-head { display:flex; align-items:center; justify-content:space-between; min-height:62px; padding:0 16px; background:#fff; border-bottom:1px solid var(--line); }
.conversation-head strong,.conversation-head span { display:block; }
.conversation-head strong { font-size:14px; }
.conversation-head div > span { margin-top:4px; color:var(--muted); font-size:12px; }
.conversation-scroll { flex:1; overflow-y:auto; padding:18px 16px 36px; scroll-behavior:smooth; }
.conversation-empty { display:flex; align-items:center; justify-content:center; flex-direction:column; height:100%; gap:8px; color:#9aa6b2; }
.conversation-empty i { font-size:30px; }
.version-thread { padding:12px 10px 4px; margin-bottom:14px; border:1px solid transparent; border-radius:6px; cursor:pointer; transition:background .16s,border-color .16s; }
.version-thread:hover { background:#fff; border-color:#dfe7ef; }
.version-thread.active { background:#fff; border-color:#9bc4e7; box-shadow:0 2px 9px rgba(43,91,132,.08); }
.message { display:flex; align-items:flex-start; gap:9px; margin-bottom:13px; }
.message-avatar { display:grid; flex:none; width:28px; height:28px; place-items:center; color:#60758a; background:#fff; border:1px solid #dce4ec; border-radius:50%; font-size:12px; }
.message-content { min-width:0; flex:1; padding:9px 11px; background:#fff; border:1px solid #e1e7ee; border-radius:2px 6px 6px 6px; }
.message-meta { display:flex; align-items:center; justify-content:space-between; gap:8px; color:#8995a2; font-size:11px; }
.message-meta strong { color:#52616f; font-size:12px; }
.message-content p { margin:7px 0 3px; font-size:13px; }
.message-content small { display:block; overflow:hidden; color:var(--muted); font-size:11px; text-overflow:ellipsis; white-space:nowrap; }
.message-ai { margin-left:20px; }
.ai-avatar { color:#fff; background:#2879bc; border-color:#2879bc; font-weight:600; }
.ai-content { background:#eef6fc; border-color:#cfe2f2; }
.audit-text { margin:8px 0 0; color:#303a45; font-family:inherit; font-size:13px; line-height:21px; overflow-wrap:anywhere; white-space:pre-wrap; }
.streaming-state { display:flex; align-items:center; gap:9px; margin-top:9px; color:#5d7184; font-size:12px; }
.typing-line { display:inline-flex; gap:3px; }
.typing-line i { width:5px; height:5px; background:#409eff; border-radius:50%; animation:typing 1.1s ease-in-out infinite; }
.typing-line i:nth-child(2) { animation-delay:.14s; }.typing-line i:nth-child(3) { animation-delay:.28s; }
.checkpoint-note { margin-top:10px; padding-top:8px; color:#7e8c99; border-top:1px solid #d7e5f0; font-size:11px; }
@keyframes typing { 0%,60%,100% { opacity:.35; transform:translateY(0); } 30% { opacity:1; transform:translateY(-3px); } }
@media (max-width:1280px) { .workbench-main { grid-template-columns:minmax(600px,1fr) 390px; } .report-identity h1 { max-width:520px; } }
@media (prefers-reduced-motion:reduce) { .typing-line i { animation:none; } }
</style>
