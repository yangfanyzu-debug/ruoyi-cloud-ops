<template>
  <div class="app-container report-page">
    <div class="filter-panel">
      <div class="filter-main">
        <el-form ref="queryForm" :model="queryParams" size="small" :inline="true" label-width="64px" class="query-form">
          <el-form-item label="系统" prop="systemId">
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
          <el-form-item label="月份" prop="reportMonth">
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
          <el-form-item label="状态" prop="auditStatus">
            <el-select v-model="queryParams.auditStatus" class="filter-status" placeholder="全部状态" clearable @change="handleStatusChange">
              <el-option label="待处理" value="processing" />
              <el-option label="待审核" value="pending" />
              <el-option label="审核中" value="running" />
              <el-option label="审核通过" value="passed" />
              <el-option label="审核不通过" value="failed" />
              <el-option label="审核完成" value="completed" />
              <el-option label="执行失败" value="error" />
            </el-select>
          </el-form-item>
          <el-form-item class="query-actions">
            <el-button type="primary" icon="el-icon-search" size="mini" @click="handleQuery">查询</el-button>
            <el-button icon="el-icon-refresh-left" size="mini" @click="resetQuery">重置</el-button>
            <el-button icon="el-icon-refresh" size="mini" :loading="loading" @click="getList">刷新</el-button>
          </el-form-item>
        </el-form>
      </div>
      <div class="quick-filter-row">
        <span class="quick-filter-label">快捷筛选</span>
        <el-radio-group v-model="quickAuditStatus" size="mini" @change="handleQuickStatusChange">
          <el-radio-button label="">全部</el-radio-button>
          <el-radio-button label="processing">待处理</el-radio-button>
          <el-radio-button label="failed">审核不通过</el-radio-button>
          <el-radio-button label="error">执行失败</el-radio-button>
        </el-radio-group>
      </div>
    </div>

    <el-table v-loading="loading" :data="reportList" class="report-table" :row-class-name="tableRowClassName">
      <el-table-column label="系统" width="140">
        <template slot-scope="scope">
          <el-tooltip :content="scope.row.systemId || '-'" placement="top" :disabled="!scope.row.systemId">
            <div class="system-cell">{{ scope.row.systemId || '-' }}</div>
          </el-tooltip>
        </template>
      </el-table-column>
      <el-table-column label="报告" min-width="220">
        <template slot-scope="scope">
          <div class="report-cell">
            <div class="report-name" @click="openDetail(scope.row)">{{ scope.row.title }}</div>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="报告月份" width="110">
        <template slot-scope="scope">
          <span class="month-text">{{ scope.row.reportMonth || '-' }}</span>
        </template>
      </el-table-column>
      <el-table-column label="JIRA任务" min-width="142">
        <template slot-scope="scope">
          <el-tooltip v-if="scope.row.jiraId" content="在 JIRA 中打开" placement="top">
            <a class="jira-ticket" :href="jiraUrl(scope.row.jiraId)" target="_blank" rel="noopener noreferrer">
              <i class="el-icon-tickets" />
              <span>{{ scope.row.jiraId }}</span>
              <i class="el-icon-top-right jira-external" />
            </a>
          </el-tooltip>
          <el-tooltip v-else-if="scope.row.jiraStatus === 'error'" :content="scope.row.jiraError || 'JIRA创建失败'" placement="top">
            <span class="jira-state jira-state-error">
              创建失败
              <el-button v-if="scope.row.initialAuditStatus === 'passed'" type="text" size="mini" :loading="retryingJiraId === scope.row.id" @click.stop="retryJira(scope.row)">重新创建</el-button>
            </span>
          </el-tooltip>
          <span v-else-if="['pending', 'creating'].includes(scope.row.jiraStatus)" class="jira-state">创建中</span>
          <span v-else class="empty-text">待初审通过</span>
        </template>
      </el-table-column>
      <el-table-column label="版本" width="78" align="center">
        <template slot-scope="scope">
          <el-tooltip :content="versionTooltip(scope.row)" placement="top">
            <div class="version-cell">
              <span class="version-badge">{{ scope.row.latestVersionNo ? `v${scope.row.latestVersionNo}` : '-' }}</span>
              <div class="version-type">{{ versionTypeLabel(scope.row.latestVersionType) }}</div>
            </div>
          </el-tooltip>
        </template>
      </el-table-column>
      <el-table-column label="初审状态" width="104">
        <template slot-scope="scope">
          <button
            v-if="isAuditRunning(scope.row.initialAuditStatus) && scope.row.initialAuditId"
            type="button"
            class="audit-processing-trigger"
            @click.stop="openAuditView(scope.row.initialAuditId, scope.row.initialAuditStatus)"
          >
            <span class="audit-pulse" aria-hidden="true"><i /><i /><i /></span>
            审核中
          </button>
          <el-tag
            v-else-if="scope.row.initialAuditId"
            :type="statusType(scope.row.initialAuditStatus)"
            size="mini"
            class="audit-status-clickable"
            :class="`audit-tag-${scope.row.initialAuditStatus}`"
            @click.stop="openAuditView(scope.row.initialAuditId, scope.row.initialAuditStatus)"
          >
            {{ statusLabel(scope.row.initialAuditStatus) }}
          </el-tag>
          <span v-else class="empty-text">暂无初审</span>
        </template>
      </el-table-column>
      <el-table-column label="修订审核状态" width="116">
        <template slot-scope="scope">
          <button
            v-if="isAuditRunning(scope.row.revisionAuditStatus) && scope.row.revisionAuditId"
            type="button"
            class="audit-processing-trigger"
            @click.stop="openAuditView(scope.row.revisionAuditId, scope.row.revisionAuditStatus)"
          >
            <span class="audit-pulse" aria-hidden="true"><i /><i /><i /></span>
            审核中
          </button>
          <el-tag
            v-else-if="scope.row.revisionAuditId"
            :type="statusType(scope.row.revisionAuditStatus)"
            size="mini"
            class="audit-status-clickable"
            :class="`audit-tag-${scope.row.revisionAuditStatus}`"
            @click.stop="openAuditView(scope.row.revisionAuditId, scope.row.revisionAuditStatus)"
          >
            {{ statusLabel(scope.row.revisionAuditStatus) }}
          </el-tag>
          <span v-else class="empty-text">未修订</span>
        </template>
      </el-table-column>
      <el-table-column label="最新审核总结" min-width="230">
        <template slot-scope="scope">
          <div
            class="audit-cell-content audit-cell-clickable"
            :class="{ disabled: !scope.row.latestAuditId }"
            @click="openAuditView(scope.row.latestAuditId, scope.row.latestAuditStatus)"
          >
            <el-tooltip :content="auditSummaryText(scope.row)" placement="top" :disabled="!auditSummaryText(scope.row)">
              <div class="audit-summary-text">{{ auditSummaryText(scope.row) }}</div>
            </el-tooltip>
            <el-button
              v-if="scope.row.latestAuditId"
              type="text"
              size="mini"
              class="suggestion-link"
              @click.stop="openAuditView(scope.row.latestAuditId, scope.row.latestAuditStatus)"
            >
              {{ auditActionLabel(scope.row.latestAuditStatus) }}
              <i class="el-icon-arrow-right" />
            </el-button>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="定稿" width="96" align="center">
        <template slot-scope="scope">
          <el-tag v-if="scope.row.isFinalized" type="success" size="mini">已定稿</el-tag>
          <el-tooltip v-else :content="finalizeHint(scope.row)" placement="top">
            <span>
              <el-button
                class="finalize-button"
                size="mini"
                :disabled="!canFinalize(scope.row)"
                :loading="finalizingReportId === scope.row.id"
                @click="confirmFinalize(scope.row)"
              >确认定稿</el-button>
            </span>
          </el-tooltip>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="160" align="right" fixed="right">
        <template slot-scope="scope">
          <div class="row-actions">
            <el-tooltip content="查看详情" placement="top">
              <el-button class="icon-action primary-action" size="mini" aria-label="查看详情" @click="openDetail(scope.row)">
                <svg-icon icon-class="documentation" />
              </el-button>
            </el-tooltip>
            <el-tooltip content="预览最新版本" placement="top">
              <el-button class="icon-action" size="mini" :disabled="!scope.row.latestVersionId" aria-label="预览最新版本" @click="openPreview(scope.row.latestVersionId)">
                <svg-icon icon-class="eye-open" />
              </el-button>
            </el-tooltip>
            <el-tooltip content="下载最新版本" placement="top">
              <el-button class="icon-action" size="mini" :disabled="!scope.row.latestVersionId" aria-label="下载最新版本" @click="downloadVersion(scope.row.latestVersionId)">
                <svg-icon icon-class="download" />
              </el-button>
            </el-tooltip>
            <el-tooltip :content="uploadHint(scope.row)" placement="top">
              <span>
                <el-button class="icon-action" size="mini" :disabled="!canUploadRevision(scope.row)" aria-label="上传新版本" @click="openUpload(scope.row)">
                  <svg-icon icon-class="upload" />
                </el-button>
              </span>
            </el-tooltip>
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
          <el-input :value="currentUploader" disabled />
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
      width="1120px"
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
            <a v-if="detailReport.jiraId" class="detail-jira-link" :href="jiraUrl(detailReport.jiraId)" target="_blank" rel="noopener noreferrer">
              {{ detailReport.jiraId }} <i class="el-icon-top-right" />
            </a>
            <strong v-else>未关联</strong>
          </div>
          <div>
            <span class="detail-label">定稿状态</span>
            <strong>{{ detailReport.isFinalized ? `已定稿 · ${detailReport.finalizedBy || '未知用户'}` : '未定稿' }}</strong>
          </div>
        </div>

        <el-table :data="detailVersions" class="detail-version-table" border>
          <el-table-column label="版本" width="86" align="center">
            <template slot-scope="scope">
              <el-tag size="mini" effect="plain">v{{ scope.row.versionNo }}</el-tag>
              <div v-if="isLatestVersion(scope.row)" class="current-version-label">当前版本</div>
            </template>
          </el-table-column>
          <el-table-column label="报告文件" min-width="340">
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
          <el-table-column label="审核结果" min-width="360">
            <template slot-scope="scope">
              <div class="audit-brief">
                <button
                  v-if="isAuditRunning(scope.row.auditStatus) && scope.row.latestAuditId"
                  type="button"
                  class="audit-processing-trigger"
                  @click.stop="openAuditView(scope.row.latestAuditId, scope.row.auditStatus)"
                >
                  <span class="audit-pulse" aria-hidden="true"><i /><i /><i /></span>
                  AI审核中
                </button>
                <el-tag v-else :type="statusType(scope.row.auditStatus)" size="mini" :class="`audit-tag-${scope.row.auditStatus}`">
                  {{ statusLabel(scope.row.auditStatus) }}
                </el-tag>
                <el-tag v-if="scope.row.auditTypeLabel" class="audit-type-tag" size="mini" type="info" effect="plain">{{ scope.row.auditTypeLabel }}</el-tag>
                <span class="audit-conclusion">{{ scope.row.latestAuditConclusion || statusHint(scope.row.auditStatus) }}</span>
              </div>
              <div class="version-audit-summary">{{ versionAuditSummary(scope.row) }}</div>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="154" align="right">
            <template slot-scope="scope">
              <div class="row-actions compact-actions">
                <el-tooltip :content="auditActionLabel(scope.row.auditStatus)" placement="top">
                  <el-button
                    class="icon-action primary-action"
                    size="mini"
                    aria-label="查看审核结果"
                    :disabled="!scope.row.latestAuditId"
                    @click="openAuditView(scope.row.latestAuditId, scope.row.auditStatus)"
                  >
                    <svg-icon icon-class="message" />
                  </el-button>
                </el-tooltip>
                <el-tooltip content="预览该版本" placement="top">
                  <el-button class="icon-action" size="mini" aria-label="预览该版本" @click="openPreview(scope.row.id)">
                    <svg-icon icon-class="eye-open" />
                  </el-button>
                </el-tooltip>
                <el-tooltip content="下载该版本" placement="top">
                  <el-button class="icon-action" size="mini" aria-label="下载该版本" @click="downloadVersion(scope.row.id)">
                    <svg-icon icon-class="download" />
                  </el-button>
                </el-tooltip>
                <el-tooltip v-if="scope.row.auditStatus === 'error'" content="重新审核" placement="top">
                  <el-button
                    class="icon-action"
                    size="mini"
                    aria-label="重新审核"
                    :loading="retryingVersionId === scope.row.id"
                    @click="retryAudit(scope.row)"
                  >
                    <svg-icon icon-class="refresh" />
                  </el-button>
                </el-tooltip>
                <el-tooltip v-if="canUploadRevision(detailReport) && isLatestVersion(scope.row) && scope.row.auditStatus === 'failed'" content="上传新版本" placement="top">
                  <el-button class="icon-action" size="mini" aria-label="上传新版本" @click="openUploadFromDetail">
                    <svg-icon icon-class="upload" />
                  </el-button>
                </el-tooltip>
              </div>
            </template>
          </el-table-column>
        </el-table>
      </div>
      <div slot="footer" class="dialog-footer">
        <el-button
          v-if="detailReport.id && !detailReport.isFinalized"
          size="mini"
          :disabled="!canFinalizeDetail"
          :loading="finalizingReportId === detailReport.id"
          @click="confirmFinalize(detailReport)"
        >确认定稿</el-button>
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
import { downloadUrl, finalizeReport, getAudit, getReport, listReports, retryJiraCreation, retryVersionAudit, uploadReportVersion } from '@/api/report-management/report'
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
      quickAuditStatus: '',
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
      retryingVersionId: null,
      retryingJiraId: null,
      finalizingReportId: null,
      currentReport: {},
      detailReport: {},
      audit: {},
      uploadForm: {
        file: null
      },
      pollTimer: null
    }
  },
  computed: {
    currentUploader() {
      return this.$store.getters.name || this.$store.getters.nickName || '未知用户'
    },
    detailVersions() {
      return this.detailReport.versions || []
    },
    latestDetailVersionNo() {
      return this.detailVersions.reduce((latest, version) => Math.max(latest, version.versionNo || 0), 0)
    },
    canFinalizeDetail() {
      return this.canFinalize(this.detailReport)
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
    async retryJira(row) {
      if (this.retryingJiraId !== null) return
      this.retryingJiraId = row.id
      try {
        await retryJiraCreation(row.id)
        this.$modal.msgSuccess('已提交JIRA创建任务')
        await this.getList(true)
      } finally {
        this.retryingJiraId = null
      }
    },
    getList(silent = false) {
      if (!silent) this.loading = true
      return listReports(this.queryParams).then(response => {
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
      this.quickAuditStatus = ''
      this.handleQuery()
    },
    handleMonthChange(value) {
      this.queryParams.reportMonth = value || ''
    },
    handleStatusChange(value) {
      this.quickAuditStatus = ['processing', 'failed', 'error'].includes(value) ? value : ''
    },
    handleQuickStatusChange(value) {
      this.queryParams.auditStatus = value
      this.handleQuery()
    },
    openDetail(row) {
      this.detailDialogVisible = true
      this.detailReport = { title: row.title }
      this.loadDetail(row.id)
    },
    loadDetail(reportId, silent = false) {
      if (!silent) this.detailLoading = true
      return getReport(reportId).then(response => {
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
      if (!auditId) return
      const report = this.reportList.find(item => [item.latestAuditId, item.initialAuditId, item.revisionAuditId].includes(auditId))
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
    jiraUrl(jiraId) {
      return `http://jira/browse/${encodeURIComponent(jiraId)}`
    },
    versionTooltip(row) {
      const actor = row.latestVersionUploader || (row.latestVersionType === 'initial' ? '批次任务' : '未知用户')
      return `${this.versionTypeLabel(row.latestVersionType)} · ${actor} · ${row.latestVersionCreateTime || '-'}`
    },
    openUpload(row) {
      if (row.isFinalized) {
        this.$modal.msgWarning('报告已定稿，不能继续上传修订版本')
        return
      }
      if (!this.canUploadRevision(row)) {
        this.$modal.msgWarning('初审通过后才能上传修订版本')
        return
      }
      this.currentReport = row
      this.uploadForm = { file: null }
      this.uploadDialogVisible = true
      this.$nextTick(() => {
        if (this.$refs.upload) this.$refs.upload.clearFiles()
      })
    },
    openUploadFromDetail() {
      if (!this.detailReport.id) return
      this.openUpload(this.detailReport)
    },
    retryAudit(version) {
      this.$confirm('将为该版本重新创建AI审核任务，是否继续？', '重新审核', {
        confirmButtonText: '重新审核',
        cancelButtonText: '取消',
        type: 'warning'
      }).then(() => {
        this.retryingVersionId = version.id
        return retryVersionAudit(this.detailReport.id, version.id).then(response => {
          this.$modal.msgSuccess(response.created ? '已进入AI审核队列' : '该版本已在审核队列中')
          return Promise.all([this.loadDetail(this.detailReport.id, true), this.getList(true)])
        })
      }).catch(() => {}).finally(() => {
        this.retryingVersionId = null
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
      if (this.currentReport.isFinalized) {
        this.$modal.msgWarning('报告已定稿，不能继续上传修订版本')
        return
      }
      if (!this.canUploadRevision(this.currentReport)) {
        this.$modal.msgWarning('初审通过后才能上传修订版本')
        return
      }
      if (!this.uploadForm.file) {
        this.$modal.msgWarning('请选择DOCX文件')
        return
      }
      const formData = new FormData()
      formData.append('file', this.uploadForm.file)
      formData.append('uploader', this.currentUploader)
      this.uploading = true
      uploadReportVersion(this.currentReport.id, formData).then(() => {
        this.$modal.msgSuccess('已上传新版本，等待AI审核')
        this.uploadDialogVisible = false
        this.getList()
        if (this.detailDialogVisible && this.detailReport.id === this.currentReport.id) {
          this.loadDetail(this.detailReport.id, true)
        }
      }).finally(() => {
        this.uploading = false
      })
    },
    initialAuditStatusOf(row) {
      if (row.initialAuditStatus) return row.initialAuditStatus
      const initialVersions = (row.versions || [])
        .filter(version => version.versionType === 'initial')
        .sort((left, right) => (right.versionNo || 0) - (left.versionNo || 0))
      return initialVersions.length ? initialVersions[0].auditStatus : ''
    },
    canUploadRevision(row) {
      return Boolean(row && !row.isFinalized && this.initialAuditStatusOf(row) === 'passed')
    },
    uploadHint(row) {
      if (row.isFinalized) return '报告已定稿，不能继续上传修订版本'
      return this.canUploadRevision(row) ? '上传新版本' : '初审通过后才能上传修订版本'
    },
    latestVersionOf(row) {
      if (!row || !row.versions) {
        return {
          versionType: row && row.latestVersionType,
          auditStatus: row && row.latestAuditStatus
        }
      }
      return row.versions.reduce((latest, version) => {
        if (!latest || (version.versionNo || 0) > (latest.versionNo || 0)) return version
        return latest
      }, null)
    },
    canFinalize(row) {
      const latest = this.latestVersionOf(row)
      return Boolean(
        row &&
        !row.isFinalized &&
        latest &&
        latest.versionType === 'uploaded' &&
        latest.auditStatus === 'passed'
      )
    },
    finalizeHint(row) {
      if (row.isFinalized) return '报告已定稿'
      if (this.canFinalize(row)) return '定稿后不能再上传修订版本'
      const latest = this.latestVersionOf(row)
      if (!latest || latest.versionType !== 'uploaded') return '上传修订版本并通过AI审核后才能定稿'
      return '最新修订版本AI审核通过后才能定稿'
    },
    confirmFinalize(row) {
      const reportId = row.id
      if (!reportId || row.isFinalized) return
      if (!this.canFinalize(row)) {
        this.$modal.msgWarning(this.finalizeHint(row))
        return
      }
      this.$confirm('定稿后将不能再登记批次版本或上传修订版本，仍可查看和下载。是否确认？', '确认定稿', {
        confirmButtonText: '确认定稿',
        cancelButtonText: '取消',
        type: 'warning'
      }).then(() => {
        this.finalizingReportId = reportId
        return finalizeReport(reportId, { operator: '页面用户' }).then(() => {
          this.$modal.msgSuccess('报告已确认定稿')
          const tasks = [this.getList(true)]
          if (this.detailDialogVisible && this.detailReport.id === reportId) {
            tasks.push(this.loadDetail(reportId, true))
          }
          return Promise.all(tasks)
        })
      }).catch(() => {}).finally(() => {
        this.finalizingReportId = null
      })
    },
    updatePolling() {
      const hasProcessing = this.reportList.some(item => [
        item.latestAuditStatus,
        item.initialAuditStatus,
        item.revisionAuditStatus
      ].some(status => ['pending', 'running'].includes(status)) || ['pending', 'creating'].includes(item.jiraStatus))
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
        pending: '已进入队列，等待后台Worker处理',
        running: '正在解析报告并生成结论',
        passed: '未发现明显问题',
        failed: '请查看检查点和修改建议',
        completed: '审核已完成，请查看完整结果',
        error: '审核执行异常，请查看错误信息'
      }[row.latestAuditStatus] || '暂无审核信息'
    },
    versionAuditSummary(version) {
      if (version.latestAuditErrorMessage) return version.latestAuditErrorMessage
      if (version.latestAuditSuggestion) return version.latestAuditSuggestion
      return {
        pending: '已进入队列，等待后台Worker处理',
        running: '正在解析报告并生成结论',
        passed: '未发现明显问题',
        failed: '请根据审核结果修改后上传新版本',
        completed: '审核已完成',
        error: '审核执行异常，可重新发起审核'
      }[version.auditStatus] || '暂无审核信息'
    },
    isLatestVersion(version) {
      return version.versionNo === this.latestDetailVersionNo
    },
    statusHint(status) {
      return {
        pending: '排队等待',
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
    isAuditRunning(status) {
      return status === 'running'
    },
    auditActionLabel(status) {
      if (status === 'pending') return '查看排队状态'
      if (status === 'running') return '查看审核过程'
      return '查看审核结果'
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
        pending: '排队中',
        running: '审核中',
        passed: '审核通过',
        failed: '审核不通过',
        completed: '审核完成',
        error: '执行失败'
      }[status] || '待审核'
    },
    statusType(status) {
      return {
        pending: 'info',
        running: 'warning',
        passed: 'success',
        failed: 'danger',
        completed: '',
        error: 'warning'
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
  padding: 12px 14px 10px;
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
  margin-right: 8px;
  margin-bottom: 12px;
}

.filter-main /deep/ .el-form-item:last-child {
  margin-bottom: 8px;
}

.filter-main /deep/ .el-form-item__label {
  padding-right: 8px;
  white-space: nowrap;
}

.filter-input {
  width: 120px;
}

.filter-title {
  width: 160px;
}

.filter-status {
  width: 120px;
}

.filter-main /deep/ .query-actions {
  margin-right: 0;
  margin-left: auto;
  white-space: nowrap;
}

.quick-filter-row {
  display: flex;
  align-items: center;
  min-height: 28px;
  padding-top: 9px;
  border-top: 1px solid #edf1f6;
}

.quick-filter-label {
  margin-right: 12px;
  color: #8492a6;
  font-size: 12px;
}

.quick-filter-row /deep/ .el-radio-button__inner {
  padding: 6px 14px;
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

.system-cell {
  overflow: hidden;
  color: #60758a;
  font-size: 13px;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
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
  text-decoration: none;
}

.jira-ticket:hover {
  color: #409eff;
}

.jira-ticket i {
  color: #8aa5bd;
}

.jira-ticket .jira-external {
  color: #a8b4c1;
  font-size: 11px;
}

.jira-ticket span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.jira-state {
  color: #8a6d1d;
  font-size: 12px;
}

.jira-state-error {
  color: #d95040;
  cursor: help;
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

.version-cell {
  display: inline-block;
  cursor: help;
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
.audit-type-tag { flex:none; }

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

.audit-tag-error {
  color: #8a5a00;
  background: #fff8e6;
  border-color: #f2cf85;
}

.audit-status-clickable {
  cursor: pointer;
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

.audit-conclusion {
  color: #52616f;
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.audit-summary-text {
  display: -webkit-box;
  min-height: 36px;
  overflow: hidden;
  font-size: 12px;
  color: #52616f;
  line-height: 18px;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.audit-cell-clickable:not(.disabled) {
  cursor: pointer;
}

.audit-cell-clickable:not(.disabled):hover .audit-summary-text {
  color: #409eff;
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
  gap: 4px;
  white-space: nowrap;
}

.row-actions /deep/ .el-button + .el-button {
  margin-left: 0;
}

.icon-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 28px;
  padding: 0;
  line-height: 1;
  color: #526f8a;
  border-color: transparent;
  background: transparent;
  border-radius: 4px;
}

.icon-action:hover,
.icon-action:focus {
  color: #1677c8;
  border-color: #d9ebfb;
  background: #f1f8ff;
}

.icon-action.primary-action {
  color: #1677c8;
  border-color: #cce5fb;
  background: #f4faff;
}

.icon-action /deep/ .svg-icon {
  width: 15px;
  height: 15px;
}

.finalize-button {
  min-width: 72px;
  padding-right: 9px;
  padding-left: 9px;
}

.compact-actions {
  gap: 2px;
  flex-wrap: nowrap;
}

.detail-strip {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 10px;
  margin-bottom: 14px;
}

@media (max-width: 1280px) {
  .filter-title {
    width: 140px;
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

.current-version-label {
  margin-top: 5px;
  color: #409eff;
  font-size: 11px;
  white-space: nowrap;
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

.detail-jira-link {
  display: block;
  color: #409eff;
  font-size: 13px;
  font-weight: 600;
  overflow: hidden;
  text-decoration: none;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.detail-version-table /deep/ .el-table__header th {
  background: #f8fafc;
  color: #52616f;
  font-weight: 600;
}

.detail-version-table /deep/ .el-table__row td {
  padding: 8px 0;
  vertical-align: middle;
}

.detail-version-table /deep/ .cell {
  padding-right: 10px;
  padding-left: 10px;
}

.report-detail-dialog /deep/ .el-dialog {
  width: calc(100vw - 40px) !important;
  max-width: 1120px;
}

.file-name {
  color: #1f2d3d;
  font-weight: 600;
}

.file-meta {
  display: flex;
  overflow: hidden;
  gap: 10px;
  margin-top: 6px;
  color: #8492a6;
  font-size: 12px;
  line-height: 18px;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.file-meta span {
  overflow: hidden;
  text-overflow: ellipsis;
}

.audit-summary {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
  margin-bottom: 14px;
}

.version-audit-summary {
  display: -webkit-box;
  max-height: 36px;
  margin-top: 6px;
  overflow: hidden;
  color: #7b8794;
  font-size: 12px;
  line-height: 18px;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
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
