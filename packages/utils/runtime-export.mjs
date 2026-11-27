import { applicationOutcome } from './application-outcome.mjs'

export const exportScopes = {
  chats: { label: '开聊记录', table: 'v_chat_startup_log', dateField: 'date', dateLabel: '开聊时间' },
  replies: { label: '回复记录', table: 'replies', dateField: 'at', dateLabel: '处理时间' },
  unsuitable: { label: '标记不合适记录', table: 'v_mark_as_not_suit_log', dateField: 'date', dateLabel: '标记时间' },
  jobs: { label: '职位库', table: 'v_job_library', dateField: 'publishDate', dateLabel: '岗位发布日期' },
  simulation: { label: '模拟开聊记录', table: 'simulation', dateField: 'date', dateLabel: '记录时间' },
  companies: { label: '公司库', table: 'v_company_library' },
  all: { label: '全部历史记录' }
}
export const exportReasonNames = ['未知原因', 'BOSS不活跃', '手动标记不合适', '职位不合适', '工作地不合适', '工作经验不合适', '薪资不合适', '公司名称不匹配']

export function normalizeExportOptions(options = {}) {
  const scope = options.scope || 'all'
  if (!Object.hasOwn(exportScopes, scope)) throw new Error('请选择有效的导出范围')
  const format = scope === 'all' ? 'json' : options.format || 'csv'
  if (!['json', 'csv'].includes(format)) throw new Error('导出格式无效')
  const filters = {}
  if (scope !== 'all') {
    for (const key of scope === 'companies' ? ['company', 'industry'] : scope === 'replies' ? ['company', 'job'] : ['company', 'job', 'city']) {
      const value = options.filters?.[key] ?? ''
      if (typeof value !== 'string' || value.length > 200) throw new Error('筛选关键词无效或过长')
      filters[key] = value.trim()
    }
    if (scope !== 'companies') {
      if (scope !== 'replies') {
        filters.feedback = options.filters?.feedback || 'all'
        if (!['all', 'like', 'dislike', 'unmarked'].includes(filters.feedback)) throw new Error('偏好标签无效')
      }
      filters.startDate = options.filters?.startDate || ''
      filters.endDate = options.filters?.endDate || ''
      for (const value of [filters.startDate, filters.endDate]) if (value && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value)) throw new Error('日期范围无效')
      if (filters.startDate && filters.endDate && filters.startDate > filters.endDate) throw new Error('开始日期不能晚于结束日期')
    }
    if (scope === 'simulation') {
      filters.outcome = options.filters?.outcome || 'all'
      filters.score = options.filters?.score || 'all'
      if (!['all', 'eligible', 'ineligible', 'delivered', 'failed'].includes(filters.outcome)) throw new Error('沟通状态无效')
      if (!['all', 'scored', 'unscored'].includes(filters.score)) throw new Error('AI分数筛选无效')
    }
    if (scope === 'unsuitable' && options.filters?.markReason != null && options.filters.markReason !== '') {
      const reason = options.filters.markReason
      if (!Number.isInteger(reason) || reason < 0 || reason > 7) throw new Error('标记原因无效')
      filters.markReason = reason
    }
  }
  return { scope, format, filters }
}

function recordTime(value) {
  if (typeof value === 'number') return value
  if (!value) return NaN
  const text = String(value).trim()
  if (/^\d{13}$/.test(text)) return Number(text)
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return Date.parse(text + 'T00:00:00+08:00')
  // SQLite stores the application's timestamps as UTC without an offset.
  return Date.parse(text.replace(' ', 'T') + (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(text) ? '' : 'Z'))
}

