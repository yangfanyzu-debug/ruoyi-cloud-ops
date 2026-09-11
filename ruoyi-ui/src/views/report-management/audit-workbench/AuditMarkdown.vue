<template>
  <div class="audit-markdown" v-html="renderedHtml" />
</template>

<script>
const escapeHtml = value => String(value || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;')

const renderInline = value => escapeHtml(value)
  .replace(/`([^`]+)`/g, '<code>$1</code>')
  .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  .replace(/__([^_]+)__/g, '<strong>$1</strong>')
  .replace(/\*([^*]+)\*/g, '<em>$1</em>')

const isTableSeparator = line => /^\s*\|?(?:\s*:?-{3,}:?\s*\|)+\s*:?-{3,}:?\s*\|?\s*$/.test(line)
const tableCells = line => line.trim().replace(/^\||\|$/g, '').split('|').map(cell => cell.trim())
const visibleAuditContent = source => String(source || '')
  .replace(/(^|\n)\s*JIRA标题\s*[：:]\s*[^\r\n]*(?=\r?$|\n)/gi, '$1')

function renderMarkdown(source, hideJiraTitle) {
  const content = hideJiraTitle ? visibleAuditContent(source) : String(source || '')
  const lines = content.replace(/\r\n?/g, '\n').split('\n')
  const output = []
  let index = 0
  let listType = ''
  let inCode = false

  const closeList = () => {
    if (!listType) return
    output.push(`</${listType}>`)
    listType = ''
  }

  while (index < lines.length) {
    const line = lines[index]
    if (/^```/.test(line.trim())) {
      closeList()
      output.push(inCode ? '</code></pre>' : '<pre><code>')
      inCode = !inCode
      index += 1
      continue
    }
    if (inCode) {
      output.push(`${escapeHtml(line)}\n`)
      index += 1
      continue
    }
    if (line.includes('|') && index + 1 < lines.length && isTableSeparator(lines[index + 1])) {
      closeList()
      const headers = tableCells(line)
      output.push(`<div class="markdown-table-wrap"><table><thead><tr>${headers.map(cell => `<th>${renderInline(cell)}</th>`).join('')}</tr></thead><tbody>`)
      index += 2
      while (index < lines.length && lines[index].includes('|') && lines[index].trim()) {
        output.push(`<tr>${tableCells(lines[index]).map(cell => `<td>${renderInline(cell)}</td>`).join('')}</tr>`)
        index += 1
      }
      output.push('</tbody></table></div>')
      continue
    }
    const heading = line.match(/^(#{1,4})\s+(.+)$/)
    if (heading) {
      closeList()
      const level = Math.min(heading[1].length + 2, 6)
      output.push(`<h${level}>${renderInline(heading[2])}</h${level}>`)
      index += 1
      continue
    }
    const unordered = line.match(/^\s*[-*+]\s+(.+)$/)
    const ordered = line.match(/^\s*\d+[.)]\s+(.+)$/)
    if (unordered || ordered) {
      const nextType = ordered ? 'ol' : 'ul'
      if (listType !== nextType) {
        closeList()
        listType = nextType
        output.push(`<${listType}>`)
      }
      output.push(`<li>${renderInline((unordered || ordered)[1])}</li>`)
      index += 1
      continue
    }
    closeList()
    if (!line.trim()) {
      index += 1
      continue
    }
    const quote = line.match(/^>\s?(.*)$/)
    output.push(quote ? `<blockquote>${renderInline(quote[1])}</blockquote>` : `<p>${renderInline(line)}</p>`)
    index += 1
  }
  closeList()
  if (inCode) output.push('</code></pre>')
  return output.join('')
}

export default {
  name: 'AuditMarkdown',
  props: {
    content: { type: String, default: '' },
    hideJiraTitle: { type: Boolean, default: false }
  },
  computed: {
    renderedHtml() {
      return renderMarkdown(this.content, this.hideJiraTitle)
    }
  }
}
</script>

<style scoped>
.audit-markdown { color:#34404c; font-size:13px; line-height:1.72; overflow-wrap:anywhere; }
.audit-markdown /deep/ p { margin:7px 0; }
.audit-markdown /deep/ h3,.audit-markdown /deep/ h4,.audit-markdown /deep/ h5,.audit-markdown /deep/ h6 { margin:15px 0 7px; color:#263746; font-size:13px; line-height:1.45; }
.audit-markdown /deep/ h3:first-child,.audit-markdown /deep/ h4:first-child,.audit-markdown /deep/ h5:first-child,.audit-markdown /deep/ h6:first-child,.audit-markdown /deep/ p:first-child { margin-top:0; }
.audit-markdown /deep/ ul,.audit-markdown /deep/ ol { margin:7px 0; padding-left:21px; }
.audit-markdown /deep/ li { margin:4px 0; }
.audit-markdown /deep/ blockquote { margin:9px 0; padding:7px 10px; color:#596b7c; background:#f4f7fa; border-left:3px solid #8ab5d8; }
.audit-markdown /deep/ code { padding:1px 4px; color:#b23b3b; background:#f3f4f6; border-radius:3px; font-family:Menlo,Monaco,Consolas,monospace; font-size:12px; }
.audit-markdown /deep/ pre { overflow:auto; margin:9px 0; padding:10px; color:#dfe8f1; background:#293746; border-radius:4px; line-height:1.55; }
.audit-markdown /deep/ pre code { padding:0; color:inherit; background:transparent; }
.audit-markdown /deep/ .markdown-table-wrap { max-width:100%; overflow-x:auto; margin:10px 0; }
.audit-markdown /deep/ table { width:100%; border-collapse:collapse; background:#fff; font-size:12px; }
.audit-markdown /deep/ th,.audit-markdown /deep/ td { padding:7px 8px; border:1px solid #dce4ec; text-align:left; vertical-align:top; }
.audit-markdown /deep/ th { color:#425466; background:#f3f6f9; font-weight:600; }
</style>
