<template>
  <el-dialog
    title="AI审核过程"
    :visible.sync="visible"
    width="760px"
    class="audit-process-dialog"
    append-to-body
    @closed="stopPolling"
  >
    <div class="process-head">
      <div class="process-state">
        <span class="process-orbit" :class="{ stopped: !running }"><i /></span>
        <div>
          <strong>{{ statusTitle }}</strong>
          <span>{{ statusHint }}</span>
        </div>
      </div>
      <el-tag :type="statusType" size="mini">{{ statusLabel }}</el-tag>
    </div>

    <div ref="messages" class="process-messages">
      <div v-if="!messages.length" class="process-empty">
        <span class="typing-dots" aria-hidden="true"><i /><i /><i /></span>
        正在获取审核进度
      </div>
      <div
        v-for="message in messages"
        :key="message.key"
        class="process-message"
        :class="`message-${message.type}`"
      >
        <div class="message-avatar">
          <i :class="messageIcon(message.type)" />
        </div>
        <div class="message-body">
          <div class="message-meta">
            <strong>{{ messageTitle(message.type) }}</strong>
            <span>{{ message.createTime || '' }}</span>
          </div>
          <pre>{{ message.content }}</pre>
        </div>
      </div>
      <div v-if="running" class="process-typing">
        <span /><span /><span />
      </div>
    </div>

    <el-alert
      v-if="audit.errorMessage"
      :title="audit.errorMessage"
      type="error"
      show-icon
      :closable="false"
    />
    <div slot="footer" class="dialog-footer">
      <el-button
        v-if="!running && audit.id"
        type="primary"
        size="mini"
        icon="el-icon-reading"
        @click="showResult"
      >查看审核结果</el-button>
      <el-button size="mini" @click="visible = false">关闭</el-button>
    </div>
  </el-dialog>
</template>

<script>
import { getAuditEvents } from '@/api/report-management/report'

export default {
  name: 'AuditProcessDialog',
  data() {
    return {
      visible: false,
      audit: {},
      events: [],
      lastEventId: 0,
      pollTimer: null
    }
  },
  computed: {
    running() {
      return ['pending', 'running'].includes(this.audit.status)
    },
    statusTitle() {
      return this.audit.status === 'pending' ? '等待AI审核' : this.running ? 'AI正在分析报告' : '审核处理已结束'
    },
    statusHint() {
      return this.audit.status === 'pending'
        ? '任务已进入队列，后台处理后会自动更新'
        : this.running
          ? '正在解析报告并生成结构化审核结论'
          : '可查看完整检查点与修改建议'
    },
    statusLabel() {
      return {
        pending: '待审核',
        running: '审核中',
        passed: '审核通过',
        failed: '审核不通过',
        error: '审核失败'
      }[this.audit.status] || '待审核'
    },
    statusType() {
      return {
        pending: 'info',
        running: 'warning',
        passed: 'success',
        failed: 'danger',
        error: 'danger'
      }[this.audit.status] || 'info'
    },
    messages() {
      const messages = []
      this.events.forEach(event => {
        const previous = messages[messages.length - 1]
        if (event.type === 'model' && previous && previous.type === 'model') {
          previous.content += event.content
          previous.createTime = event.createTime || previous.createTime
          previous.key = `${previous.key}-${event.id}`
        } else {
          messages.push({ ...event, key: String(event.id) })
        }
      })
      return messages
    }
  },
  beforeDestroy() {
    this.stopPolling()
  },
  methods: {
    open(auditId) {
      this.stopPolling()
      this.audit = { id: auditId, status: 'pending', errorMessage: null }
      this.events = []
      this.lastEventId = 0
      this.visible = true
      this.fetchEvents(true)
    },
    fetchEvents(initial = false) {
      const auditId = this.audit.id
      if (!auditId || !this.visible) return
      getAuditEvents(auditId, initial ? 0 : this.lastEventId).then(response => {
        const events = response.events || []
        if (initial) this.events = []
        if (events.length) {
          this.events.push(...events)
          this.lastEventId = response.lastEventId || this.lastEventId
          this.$nextTick(this.scrollToBottom)
        }
        this.audit = {
          id: auditId,
          status: response.status,
          finishedAt: response.finishedAt,
          errorMessage: response.errorMessage
        }
        if (this.running) {
          this.startPolling()
        } else {
          this.stopPolling()
          this.$emit('completed', auditId)
        }
      }).catch(this.stopPolling)
    },
    startPolling() {
      if (this.pollTimer) return
      this.pollTimer = window.setInterval(() => this.fetchEvents(), 1200)
    },
    stopPolling() {
      if (!this.pollTimer) return
      window.clearInterval(this.pollTimer)
      this.pollTimer = null
    },
    scrollToBottom() {
      const container = this.$refs.messages
      if (container) container.scrollTop = container.scrollHeight
    },
    showResult() {
      this.visible = false
      this.$emit('show-result', this.audit.id)
    },
    messageTitle(type) {
      return type === 'model' ? 'AI 分析输出' : type === 'error' ? '执行异常' : '审核进度'
    },
    messageIcon(type) {
      return type === 'model' ? 'el-icon-cpu' : type === 'error' ? 'el-icon-warning-outline' : 'el-icon-finished'
    }
  }
}
</script>