export function selectExportRecords(database, options, feedback = []) {
  const { scope, filters } = normalizeExportOptions(options)
  if (scope === 'all') throw new Error('全部历史记录应使用完整导出')
  const definition = exportScopes[scope]
  const source = database[definition.table]
  const rows = scope === 'simulation' && Array.isArray(source) ? source.map(row => ({ ...row, encryptJobId: row.jobId, companyName: row.company, address: row.city, date: row.recordedAt || row.evaluatedAt || row.chattedAt || row.sourceUpdatedAt || row.snapshot?.date || null, communicationStatus: row.status === 'error' ? '评估失败' : ({ eligible: '拟沟通', ineligible: '未沟通', delivered: '已沟通' })[applicationOutcome(row)] || '未完成判断' })) : source
  if (!Array.isArray(rows)) throw new Error('缺少所选类型的数据，无法导出')
  const marks = new Map(feedback.filter(item => ['like', 'dislike'].includes(item.value)).map(item => [String(item.jobId), item.value]))
  const contains = (value, needle) => !needle || String(value || '').toLocaleLowerCase().includes(needle.toLocaleLowerCase())
  const start = filters.startDate ? Date.parse(filters.startDate + 'T00:00:00+08:00') : -Infinity
  const end = filters.endDate ? Date.parse(filters.endDate + 'T00:00:00+08:00') + 86400000 : Infinity
  return rows.filter(row => {
    if (scope === 'replies') {
      if (!contains(row.company, filters.company) || !contains(row.job, filters.job)) return false
      if (filters.startDate || filters.endDate) {
        const time = recordTime(row.at)
        if (!Number.isFinite(time) || time < start || time >= end) return false
      }
      return true
    }
    if (!contains([row.companyName, row.name, row.brandName].filter(Boolean).join(' '), filters.company)) return false
    if (scope === 'companies') return contains(row.industryName, filters.industry)
    if (!contains(row.jobName, filters.job) || !contains(row.address, filters.city)) return false
    if (scope === 'simulation' && filters.outcome !== 'all' && (filters.outcome === 'failed' ? row.status !== 'error' : applicationOutcome(row) !== filters.outcome)) return false
    if (scope === 'simulation' && filters.score !== 'all' && (filters.score === 'scored') !== Number.isFinite(row.score)) return false
    if (filters.markReason != null && row.markReason !== filters.markReason) return false
    if (filters.feedback !== 'all' && (marks.get(String(row.encryptJobId)) || 'unmarked') !== filters.feedback) return false
    if (filters.startDate || filters.endDate) {
      const time = recordTime(row[definition.dateField])
      if (!Number.isFinite(time) || time < start || time >= end) return false
    }
    return true
  }).map(row => scope === 'companies' || scope === 'replies' ? { ...row } : { ...row, preferenceFeedback: marks.get(String(row.encryptJobId)) || 'unmarked', ...(scope === 'unsuitable' ? { markReasonLabel: exportReasonNames[row.markReason] || '未知原因' } : {}) })
}

const columnLabels = { at: '处理时间（北京时间）', company: '公司', boss: 'HR', job: '职位', message: '收到的消息', reply: '回复内容', status: '处理状态', communicationStatus: '沟通状态', score: 'AI分数', reason: '原因', url: '职位链接', jobName: '职位名称', companyName: '公司', positionName: '职位分类', date: '记录时间', description: '岗位描述', publishDate: '岗位发布日期', address: '工作地', degreeName: '学历', experienceName: '工作经验', salaryLow: '薪资下限', salaryHigh: '薪资上限', salaryMonth: '薪资月数', bossName: 'BOSS姓名', bossTitle: 'BOSS职位', userName: '用户', encryptJobId: '职位ID', encryptCompanyId: '公司ID', encryptBossId: 'BOSS ID', markReason: '不合适原因编号', markFrom: '标记来源', extInfo: '标记详情', preferenceFeedback: '喜欢/不喜欢标签', name: '公司名称', brandName: '公司品牌', scaleLow: '规模下限', scaleHigh: '规模上限', stageName: '融资阶段', industryName: '行业' }
export function recordsToCsv(records, scope) {
  const keys = [...new Set(records.flatMap(row => Object.keys(row)))]
  const escape = value => {
    let text = value == null ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value)
    if (typeof value === 'string' && /^[\s]*[=+\-@]/.test(text)) text = "'" + text
    return '"' + text.replaceAll('"', '""') + '"'
  }
  const value = (row, key) => {
    if (scope === 'replies' && key === 'status') return ({ skipped: '无需回复', processing: '处理中', replied: '已回复', resume_sent: '已同意发简历', resume_requested: '已发起简历发送', wechat_exchanged: '已同意换微信', wechat_requested: '已发起换微信', phone_exchanged: '已同意换电话', phone_requested: '已发起换电话', manual: '待人工处理', failed: '处理失败', uncertain: '结果待核对', superseded: '消息更新未发' })[row[key]] || row[key]
    if (key === 'preferenceFeedback') return { like: '喜欢', dislike: '不喜欢', unmarked: '未标记' }[row[key]] || row[key]
    if (['date', 'publishDate', 'at'].includes(key)) {
      const time = recordTime(row[key])
      if (Number.isFinite(time)) return new Date(time).toLocaleString('sv-SE', { timeZone: 'Asia/Shanghai', hour12: false })
    }
    return row[key]
  }
  const headers = keys.map(key => key === 'date' ? exportScopes[scope].dateLabel + '（北京时间）' : key === 'publishDate' ? '岗位发布日期（北京时间）' : key === 'markReasonLabel' ? '不合适原因' : columnLabels[key] || key)
  return '\uFEFF' + [headers.map(escape).join(','), ...records.map(row => keys.map(key => escape(value(row, key))).join(','))].join('\r\n')
}
