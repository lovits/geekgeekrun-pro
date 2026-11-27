import semver from 'semver'
import { projectUrl, releasesApi } from './project-links.mjs'

export function isNewerRelease(release, currentVersion) {
  const version = semver.valid(release?.releaseVersion)
  const current = semver.valid(currentVersion)
  return Boolean(version && current && semver.gt(version, current))
}

export function selectReleaseUpdate(releases, currentVersion, platform, arch) {
  if (!Array.isArray(releases)) throw new Error('GitHub 未返回有效版本列表')
  const extension = { win32: '.exe', darwin: '.dmg', linux: '.deb' }[platform]
  if (!extension) return null
  const candidates = releases.filter(r => !r.draft && !r.prerelease && semver.valid(r.tag_name?.replace(/^(ui-v|v)/, '')))
    .sort((a, b) => semver.rcompare(a.tag_name.replace(/^(ui-v|v)/, ''), b.tag_name.replace(/^(ui-v|v)/, '')))
  for (const release of candidates) {
    const version = release.tag_name.replace(/^(ui-v|v)/, '')
    if (!semver.gt(version, currentVersion)) continue
    const assets = (release.assets || []).filter(a => a.name.endsWith(extension) && /^https:\/\/github\.com\//.test(a.browser_download_url || ''))
    const asset = assets.find(a => a.name.includes(`_${arch}`) || a.name.includes(`-${arch}`)) || assets.find(a => !/(?:x64|arm64|ia32)/.test(a.name))
    if (asset) return { releaseVersion: version, releasePageUrl: release.html_url, assetUrl: asset.browser_download_url, assetName: asset.name, releaseNote: release.body || '', ...(asset.digest ? { assetDigest: asset.digest } : {}) }
  }
  return null
}

export async function checkReleaseUpdate(currentVersion, platform, arch, request = fetch) {
  const response = await request(releasesApi, { headers: { Accept: 'application/vnd.github+json' }, signal: AbortSignal.timeout(15000) })
  if (response.ok) return selectReleaseUpdate(await response.json(), currentVersion, platform, arch)
  if (![403, 429].includes(response.status)) throw new Error(`GitHub 检查更新失败（HTTP ${response.status}），请稍后重试`)
  const latest = await request(`${projectUrl}/releases/latest`, { signal: AbortSignal.timeout(15000) })
  if (!latest.ok) throw new Error(`GitHub 检查更新失败（HTTP ${latest.status}），请稍后重试`)
  const prefix = `${projectUrl}/releases/tag/`
  if (!latest.url.startsWith(prefix)) throw new Error('GitHub 发布页面地址无效')
  const tag = latest.url.slice(prefix.length)
  if (!/^(?:ui-v|v)\d+\.\d+\.\d+$/.test(tag)) throw new Error('GitHub 发布版本格式无效')
  const assetsPage = await request(`${projectUrl}/releases/expanded_assets/${tag}`, { signal: AbortSignal.timeout(15000) })
  if (!assetsPage.ok) throw new Error(`GitHub 安装包列表获取失败（HTTP ${assetsPage.status}）`)
  const html = await assetsPage.text()
  const assetPrefix = new URL(projectUrl).pathname + `/releases/download/${tag}/`
  const assets = [...html.matchAll(/href="([^"]+)"/g)].map(([, href]) => href).filter(href => href.startsWith(assetPrefix) && /^[\w.\-/]+$/.test(href)).map(href => ({ name: href.slice(assetPrefix.length), browser_download_url: `https://github.com${href}` }))
  return selectReleaseUpdate([{ tag_name: tag, html_url: latest.url, assets, body: '请前往 GitHub 发布页面查看更新说明。' }], currentVersion, platform, arch)
}
