<template>
  <el-dialog title="规则详情" :visible="visible" width="680px" append-to-body @close="$emit('update:visible', false)">
    <template v-if="version">
      <el-descriptions :column="2" border size="small">
        <el-descriptions-item label="版本号">v{{ version.version }}</el-descriptions-item>
        <el-descriptions-item label="状态">{{ statusLabel }}</el-descriptions-item>
        <el-descriptions-item label="创建人">{{ version.createdBy || '-' }}</el-descriptions-item>
        <el-descriptions-item label="创建时间">{{ version.createdAt || '-' }}</el-descriptions-item>
        <el-descriptions-item label="激活人">{{ version.activatedBy || '-' }}</el-descriptions-item>
        <el-descriptions-item label="激活时间">{{ version.activatedAt || '-' }}</el-descriptions-item>
        <el-descriptions-item label="说明" :span="2">{{ version.description || '-' }}</el-descriptions-item>
      </el-descriptions>
      <div class="detail-rules">
        <div v-for="(rule, index) in version.rules || []" :key="rule.id || index" class="detail-rule">
          <span>{{ index + 1 }}</span><strong>规则{{ index + 1 }}</strong><p>{{ buildRuleText(rule) }}</p>
        </div>
      </div>
    </template>
    <span slot="footer"><el-button type="primary" @click="$emit('update:visible', false)">关闭</el-button></span>
  </el-dialog>
</template>

<script>
import { STATUS_META } from '../constants'
import { buildRuleText } from '../rule-utils'

export default {
  name: 'VersionDetailDialog',
  props: { visible: Boolean, version: { type: Object, default: null } },
  computed: {
    statusLabel() { return this.version && STATUS_META[this.version.status] ? STATUS_META[this.version.status].label : '-' }
  },
  methods: { buildRuleText }
}
</script>

<style scoped lang="scss">
.detail-rules { margin-top: 18px; border: 1px solid #e1e6ed; border-radius: 6px; overflow: hidden; }
.detail-rule { display: grid; grid-template-columns: 36px 70px 1fr; align-items: center; min-height: 45px; padding: 0 14px; border-bottom: 1px solid #e8ebf0; color: #3e4858; &:last-child { border-bottom: 0; } span { color: #0968e8; } p { margin: 0; } }
</style>
