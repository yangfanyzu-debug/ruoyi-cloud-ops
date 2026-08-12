<template>
  <div class="app-container report-page">
    <div class="filter-panel">
      <div class="filter-main">
        <el-form ref="queryForm" :model="queryParams" size="small" :inline="true" label-width="64px" class="query-form">
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
              <el-option label="审核完成" value="completed" />
              <el-option label="审核失败" value="error" />
            </el-select>
          </el-form-item>
          <el-form-item class="query-actions">
            <el-button type="primary" icon="el-icon-search" size="mini" @click="handleQuery">查询</el-button>
            <el-button icon="el-icon-refresh-left" size="mini" @click="resetQuery">重置</el-button>
            <el-button icon="el-icon-refresh" size="mini" :loading="loading" @click="getList">刷新</el-button>
          </el-form-item>
        </el-form>
      </div>
    </div>

    <el-table v-loading="loading" :data="reportList" class="report-table" :row-class-name="tableRowClassName">
      <el-table-column label="报告" min-width="320">
        <template slot-scope="scope">
          <div class="report-cell">
            <div class="report-name" @click="openDetail(scope.row)">{{ scope.row.title }}</div>
            <div class="report-meta">
              <span class="system-code"><i class="el-icon-cpu" /> {{ scope.row.systemId || '-' }}</span>
              <span><i class="el-icon-time" /> {{ scope.row.createTime || '-' }}</span>
            </div>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="报告月份" width="116">
        <template slot-scope="scope">
          <span class="month-text">{{ scope.row.reportMonth || '-' }}</span>
        </template>
      </el-table-column>
      <el-table-column label="JIRA任务" min-width="148">
        <template slot-scope="scope">
          <el-tooltip v-if="scope.row.jiraId" :content="scope.row.jiraId" placement="top">
            <div class="jira-ticket">
              <i class="el-icon-tickets" />
              <span>{{ scope.row.jiraId }}</span>
            </div>
          </el-tooltip>
          <span v-else class="empty-text">未关联</span>
        </template>
      </el-table-column>
      <el-table-column label="版本" width="86" align="center">
        <template slot-scope="scope">
          <span class="version-badge">{{ scope.row.latestVersionNo ? `v${scope.row.latestVersionNo}` : '-' }}</span>
          <div class="version-type">{{ versionTypeLabel(scope.row.latestVersionType) }}</div>
        </template>
      </el-table-column>
      <el-table-column label="AI审核" min-width="220">
        <template slot-scope="scope">
          <div class="audit-cell-content">
            <div class="audit-status-line">
              <button
                v-if="isAuditProcessing(scope.row.latestAuditStatus) && scope.row.latestAuditId"
                type="button"
                class="audit-processing-trigger"
                @click.stop="openAuditView(scope.row.latestAuditId, scope.row.latestAuditStatus)"
              >
                <span class="audit-pulse" aria-hidden="true"><i /><i /><i /></span>
                AI审核中
              </button>
              <el-tag v-else :type="statusType(scope.row.latestAuditStatus)" size="mini">
                {{ statusLabel(scope.row.latestAuditStatus) }}
              </el-tag>
            </div>
            <el-tooltip :content="auditSummaryText(scope.row)" placement="top" :disabled="!auditSummaryText(scope.row)">
              <div class="audit-summary-text">{{ auditSummaryText(scope.row) }}</div>
            </el-tooltip>
            <el-button
              v-if="scope.row.latestAuditId"
              type="text"
              size="mini"
              class="suggestion-link"
              @click="openAuditView(scope.row.latestAuditId, scope.row.latestAuditStatus)"
            >
              {{ isAuditProcessing(scope.row.latestAuditStatus) ? '查看审核过程' : '查看审核结果' }}
              <i class="el-icon-arrow-right" />
            </el-button>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="286" align="right">
        <template slot-scope="scope">
          <div class="row-actions">
            <el-button size="mini" type="primary" plain @click="openDetail(scope.row)">详情</el-button>
            <el-button size="mini" :disabled="!scope.row.latestVersionId" @click="openPreview(scope.row.latestVersionId)">预览</el-button>
            <el-button size="mini" :disabled="!scope.row.latestVersionId" @click="downloadVersion(scope.row.latestVersionId)">下载</el-button>
            <el-button size="mini" @click="openUpload(scope.row)">上传</el-button>
          </div>
        </template>
      </el-table-column>
      <template slot="empty">
        <div class="report-empty">
          <i class="el-icon-document" />
          <div class="report-empty-title">暂无符合条件的报告</div>
          <el-button v-if="hasActiveFilters" type="text" @click="resetQuery">清除筛选条件</el-button>
        </div>
      </template>
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
                <button
                  v-if="isAuditProcessing(scope.row.auditStatus) && scope.row.latestAuditId"
                  type="button"
                  class="audit-processing-trigger"
                  @click.stop="openAuditView(scope.row.latestAuditId, scope.row.auditStatus)"
                >
                  <span class="audit-pulse" aria-hidden="true"><i /><i /><i /></span>
                  AI审核中
                </button>
                <el-tag v-else :type="statusType(scope.row.auditStatus)" size="mini">
                  {{ statusLabel(scope.row.auditStatus) }}
                </el-tag>
                <span class="audit-conclusion">{{ scope.row.latestAuditConclusion || statusHint(scope.row.auditStatus) }}</span>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="270">
            <template slot-scope="scope">
              <div class="row-actions compact-actions">
                <el-button
                  size="mini"
                  type="primary"
                  plain
                  icon="el-icon-reading"
                  :disabled="!scope.row.latestAuditId"
                  @click="openAuditView(scope.row.latestAuditId, scope.row.auditStatus)"
                >{{ isAuditProcessing(scope.row.auditStatus) ? '审核过程' : '审核结果' }}</el-button>
                <el-button size="mini" @click="openPreview(scope.row.id)">预览</el-button>
                <el-button size="mini" @click="downloadVersion(scope.row.id)">下载</el-button>
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

    <audit-process-dialog
      ref="auditProcessDialog"
      @completed="handleAuditProcessCompleted"
      @show-result="openAudit"
    />
  </div>
