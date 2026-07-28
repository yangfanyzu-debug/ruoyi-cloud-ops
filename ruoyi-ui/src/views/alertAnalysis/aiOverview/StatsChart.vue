<template>
  <div ref="chart" class="stats-chart" />
</template>

<script>
import * as echarts from 'echarts'

export default {
  name: 'StatsChart',
  props: {
    option: {
      type: Object,
      required: true
    }
  },
  data() {
    return {
      chart: null
    }
  },
  watch: {
    option: {
      deep: true,
      handler() {
        this.renderChart()
      }
    }
  },
  mounted() {
    this.chart = echarts.init(this.$refs.chart)
    this.renderChart()
    window.addEventListener('resize', this.resize)
  },
  beforeDestroy() {
    window.removeEventListener('resize', this.resize)
    if (this.chart) {
      this.chart.dispose()
      this.chart = null
    }
  },
  methods: {
    renderChart() {
      if (this.chart) {
        this.chart.setOption(this.option, true)
      }
    },
    resize() {
      if (this.chart) this.chart.resize()
    }
  }
}
</script>

<style scoped>
.stats-chart {
  width: 100%;
  height: 100%;
  min-height: 280px;
}
</style>
