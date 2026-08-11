<template>
  <div class="app-container report-page">
    <div class="report-header">
      <div>
        <div class="report-title">性能容量报告</div>
        <div class="report-subtitle">按系统、月份和最新审核状态管理批次生成及人工修订的 DOCX 报告</div>
      </div>
      <div class="report-header-actions">
        <el-button size="small" icon="el-icon-refresh" @click="getList">刷新</el-button>
      </div>
    </div>

    <div class="status-strip">
      <div
        v-for="item in statusCards"
        :key="item.value"
        class="status-card"
        :class="{ active: queryParams.auditStatus === item.value }"
        @click="setAuditStatus(item.value)"
      >
        <div class="status-card-label">{{ item.label }}</div>
        <div class="status-card-value">{{ item.count }}</div>
      </div>
    </div>

    <div class="filter-panel">
      <el-form ref="queryForm" :model="queryParams" size="small" :inline="true" label-width="72px">
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
        </el-form-item>
      </el-form>
    </div>

    <el-table v-loading="loading" :data="reportList" class="report-table" border>
      <el-table-column label="报告" min-width="360">
        <template slot-scope="scope">
          <div class="report-name" @click="openDetail(scope.row)">{{ scope.row.title }}</div>
          <div class="report-meta">
            <span>{{ scope.row.systemId }}</span>
            <span>{{ scope.row.reportMonth }}</span>
            <span v-if="scope.row.latestVersionNo">v{{ scope.row.latestVersionNo }}</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="最新审核" width="150">
        <template slot-scope="scope">
          <el-tag :type="statusType(scope.row.latestAuditStatus)" size="small">
            {{ statusLabel(scope.row.latestAuditStatus) }}
          </el-tag>
          <div class="audit-conclusion">{{ scope.row.latestAuditConclusion || '-' }}</div>
        </template>
      </el-table-column>
      <el-table-column label="审核建议" min-width="280">
        <template slot-scope="scope">
          <span class="suggestion-text">{{ scope.row.latestAuditSuggestion || emptySuggestion(scope.row.latestAuditStatus) }}</span>
        </template>
      </el-table-column>
      <el-table-column label="创建时间" prop="createTime" width="170" />
      <el-table-column label="操作" width="260" fixed="right">
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
      }
    }
  },
  computed: {
    statusCards() {
      const counts = this.reportList.reduce((acc, item) => {
        const key = item.latestAuditStatus || 'pending'
        acc[key] = (acc[key] || 0) + 1
        return acc
      }, {})
      return [
        { label: '全部', value: '', count: this.total },
        { label: '审核中', value: 'running', count: counts.running || 0 },
        { label: '通过', value: 'passed', count: counts.passed || 0 },
        { label: '不通过', value: 'failed', count: counts.failed || 0 },
        { label: '异常', value: 'error', count: counts.error || 0 }
      ]
    }
  },
  created() {
    this.getList()
  },
  methods: {
    getList() {
      this.loading = true
      listReports(this.queryParams).then(response => {
        this.reportList = response.rows || []
        this.total = response.total || 0
      }).finally(() => {
        this.loading = false
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
    setAuditStatus(status) {
      this.queryParams.auditStatus = status
      this.handleQuery()
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
    emptySuggestion(status) {
      return status === 'error' ? '请查看版本审核详情中的错误原因' : '-'
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

.report-header,
.filter-panel,
.report-table {
  background: #fff;
  border: 1px solid #e6ebf2;
}

.report-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 20px;
  border-radius: 6px;
}

.report-title {
  font-size: 20px;
  font-weight: 600;
  color: #1f2d3d;
}

.report-subtitle {
  margin-top: 6px;
  color: #6b778c;
  font-size: 13px;
}

.status-strip {
  display: grid;
  grid-template-columns: repeat(5, minmax(120px, 1fr));
  gap: 12px;
  margin: 14px 0;
}

.status-card {
  background: #fff;
  border: 1px solid #e6ebf2;
  border-radius: 6px;
  padding: 14px 16px;
  cursor: pointer;
}

.status-card.active {
  border-color: #409eff;
  box-shadow: 0 0 0 2px rgba(64, 158, 255, 0.12);
}

.status-card-label {
  color: #6b778c;
  font-size: 13px;
}

.status-card-value {
  margin-top: 8px;
  color: #1f2d3d;
  font-size: 24px;
  font-weight: 600;
}

.filter-panel {
  padding: 16px 16px 0;
  border-radius: 6px;
  margin-bottom: 14px;
}

.filter-input {
  width: 180px;
}

.filter-title {
  width: 280px;
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

.audit-conclusion {
  margin-top: 8px;
  color: #606266;
  font-size: 12px;
}

.suggestion-text {
  color: #606266;
  line-height: 20px;
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