</template>

<script>
import { downloadUrl, getAudit, getReport, listReports, uploadReportVersion } from '@/api/report-management/report'
import AuditProcessDialog from './components/AuditProcessDialog.vue'

export default {
  name: 'ReportManagement',
  components: { AuditProcessDialog },
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
    },
    hasActiveFilters() {
      return Boolean(
        this.queryParams.systemId ||
        this.queryParams.title ||
        this.queryParams.reportMonth ||
        this.queryParams.auditStatus
      )
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
    openAuditView(auditId, status) {
      const report = this.reportList.find(item => item.latestAuditId === auditId)
      const reportId = report ? report.id : this.detailReport.id
      if (!reportId) return
      const route = this.$router.resolve({
        path: `/report-management/audit-workbench/${reportId}`,
        query: { auditId }
      })
      window.open(route.href, '_blank')
    },
    openAuditProcess(auditId) {
      this.$refs.auditProcessDialog.open(auditId)
    },
    handleAuditProcessCompleted() {
      this.getList(true)
      if (this.detailDialogVisible && this.detailReport.id) this.loadDetail(this.detailReport.id, true)
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
    auditSummaryText(row) {
      if (row.latestAuditSuggestion) return row.latestAuditSuggestion
      return {
        pending: '等待后台任务处理',
        running: '正在解析报告并生成结论',
        passed: '未发现明显问题',
        failed: '请查看检查点和修改建议',
        completed: '审核已完成，请查看完整结果',
        error: '审核执行异常，请查看错误信息'
      }[row.latestAuditStatus] || '暂无审核信息'
    },
    statusHint(status) {
      return {
        pending: '等待处理',
        running: '正在处理',
        passed: '通过',
        failed: '不通过',
        completed: '已完成',
        error: '执行失败'
      }[status] || '等待处理'
    },
    isAuditProcessing(status) {
      return ['pending', 'running'].includes(status)
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
        completed: '审核完成',
        error: '审核失败'
      }[status] || '待审核'
    },
    statusType(status) {
      return {
        pending: 'info',
        running: 'warning',
        passed: 'success',
        failed: 'danger',
        completed: '',
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
  padding: 12px 14px 0;
  border-radius: 6px;
  margin-bottom: 12px;
}

.filter-main {
  min-width: 0;
}

.query-form {
  display: flex;
  align-items: center;
  flex-wrap: nowrap;
}

.filter-main /deep/ .el-form-item {
  flex: none;
  margin-right: 10px;
  margin-bottom: 12px;
}

.filter-input {
  width: 132px;
}

.filter-title {
  width: 172px;
}

.filter-status {
  width: 132px;
}

.filter-main /deep/ .query-actions {
  margin-right: 0;
  margin-left: auto;
  white-space: nowrap;
}

.report-table {
  border-radius: 6px;
  overflow: hidden;
}

.report-table /deep/ .el-table__header th {
  height: 44px;
  background: #f7f9fc;
  color: #52616f;
  font-weight: 600;
}

.report-table /deep/::before {
  display: none;
}

.report-table /deep/ td,
.report-table /deep/ th.is-leaf {
  border-bottom-color: #edf1f6;
}

.report-table /deep/ .el-table__row td {
  padding: 12px 0;
  transition: background-color .16s ease;
}

.report-table /deep/ .el-table__row:hover td {
  background: #f8fbff;
}

.report-empty {
  padding: 38px 0 34px;
  color: #9aa6b2;
  line-height: 1.5;
}

.report-empty > i {
  margin-bottom: 8px;
  color: #c6cfda;
  font-size: 30px;
}

.report-empty-title {
  color: #657384;
  font-size: 14px;
}

.report-table /deep/ .report-row-pending td:first-child,
.report-table /deep/ .report-row-running td:first-child {
  box-shadow: inset 3px 0 0 #e6a23c;
}

.report-cell {
  min-width: 0;
}

.report-name {
  color: #1f2d3d;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  line-height: 21px;
}

.report-name:hover {
  color: #409eff;
}

.report-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  margin-top: 6px;
  color: #8492a6;
  font-size: 12px;
}

.report-meta span {
  white-space: nowrap;
}

.report-meta i {
  color: #a3afbf;
}

.system-code {
  color: #60758a;
}

.month-text {
  color: #52616f;
  font-size: 13px;
  font-weight: 500;
}

.jira-ticket {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #456786;
  font-size: 12px;
}

.jira-ticket i {
  color: #8aa5bd;
}

.jira-ticket span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.version-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 34px;
  height: 22px;
  color: #3f607d;
  background: #f1f6fa;
  border: 1px solid #dbe7f0;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
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

.audit-cell-content {
  min-width: 0;
}

.audit-status-line {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.audit-processing-trigger {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 6px;
  height: 24px;
  padding: 0 8px;
  color: #8a5a00;
  background: #fff8e6;
  border: 1px solid #f2cf85;
  border-radius: 4px;
  font-size: 12px;
  line-height: 22px;
  cursor: pointer;
}

.audit-processing-trigger:hover,
.audit-processing-trigger:focus {
  color: #6f4700;
  background: #fff2cc;
  border-color: #e6b95d;
  outline: none;
}

.audit-pulse {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  height: 8px;
}

.audit-pulse i {
  width: 4px;
  height: 4px;
  background: currentColor;
  border-radius: 50%;
  animation: audit-dot 1.2s ease-in-out infinite;
}

.audit-pulse i:nth-child(2) {
  animation-delay: .16s;
}

.audit-pulse i:nth-child(3) {
  animation-delay: .32s;
}

.audit-conclusion,
.audit-summary-text {
  color: #52616f;
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.audit-summary-text {
  margin-top: 6px;
  color: #7b8794;
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
  margin-top: 5px;
  padding: 0;
  font-size: 12px;
}

.row-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 7px;
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

@media (max-width: 1280px) {
  .filter-title {
    width: 150px;
  }

  .filter-main /deep/ .el-form-item {
    margin-right: 6px;
  }
}

@media (max-width: 900px) {
  .filter-input,
  .filter-title,
  .filter-status {
    width: 180px;
  }

  .detail-strip,
  .audit-summary {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
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

@keyframes audit-dot {
  0%, 60%, 100% { opacity: .35; transform: translateY(0); }
  30% { opacity: 1; transform: translateY(-3px); }
}

@media (prefers-reduced-motion: reduce) {
  .audit-pulse i {
    animation: none;
  }
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
