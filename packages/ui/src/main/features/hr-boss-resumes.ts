import { initPuppeteer } from '@geekgeekrun/geek-auto-start-chat-with-boss/index.mjs'
import { readStorageFile } from '@geekgeekrun/geek-auto-start-chat-with-boss/runtime-file-utils.mjs'
import { setDomainLocalStorage } from '@geekgeekrun/utils/puppeteer/local-storage.mjs'
import { readBossResumes } from '@geekgeekrun/utils/hr-auto-reply-browser.mjs'
import { getLastUsedAndAvailableBrowser } from '../flow/DOWNLOAD_DEPENDENCIES/utils/browser-history'

export async function listBossResumeAttachments() {
  const executable = await getLastUsedAndAvailableBrowser()
  if (!executable) throw new Error('请先配置招聘浏览器')
  const cookies = readStorageFile('boss-cookies.json') || []
  if (!cookies.length) throw new Error('请先保存BOSS登录凭据')
  const { puppeteer } = await initPuppeteer()
  const browser = await puppeteer.launch({ executablePath: executable.executablePath, headless: false, defaultViewport: { width: 1200, height: 800 } })
  try {
    const page = (await browser.pages())[0]
    await page.setCookie(...cookies)
    await setDomainLocalStorage(browser, 'https://www.zhipin.com/desktop/', readStorageFile('boss-local-storage.json') || {})
    await page.goto('https://www.zhipin.com/web/geek/resume', { waitUntil: 'networkidle2', timeout: 60000 })
    return await readBossResumes(page)
  } finally { await browser.close() }
}
