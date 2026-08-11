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
          <el-form-item>
            <el-button type="primary" icon="el-icon-search" size="mini" @click="handleQuery">查询</el-button>
            <el-button icon="el-icon-refresh-left" size="mini" @click="resetQuery">重置</el-button>
            <el-button icon="el-icon-refresh" size="mini" @click="getList">刷新</el-button>
          </el-form-item>
        </el-form>
      </div>
    </div>

    <el-table v-loading="loading" :data="reportList" class="report-table" border>
      <el-table-column label="报告" min-width="300">
        <template slot-scope="scope">
          <div class="report-name" @click="openDetail(scope.row)">{{ scope.row.title }}</div>
          <div class="report-meta">
            <span>{{ scope.row.systemId }}</span>
            <span>{{ scope.row.reportMonth }}</span>
            <span v-if="scope.row.latestVersionNo">v{{ scope.row.latestVersionNo }}</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="JIRA单号" width="170">
        <template slot-scope="scope">
          <el-tag v-if="scope.row.jiraId" size="small" effect="plain">{{ scope.row.jiraId }}</el-tag>
          <span v-else class="empty-text">-</span>
        </template>
      </el-table-column>
      <el-table-column label="最新审核" width="140">
        <template slot-scope="scope">
          <el-tag :type="statusType(scope.row.latestAuditStatus)" size="small">
            {{ statusLabel(scope.row.latestAuditStatus) }}
          </el-tag>
          <div class="audit-conclusion">{{ scope.row.latestAuditConclusion || '-' }}</div>
        </template>
      </el-table-column>
      <el-table-column label="审核建议" min-width="360">
        <template slot-scope="scope">
          <div class="suggestion-cell" :class="`suggestion-${scope.row.latestAuditStatus || 'pending'}`">
            <div class="suggestion-main">
              {{ suggestionText(scope.row) }}
            </div>
            <el-button
              v-if="scope.row.latestAuditId"
              type="text"
              size="mini"
              class="suggestion-link"
              @click="openDetail(scope.row)"
            >
              查看完整审核
            </el-button>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="创建时间" prop="createTime" width="170" />
      <el-table-column label="操作" width="220" fixed="right">
        <template slot-scope="scope">
          <el-button size="mini" type="primary" plain icon="el-icon-view" @click="openDetail(scope.row)">详情</el-button>
          <el-dropdown trigger="click" @command="command => handleRowCommand(command, scope.row)">
            <el-button size="mini" icon="el-icon-more">更多</el-button>
            <el-dropdown-menu slot="dropdown">
              <el-dropdown-item command="preview" :disabled="!scope.row.latestVersionId">预览最新版本</el-dropdown-item>
              <el-dropdown-item command="download" :disabled="!scope.row.latestVersionId">下载最新版本</el-dropdown-item>
              <el-dropdown-item command="upload">上传新版本</el-dropdown-item>
            </el-dropdown-menu>
          </el-dropdown>
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
  </div>
</template>

<script>
import { downloadUrl, listReports, uploadReportVersion } from '@/api/report-management/report'

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
      currentReport: {},
      uploadForm: {
        uploader: '',
        file: null
      },
      pollTimer: null
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
    handleRowCommand(command, row) {
      if (command === 'preview') this.openPreview(row.latestVersionId)
      if (command === 'download') this.downloadVersion(row.latestVersionId)
      if (command === 'upload') this.openUpload(row)
    },
    openDetail(row) {
      this.$router.push({ path: `/report-management/reports/${row.id}` })
    },
    openPreview(versionId) {
      const route = this.$router.resolve({ path: `/report-management/preview/${versionId}` })
      window.open(route.href, '_blank')
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

.report-table {
  border-radius: 6px;
}

.report-name {
  color: #1f2d3d;
  font-weight: 600;
  cursor: pointer;
}

.report-name:hover {
  color: #409eff;
}

.report-meta {
  display: flex;
  gap: 12px;
  margin-top: 7px;
  color: #8492a6;
  font-size: 12px;
}

.empty-text {
  color: #c0c4cc;
}

.audit-conclusion {
  margin-top: 8px;
  color: #606266;
  font-size: 12px;
}

.suggestion-cell {
  position: relative;
  padding-left: 10px;
}

.suggestion-cell::before {
  position: absolute;
  left: 0;
  top: 4px;
  bottom: 4px;
  width: 3px;
  border-radius: 3px;
  background: #dcdfe6;
  content: '';
}

.suggestion-error::before,
.suggestion-failed::before {
  background: #f56c6c;
}

.suggestion-passed::before {
  background: #67c23a;
}

.suggestion-running::before {
  background: #e6a23c;
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
  margin-top: 4px;
  padding: 0;
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