<style scoped>
.process-head { display:flex; align-items:center; justify-content:space-between; padding:12px 14px; margin-bottom:12px; background:#f8fafc; border:1px solid #e6ebf2; border-radius:6px; }
.process-state { display:flex; align-items:center; gap:12px; }
.process-state strong,.process-state span { display:block; }
.process-state strong { color:#1f2d3d; font-size:14px; }
.process-state div > span { margin-top:4px; color:#8492a6; font-size:12px; }
.process-orbit { position:relative; width:30px; height:30px; border:1px solid #b8d4f0; border-radius:50%; animation:audit-orbit 1.8s linear infinite; }
.process-orbit::before,.process-orbit i { position:absolute; border-radius:50%; content:''; }
.process-orbit::before { inset:8px; background:#409eff; }
.process-orbit i { top:-3px; left:11px; width:7px; height:7px; background:#e6a23c; }
.process-orbit.stopped { animation:none; border-color:#b9ddc8; }
.process-orbit.stopped::before { background:#67c23a; }
.process-messages { height:420px; padding:16px; overflow-y:auto; background:#f5f7fa; border:1px solid #e6ebf2; border-radius:6px; scroll-behavior:smooth; }
.process-empty { display:flex; align-items:center; justify-content:center; gap:10px; height:100%; color:#8492a6; font-size:13px; }
.process-message { display:flex; align-items:flex-start; gap:10px; margin-bottom:14px; }
.message-avatar { display:grid; flex:none; width:30px; height:30px; place-items:center; color:#52616f; background:#fff; border:1px solid #dce3eb; border-radius:50%; }
.message-body { min-width:0; max-width:calc(100% - 40px); padding:10px 12px; background:#fff; border:1px solid #e1e7ee; border-radius:2px 6px 6px 6px; }
.message-model .message-avatar { color:#236eb5; background:#edf6ff; border-color:#c6def5; }
.message-model .message-body { background:#edf6ff; border-color:#c6def5; }
.message-error .message-avatar,.message-error .message-body { color:#c45656; background:#fef0f0; border-color:#f5c6c6; }
.message-meta { display:flex; align-items:center; justify-content:space-between; gap:16px; margin-bottom:7px; }
.message-meta strong { color:#52616f; font-size:12px; }
.message-meta span { color:#a3afbf; font-size:11px; }
.message-body pre { margin:0; color:#303a45; font-family:inherit; font-size:13px; line-height:21px; overflow-wrap:anywhere; white-space:pre-wrap; }
.typing-dots,.process-typing { display:inline-flex; gap:4px; color:#409eff; }
.process-typing { padding:9px 12px; margin-left:40px; background:#edf6ff; border:1px solid #c6def5; border-radius:4px; }
.typing-dots i,.process-typing span { width:5px; height:5px; background:currentColor; border-radius:50%; animation:audit-dot 1.2s ease-in-out infinite; }
.typing-dots i:nth-child(2),.process-typing span:nth-child(2) { animation-delay:.16s; }
.typing-dots i:nth-child(3),.process-typing span:nth-child(3) { animation-delay:.32s; }
@keyframes audit-dot { 0%,60%,100% { opacity:.35; transform:translateY(0); } 30% { opacity:1; transform:translateY(-3px); } }
@keyframes audit-orbit { to { transform:rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .typing-dots i,.process-typing span,.process-orbit { animation:none; } }
</style>
