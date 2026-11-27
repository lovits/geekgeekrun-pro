import { testJobRegex } from '@geekgeekrun/utils/job-filter-options.mjs'

export function canStartChat({ expectedJobId, jobInfo, selectedJob, companies, blockedCompanyPattern, patterns, matchLogic = 1 }) {
  if (!expectedJobId || jobInfo?.encryptId !== expectedJobId || selectedJob?.encryptJobId !== expectedJobId) return false
  if (!jobInfo.jobName || !selectedJob.jobName || jobInfo.jobName !== selectedJob.jobName) return false
  const company = selectedJob.brandName?.toLowerCase()
  if (!company || (companies.length && !companies.some(name => company.includes(name.toLowerCase())))) return false
  try {
    if (blockedCompanyPattern?.trim() && new RegExp(blockedCompanyPattern, 'im').test(company)) return false
    return testJobRegex(jobInfo, patterns, matchLogic)
  } catch {
    return false
  }
}

export async function installChatRequestGuard(page, { simulation = false, canSendNow = () => true } = {}) {
  let approvedJobId = null
  await page.setRequestInterception(true)
  page.on('request', request => {
    if (request.isInterceptResolutionHandled()) return
    const url = new URL(request.url())
    const isChatRequest = url.hostname === 'www.zhipin.com' && url.pathname === '/wapi/zpgeek/friend/add.json'
    const isBoss = url.hostname === 'zhipin.com' || url.hostname.endsWith('.zhipin.com')
    const isUnsuitableFeedback = url.hostname === 'www.zhipin.com' && url.pathname === '/wapi/zpgeek/negativefeedback/save.json' && request.method() === 'POST'
    const simulationWrite = simulation && isBoss && !isUnsuitableFeedback && (!['GET', 'HEAD', 'OPTIONS'].includes(request.method()) || /\/friend\/add\.json$/.test(url.pathname))
    if (simulationWrite || (isChatRequest && (simulation || !canSendNow() || !approvedJobId || url.searchParams.get('jobId') !== approvedJobId))) {
      void request.abort('blockedbyclient').catch(() => {})
    } else {
      void request.continue().catch(() => {})
    }
  })
  return {
    approve(jobId) { if (!simulation) approvedJobId = jobId },
    clear() { approvedJobId = null }
  }
}
