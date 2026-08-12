<template>
  <div class="app-container report-page">
    <div class="filter-panel">
      <div class="filter-main">
        <el-form ref="queryForm" :model="queryParams" size="small" :inline="true" label-width="68px">
          <el-form-item label="系统编码" prop="systemId">
            <el-input
              v-model="queryParams.systemId"
              class="filter-input"
              placeholder="系统编码"
              clearable
              prefix-icon="el-icon-cpu"
              @keyup.enter.native="handleQuery"
            />
          </el-form-item>
          <el-form-item label="报告标题" prop="title">
            <el-input
              v-model="queryParams.title"
              class="filter-title"
              placeholder="标题关键字"
              clearable
              prefix-icon="el-icon-document"
              @keyup.enter.native="handleQuery"
            />
          </el-form-item>
          <el-form-item label="报表月份" prop="reportMonth">
            <el-date-picker
              v-model="reportMonthValue"
              class="filter-input"
              type="month"
              value-format="yyyy年MM月"
              placeholder="月份"
              clearable
              @change="handleMonthChange"
            />
          </el-form-item>
          <el-form-item label="审核状态" prop="auditStatus">
            <el-select v-model="queryParams.auditStatus" class="filter-status" placeholder="全部状态" clearable>
              <el-option label="待审核" value="pending" />
              <el-option label="审核中" value="running" />
              <el-option label="审核通过" value="passed" />
              <el-option label="审核不通过" value="failed" />
              <el-option label="审核失败" value="error" />
            </el-select>
          </el-form-item>
          <el-form-item>
            <el-button type="primary" icon="el-icon-search" size="mini" @click="handleQuery">查询</el-button>
            <el-button icon="el-icon-refresh-left" size="mini" @click="resetQuery">重置</el-button>
            <el-button icon="el-icon-refresh" size="mini" @click="getList">刷新</el-button>
          </el-form-item>
        </el-form>
      </div>
    </div>

    <el-table v-loading="loading" :data="reportList" class="report-table" border :row-class-name="tableRowClassName">
      <el-table-column label="报告信息" min-width="460">
        <template slot-scope="scope">
          <div class="report-cell">
            <div class="report-name" @click="openDetail(scope.row)">{{ scope.row.title }}</div>
            <div class="report-meta">
              <span><i class="el-icon-cpu" /> {{ scope.row.systemId || '-' }}</span>
              <span><i class="el-icon-date" /> {{ scope.row.reportMonth || '-' }}</span>
              <span><i class="el-icon-time" /> {{ scope.row.createTime || '-' }}</span>
            </div>
            <div class="jira-line">
              <span class="jira-label">JIRA</span>
              <el-tag v-if="scope.row.jiraId" size="mini" effect="plain">{{ scope.row.jiraId }}</el-tag>
              <span v-else class="empty-text">未关联</span>
            </div>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="版本" width="92" align="center">
        <template slot-scope="scope">
          <el-tag size="mini" effect="plain">{{ scope.row.latestVersionNo ? `v${scope.row.latestVersionNo}` : '-' }}</el-tag>
          <div class="version-type">{{ versionTypeLabel(scope.row.latestVersionType) }}</div>
        </template>
      </el-table-column>
      <el-table-column label="审核" width="210">
        <template slot-scope="scope">
          <div class="audit-brief">
            <el-tag :type="statusType(scope.row.latestAuditStatus)" size="mini">
              {{ statusLabel(scope.row.latestAuditStatus) }}
            </el-tag>
            <span class="audit-conclusion">{{ scope.row.latestAuditConclusion || statusHint(scope.row.latestAuditStatus) }}</span>
            <el-button
              v-if="scope.row.latestAuditId"
              type="text"
              size="mini"
              class="suggestion-link"
              @click="openDetail(scope.row)"
            >
              审核结果
            </el-button>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="248">
        <template slot-scope="scope">
          <div class="row-actions">
            <el-button size="mini" type="primary" plain icon="el-icon-view" @click="openDetail(scope.row)">详情</el-button>
            <el-button size="mini" icon="el-icon-document" :disabled="!scope.row.latestVersionId" @click="openPreview(scope.row.latestVersionId)">预览</el-button>
            <el-button size="mini" icon="el-icon-download" :disabled="!scope.row.latestVersionId" @click="downloadVersion(scope.row.latestVersionId)">下载</el-button>
            <el-button size="mini" icon="el-icon-upload2" @click="openUpload(scope.row)">上传</el-button>
          </div>
        </template>
      </el-table-column>
    </el-table>

    <pagination
      v-show="total > 0"
      :total="total"
      :page.sync="queryParams.pageNum"
      :limit.sync="queryParams.pageSize"
      @pagination="getList"
    />

    <el-dialog title="上传新版本" :visible.sync="uploadDialogVisible" width="560px" append-to-body>
      <div class="upload-target">
        <div class="upload-target-title">{{ currentReport.title }}</div>
        <div class="upload-target-meta">{{ currentReport.systemId }} / {{ currentReport.reportMonth }}</div>
      </div>
      <el-form label-width="76px" size="small">
        <el-form-item label="上传人">
          <el-input v-model="uploadForm.uploader" placeholder="默认未知用户" />
        </el-form-item>
        <el-form-item label="文件">
          <el-upload
            ref="upload"
            drag
            :auto-upload="false"
            :limit="1"
            accept=".docx"
            action=""
            :http-request="submitUploadRequest"
            :on-change="handleFileChange"
            :on-remove="handleFileRemove"
          >
            <i class="el-icon-upload" />
            <div class="el-upload__text">拖入 DOCX，或点击选择</div>
          </el-upload>
        </el-form-item>
      </el-form>
      <div slot="footer" class="dialog-footer">
        <el-button @click="uploadDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="uploading" @click="submitUpload">上传并审核</el-button>
      </div>
    </el-dialog>

    <el-dialog
      :title="detailReport.title || '报告详情'"
      :visible.sync="detailDialogVisible"
      width="980px"
      class="report-detail-dialog"
      append-to-body
    >
      <div v-loading="detailLoading">
        <div class="detail-strip">
          <div>
            <span class="detail-label">系统编码</span>
            <strong>{{ detailReport.systemId || '-' }}</strong>
          </div>
          <div>
            <span class="detail-label">报表月份</span>
            <strong>{{ detailReport.reportMonth || '-' }}</strong>
          </div>
          <div>
            <span class="detail-label">创建时间</span>
            <strong>{{ detailReport.createTime || '-' }}</strong>
          </div>
          <div>
            <span class="detail-label">JIRA</span>
            <strong>{{ detailReport.jiraId || '未关联' }}</strong>
          </div>
        </div>

        <el-table :data="detailVersions" class="detail-version-table" border>
          <el-table-column label="版本" width="86" align="center">
            <template slot-scope="scope">
              <el-tag size="mini" effect="plain">v{{ scope.row.versionNo }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="报告文件" min-width="300">
            <template slot-scope="scope">
              <div class="file-name">{{ scope.row.fileName }}</div>
              <div class="file-meta">
                <span>{{ versionTypeLabel(scope.row.versionType) }}</span>
                <span>{{ formatSize(scope.row.fileSize) }}</span>
                <span>{{ scope.row.uploader || '-' }}</span>
                <span>{{ scope.row.createTime || '-' }}</span>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="审核" width="210">
            <template slot-scope="scope">
              <div class="audit-brief">
                <el-tag :type="statusType(scope.row.auditStatus)" size="mini">
                  {{ statusLabel(scope.row.auditStatus) }}
                </el-tag>
                <span class="audit-conclusion">{{ scope.row.latestAuditConclusion || statusHint(scope.row.auditStatus) }}</span>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="260">
            <template slot-scope="scope">
              <div class="row-actions compact-actions">
                <el-button size="mini" icon="el-icon-document" @click="openPreview(scope.row.id)">预览</el-button>
                <el-button size="mini" icon="el-icon-download" @click="downloadVersion(scope.row.id)">下载</el-button>
                <el-button
                  size="mini"
                  icon="el-icon-reading"
                  :disabled="!scope.row.latestAuditId"
                  @click="openAudit(scope.row.latestAuditId)"
                >审核结果</el-button>
              </div>
            </template>
          </el-table-column>
        </el-table>
      </div>
      <div slot="footer" class="dialog-footer">
        <el-button size="mini" icon="el-icon-refresh" @click="refreshDetail">刷新</el-button>
        <el-button size="mini" @click="detailDialogVisible = false">关闭</el-button>
      </div>
    </el-dialog>

    <el-dialog title="审核详情" :visible.sync="auditDialogVisible" width="820px" append-to-body>
      <div v-if="audit.id" class="audit-summary">
        <div>
          <span class="detail-label">状态</span>
          <el-tag :type="statusType(audit.status)" size="mini">{{ statusLabel(audit.status) }}</el-tag>
        </div>
        <div>
          <span class="detail-label">结论</span>
          <strong>{{ audit.summary && audit.summary['结论'] || '-' }}</strong>
        </div>
        <div>
          <span class="detail-label">问题数</span>
          <strong>{{ audit.summary && audit.summary['问题数量'] }}</strong>
        </div>
        <div>
          <span class="detail-label">模型</span>
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
import { downloadUrl, getAudit, getReport, listReports, uploadReportVersion } from '@/api/report-management/report'

export default {
  name: 'ReportManagement',
  data() {
    return {
      loading: false,
      uploading: false,
      total: 0,
      reportList: [],
      reportMonthValue: '',
      queryParams: {
        pageNum: 1,
        pageSize: 10,
        systemId: '',
        title: '',
        reportMonth: '',
        auditStatus: ''
      },
      uploadDialogVisible: false,
      detailDialogVisible: false,
      auditDialogVisible: false,
      detailLoading: false,
      currentReport: {},
      detailReport: {},
      audit: {},
      uploadForm: {
        uploader: '',
        file: null
      },
      pollTimer: null
    }
  },
  computed: {
    detailVersions() {
      return this.detailReport.versions || []
    },
    auditRows() {
      return (this.audit.resultData && this.audit.resultData.data) || []
    }
  },
  created() {
    this.getList()
  },
  beforeDestroy() {
    this.stopPolling()
  },
  methods: {
    getList(silent = false) {
      if (!silent) this.loading = true
      listReports(this.queryParams).then(response => {
        this.reportList = response.rows || []
        this.total = response.total || 0
        this.updatePolling()
      }).finally(() => {
        if (!silent) this.loading = false
      })
    },
    handleQuery() {
      this.queryParams.pageNum = 1
      this.getList()
    },
    resetQuery() {
      this.reportMonthValue = ''
      this.resetForm('queryForm')
      this.queryParams.reportMonth = ''
      this.queryParams.auditStatus = ''
      this.handleQuery()
    },
    handleMonthChange(value) {
      this.queryParams.reportMonth = value || ''
    },
    openDetail(row) {
      this.detailDialogVisible = true
      this.detailReport = { title: row.title }
      this.loadDetail(row.id)
    },
    loadDetail(reportId, silent = false) {
      if (!silent) this.detailLoading = true
      getReport(reportId).then(response => {
        this.detailReport = response || {}
      }).finally(() => {
        if (!silent) this.detailLoading = false
      })
    },
    refreshDetail() {
      if (!this.detailReport.id) return
      this.loadDetail(this.detailReport.id)
    },
    openPreview(versionId) {
      const route = this.$router.resolve({ path: `/report-management/preview/${versionId}` })
      window.open(route.href, '_blank')
    },
    openAudit(auditId) {
      getAudit(auditId).then(response => {
        this.audit = response || {}
        this.auditDialogVisible = true
      })
    },
    downloadVersion(versionId) {
      window.open(downloadUrl(versionId), '_blank')
    },
    openUpload(row) {
      this.currentReport = row
      this.uploadForm = { uploader: '', file: null }
      this.uploadDialogVisible = true
      this.$nextTick(() => {
        if (this.$refs.upload) this.$refs.upload.clearFiles()
      })
    },
    handleFileChange(file) {
      this.uploadForm.file = file.raw
    },
    handleFileRemove() {
      this.uploadForm.file = null
    },
    submitUploadRequest() {},
    submitUpload() {
      if (!this.uploadForm.file) {
        this.$modal.msgWarning('请选择DOCX文件')
        return
      }
      const formData = new FormData()
      formData.append('file', this.uploadForm.file)
      formData.append('uploader', this.uploadForm.uploader || '未知用户')
      this.uploading = true
      uploadReportVersion(this.currentReport.id, formData).then(() => {
        this.$modal.msgSuccess('已上传新版本，AI审核中')
        this.uploadDialogVisible = false
        this.getList()
      }).finally(() => {
        this.uploading = false
      })
    },
    updatePolling() {
      const hasProcessing = this.reportList.some(item => ['pending', 'running'].includes(item.latestAuditStatus))
      if (hasProcessing) {
        this.startPolling()
      } else {
        this.stopPolling()
      }
    },
    startPolling() {
      if (this.pollTimer) return
      this.pollTimer = window.setInterval(() => {
        this.getList(true)
      }, 10000)
    },
    stopPolling() {
      if (!this.pollTimer) return
      window.clearInterval(this.pollTimer)
      this.pollTimer = null
    },
    suggestionText(row) {
      if (row.latestAuditSuggestion) return row.latestAuditSuggestion
      return {
        pending: '等待 AI 审核开始',
        running: 'AI 正在审核，稍后刷新查看结果',
        passed: '未发现需要调整的问题',
        failed: '审核未通过，请进入详情查看检查点和修改建议',
        error: '审核执行失败，请进入详情查看错误原因'
      }[row.latestAuditStatus] || '暂无审核建议'
    },
    statusHint(status) {
      return {
        pending: '等待处理',
        running: '正在处理',
        passed: '通过',
        failed: '不通过',
        error: '执行失败'
      }[status] || '等待处理'
    },
    versionTypeLabel(type) {
      return {
        initial: '初始版本',
        uploaded: '上传版本'
      }[type] || '-'
    },
    formatSize(size) {
      if (!size) return '0 B'
      if (size < 1024) return `${size} B`
      if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
      return `${(size / 1024 / 1024).toFixed(1)} MB`
    },
    tableRowClassName({ row }) {
      return `report-row report-row-${row.latestAuditStatus || 'pending'}`
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
.report-page {
  background: #f6f8fb;
  min-height: calc(100vh - 84px);
}

.filter-panel,
.report-table {
  background: #fff;
  border: 1px solid #e6ebf2;
}

.filter-panel {
  padding: 16px 16px 0;
  border-radius: 6px;
  margin-bottom: 14px;
}

.filter-main {
  min-width: 0;
}

.filter-main /deep/ .el-form-item {
  margin-bottom: 16px;
}

.filter-input {
  width: 160px;
}

.filter-title {
  width: 220px;
}

.filter-status {
  width: 150px;
}

.report-table {
  border-radius: 6px;
}

.report-table /deep/ .el-table__header th {
  background: #f8fafc;
  color: #52616f;
  font-weight: 600;
}

.report-table /deep/ .el-table__row td {
  padding: 10px 0;
}

.report-table /deep/ .report-row-pending td,
.report-table /deep/ .report-row-running td {
  background: #fffaf0;
}

.report-cell {
  min-width: 0;
}

.report-name {
  color: #1f2d3d;
  font-weight: 600;
  cursor: pointer;
  line-height: 20px;
}

.report-name:hover {
  color: #409eff;
}

.report-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 7px;
  color: #8492a6;
  font-size: 12px;
}

.report-meta span {
  white-space: nowrap;
}

.report-meta i {
  color: #a3afbf;
}

.jira-line {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 9px;
}

.jira-label {
  color: #8492a6;
  font-size: 12px;
}

.version-type {
  margin-top: 4px;
  color: #8492a6;
  font-size: 12px;
}

.empty-text {
  color: #c0c4cc;
}

.audit-brief {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.audit-conclusion {
  color: #1f2d3d;
  font-size: 12px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.suggestion-main {
  color: #606266;
  line-height: 20px;
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.suggestion-link {
  flex: none;
  padding: 0;
}

.row-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.row-actions /deep/ .el-button + .el-button {
  margin-left: 0;
}

.compact-actions {
  gap: 6px;
}

.detail-strip {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
  margin-bottom: 14px;
}

.detail-strip > div,
.audit-summary > div,
.audit-suggestion {
  min-width: 0;
  padding: 10px 12px;
  background: #f6f8fb;
  border: 1px solid #edf1f6;
  border-radius: 6px;
}

.detail-label {
  display: block;
  margin-bottom: 6px;
  color: #8492a6;
  font-size: 12px;
}

.detail-strip strong,
.audit-summary strong {
  display: block;
  color: #1f2d3d;
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.detail-version-table /deep/ .el-table__header th {
  background: #f8fafc;
  color: #52616f;
  font-weight: 600;
}

.file-name {
  color: #1f2d3d;
  font-weight: 600;
}

.file-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 6px;
  color: #8492a6;
  font-size: 12px;
}

.audit-summary {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
  margin-bottom: 14px;
}

.audit-suggestion {
  margin-bottom: 14px;
  color: #606266;
  line-height: 22px;
}

.audit-table {
  margin-top: 14px;
}

.upload-target {
  padding: 12px 14px;
  background: #f6f8fb;
  border-radius: 6px;
  margin-bottom: 18px;
}

.upload-target-title {
  color: #1f2d3d;
  font-weight: 600;
}

.upload-target-meta {
  margin-top: 6px;
  color: #8492a6;
  font-size: 12px;
}
</style>
