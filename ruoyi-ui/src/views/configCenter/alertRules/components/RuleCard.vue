<template>
  <article class="rule-card" :class="{ 'rule-card--invalid': errors.length }">
    <header class="rule-card__header">
      <strong>规则{{ index + 1 }}</strong>
      <div class="rule-card__actions">
        <el-button type="text" title="复制规则" @click="$emit('copy', index)"><svg-icon icon-class="clipboard" /></el-button>
        <el-button type="text" class="rule-card__delete" title="删除规则" @click="$emit('remove', index)"><i class="el-icon-delete" /></el-button>
      </div>
    </header>

    <label class="rule-card__label">System（多选）</label>
    <el-select :value="rule.systems" multiple collapse-tags clearable placeholder="不限制" @change="update('systems', $event)">
      <el-option v-for="option in systemOptions" :key="option.value" :label="option.label" :value="option.value" />
    </el-select>

    <label class="rule-card__label">告警源（多选）</label>
    <el-select :value="rule.sources" multiple collapse-tags clearable placeholder="不限制" @change="update('sources', $event)">
      <el-option v-for="option in sourceOptions" :key="option.value" :label="option.label" :value="option.value" />
    </el-select>

    <label class="rule-card__label">匹配说明</label>
    <div class="rule-card__explain">{{ ruleText }}</div>
    <div v-if="errors.length" class="rule-card__error">{{ errors.join('；') }}</div>
  </article>
</template>

<script>
import { buildRuleText, normalizeRule } from '../rule-utils'

export default {
  name: 'RuleCard',
  props: {
    rule: { type: Object, required: true },
    index: { type: Number, required: true },
    systemOptions: { type: Array, required: true },
    sourceOptions: { type: Array, required: true },
    errors: { type: Array, default: () => [] }
  },
  computed: {
    ruleText() { return buildRuleText(this.rule) }
  },
  methods: {
    update(key, value) {
      this.$emit('change', this.index, { ...normalizeRule(this.rule), [key]: value.slice() })
    }
  }
}
</script>

<style scoped lang="scss">
.rule-card {
  min-width: 0;
  padding: 14px 14px 12px;
  border: 1px solid #dfe5ee;
  border-radius: 7px;
  background: #fff;
  transition: border-color .2s, box-shadow .2s;
  &:hover { border-color: #b9c8dd; box-shadow: 0 4px 12px rgba(30, 64, 120, .06); }
  &--invalid { border-color: #f3bf75; }
  &__header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; color: #182133; }
  &__actions { display: flex; align-items: center; gap: 2px; ::v-deep .el-button { padding: 3px 6px; color: #596579; } }
  &__actions .rule-card__delete { color: #f04444; }
  &__label { display: block; margin: 10px 0 6px; color: #586174; font-size: 13px; }
  ::v-deep .el-select { width: 100%; }
  ::v-deep .el-input__inner { height: 35px; line-height: 35px; border-radius: 5px; }
  &__explain { min-height: 34px; padding: 8px 9px; overflow: hidden; border: 1px solid #dfe4ea; border-radius: 5px; background: #f7f8fa; color: #3e4859; font-size: 12px; line-height: 16px; text-overflow: ellipsis; white-space: nowrap; }
  &__error { margin-top: 8px; color: #df6b08; font-size: 12px; line-height: 17px; }
}
</style>
