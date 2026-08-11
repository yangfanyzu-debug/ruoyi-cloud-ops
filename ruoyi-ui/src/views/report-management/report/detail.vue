<template>
  <div class="app-container report-detail-page">
    <div class="detail-header">
      <el-button icon="el-icon-arrow-left" size="mini" @click="goBack">返回</el-button>
      <div class="detail-title-wrap">
        <div class="detail-title">{{ report.title || '报告详情' }}</div>
        <div class="detail-meta">
          <span>{{ report.systemId || '-' }}</span>
          <span>{{ report.reportMonth || '-' }}</span>
          <span>{{ report.createTime || '-' }}</span>
        </div>
      </div>
      <el-button class="detail-refresh" size="mini" icon="el-icon-refresh" @click="getDetail()">刷新</el-button>
    </div>

    <div class="version-summary">
      <div class="summary-item">
        <span class="summary-label">版本数</span>
        <strong>{{ versions.length }}</strong>
      </div>
      <div class="summary-item">
        <span class="summary-label">最新版本</span>
        <strong>{{ latestVersion ? `v${latestVersion.versionNo}` : '-' }}</strong>
      </div>
      <div class="summary-item">
        <span class="summary-label">最新状态</span>
        <el-tag v-if="latestVersion" :type="statusType(latestVersion.auditStatus)" size="small">
          {{ statusLabel(latestVersion.auditStatus) }}
        </el-tag>
        <strong v-else>-</strong>
      </div>
    </div>

    <el-table v-loading="loading" :data="versions" class="version-table" border>
      <el-table-column label="版本" width="110">
        <template slot-scope="scope">
          <el-tag size="small" effect="plain">v{{ scope.row.versionNo }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="文件" min-width="300">
        <template slot-scope="scope">
          <div class="file-name">{{ scope.row.fileName }}</div>
          <div class="file-meta">
            <span>{{ scope.row.versionType === 'initial' ? '初始版本' : '上传版本' }}</span>
            <span>{{ formatSize(scope.row.fileSize) }}</span>
            <span>{{ scope.row.uploader || '-' }}</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="审核" width="150">
        <template slot-scope="scope">
          <el-tag :type="statusType(scope.row.auditStatus)" size="small">
            {{ statusLabel(scope.row.auditStatus) }}
          </el-tag>
          <div class="audit-conclusion">{{ scope.row.latestAuditConclusion || '-' }}</div>
        </template>
      </el-table-column>
      <el-table-column label="创建时间" prop="createTime" width="170" />
      <el-table-column label="操作" width="280" fixed="right">
        <template slot-scope="scope">
          <el-button size="mini" type="primary" plain icon="el-icon-document" @click="openPreview(scope.row.id)">预览</el-button>
          <el-button size="mini" icon="el-icon-download" @click="downloadVersion(scope.row.id)">下载</el-button>
          <el-button
            size="mini"
            icon="el-icon-reading"
            :disabled="!scope.row.latestAuditId"
            @click="openAudit(scope.row.latestAuditId)"
          >审核</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog title="审核详情" :visible.sync="auditDialogVisible" width="820px" append-to-body>
      <div v-if="audit.id" class="audit-summary">
        <div>
          <span class="summary-label">状态</span>
          <el-tag :type="statusType(audit.status)" size="small">{{ statusLabel(audit.status) }}</el-tag>
        </div>
        <div>
          <span class="summary-label">结论</span>
          <strong>{{ audit.summary && audit.summary['结论'] || '-' }}</strong>
        </div>
        <div>
          <span class="summary-label">问题数</span>
          <strong>{{ audit.summary && audit.summary['问题数量'] }}</strong>
        </div>
        <div>
          <span class="summary-label">模型</span>
          <strong>{{ audit.modelName || '-' }}</strong>
        </div>
      </div>

      <div v-if="audit.summary" class="audit-suggestion">
        {{ audit.summary['建议'] || '无明显问题' }}
      </div>
      <el-alert v-if="audit.errorMessage" :title="audit.errorMessage" type="error" show-icon :closable="false" />

      <el-table class="audit-table" :data="auditRows" border>
        <el-table-column label="检查点" prop="检查点" min-width="260" show-overflow-tooltip />
        <el-table-column label="分析结果" prop="分析结果" min-width="400" show-overflow-tooltip />
      </el-table>
    </el-dialog>
  </div>
</template>

<script>
import { downloadUrl, getAudit, getReport } from '@/api/report-management/report'

export default {
  name: 'ReportManagementDetail',
  data() {
    return {
      loading: false,
      report: {},
      auditDialogVisible: false,
      audit: {},
      pollTimer: null
    }
  },
  computed: {
    versions() {
      return this.report.versions || []
    },
    latestVersion() {
      return this.versions.length ? this.versions[this.versions.length - 1] : null
    },
    auditRows() {
      return (this.audit.resultData && this.audit.resultData.data) || []
    }
  },
  created() {
    this.getDetail()
  },
  beforeDestroy() {
    this.stopPolling()
  },
  methods: {
    getDetail(silent = false) {
      if (!silent) this.loading = true
      getReport(this.$route.params.id).then(response => {
        this.report = response
        this.updatePolling()
      }).finally(() => {
        if (!silent) this.loading = false
      })
    },
    updatePolling() {
      const hasProcessing = this.versions.some(item => ['pending', 'running'].includes(item.auditStatus))
      if (hasProcessing) {
        this.startPolling()
      } else {
        this.stopPolling()
      }
    },
    startPolling() {
      if (this.pollTimer) return
      this.pollTimer = window.setInterval(() => {
        this.getDetail(true)
      }, 10000)
    },
    stopPolling() {
      if (!this.pollTimer) return
      window.clearInterval(this.pollTimer)
      this.pollTimer = null
    },
    goBack() {
      this.$router.push({ path: '/report-management/reports' })
    },
    openPreview(versionId) {
      const route = this.$router.resolve({ path: `/report-management/preview/${versionId}` })
      window.open(route.href, '_blank')
    },
    downloadVersion(versionId) {
      window.open(downloadUrl(versionId), '_blank')
    },
    openAudit(auditId) {
      getAudit(auditId).then(response => {
        this.audit = response
        this.auditDialogVisible = true
      })
    },
    formatSize(size) {
      if (!size) return '0 B'
      if (size < 1024) return `${size} B`
      if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
      return `${(size / 1024 / 1024).toFixed(1)} MB`
    },
    statusLabel(status) {
      return {
        pending: '待审核',
        running: '审核中',
        passed: '审核通过',
        failed: '审核不通过',
        error: '审核失败'
      }[status] || '待审核'
    },
    statusType(status) {
      return {
        pending: 'info',
        running: 'warning',
        passed: 'success',
        failed: 'danger',
        error: 'danger'
      }[status] || 'info'
    }
  }
}
</script>

<style scoped>
.report-detail-page {
  background: #f6f8fb;
  min-height: calc(100vh - 84px);
}

.detail-header,
.version-summary,
.version-table {
  background: #fff;
  border: 1px solid #e6ebf2;
  border-radius: 6px;
}

.detail-header {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 18px 20px;
}

.detail-title-wrap {
  min-width: 0;
  flex: 1;
}

.detail-refresh {
  flex: none;
}

.detail-title {
  color: #1f2d3d;
  font-size: 18px;
  font-weight: 600;
}

.detail-meta,
.file-meta {
  display: flex;
  gap: 12px;
  margin-top: 7px;
  color: #8492a6;
  font-size: 12px;
}

.version-summary {
  display: grid;
  grid-template-columns: repeat(3, minmax(140px, 1fr));
  gap: 12px;
  margin: 14px 0;
  padding: 16px 20px;
}

.summary-item {
  display: flex;
  align-items: center;
  gap: 12px;
}

.summary-label {
  color: #8492a6;
  font-size: 12px;
}

.summary-item strong {
  color: #1f2d3d;
  font-size: 18px;
}

.file-name {
  color: #1f2d3d;
  font-weight: 600;
}

.audit-conclusion {
  margin-top: 8px;
  color: #606266;
  font-size: 12px;
}

.audit-summary {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 14px;
}

.audit-summary > div,
.audit-suggestion {
  background: #f6f8fb;
  border-radius: 6px;
  padding: 12px;
}

.audit-summary strong {
  display: block;
  margin-top: 8px;
  color: #1f2d3d;
}

.audit-suggestion {
  margin-bottom: 14px;
  color: #606266;
  line-height: 22px;
}

.audit-table {
  margin-top: 14px;
}
</style>
