import test from 'node:test'
import assert from 'node:assert/strict'
import { selectReleaseUpdate, checkReleaseUpdate } from './release-update.mjs'
const asset = name => ({ name, browser_download_url: 'https://github.com/lovits/geekgeekrun-pro/releases/download/ui-v0.18.0/' + name })
const release = { tag_name: 'ui-v0.18.0', html_url: 'https://github.com/lovits/geekgeekrun-pro/releases/tag/ui-v0.18.0', assets: [asset('app_arm64.dmg'), asset('app_x64.dmg'), asset('app_x64_setup.exe')] }
test('checks newer stable releases and selects the current platform and architecture', () => {
  assert.equal(selectReleaseUpdate([release], '0.17.4', 'win32', 'x64').assetName, 'app_x64_setup.exe')
  assert.equal(selectReleaseUpdate([release], '0.17.4', 'darwin', 'arm64').assetName, 'app_arm64.dmg')
  assert.equal(selectReleaseUpdate([release], '0.18.0', 'darwin', 'arm64'), null)
  assert.equal(selectReleaseUpdate([release], '0.17.4', 'win32', 'arm64'), null)
  assert.equal(selectReleaseUpdate([{...release, prerelease:true}], '0.17.4', 'darwin', 'arm64'), null)
  assert.equal(selectReleaseUpdate([{...release, tag_name:'not-a-version'}], '0.17.4', 'darwin', 'arm64'), null)
  assert.equal(selectReleaseUpdate([{...release, assets:[]}], '0.17.4', 'darwin', 'arm64'), null)
  assert.equal(selectReleaseUpdate([], '0.17.4', 'darwin', 'arm64'), null)
  assert.throws(()=>selectReleaseUpdate({},'0.17.4','win32','x64'))
})

test('cached update only remains visible when newer than installed version', async () => {
  const { isNewerRelease } = await import('./release-update.mjs')
  assert.equal(isNewerRelease({ releaseVersion: '0.20.2' }, '0.20.2'), false)
  assert.equal(isNewerRelease({ releaseVersion: '0.20.1' }, '0.20.2'), false)
  assert.equal(isNewerRelease({ releaseVersion: '0.20.3' }, '0.20.2'), true)
  assert.equal(isNewerRelease({ releaseVersion: 'invalid' }, '0.20.2'), false)
})

test('when GitHub API is rate-limited, checks the stable release page and matching installer', async () => {
  const calls = []
  const request = async url => {
    calls.push(url)
    if (url.includes('api.github.com')) return { ok: false, status: 403 }
    if (url.endsWith('/releases/latest')) return { ok: true, url: 'https://github.com/lovits/geekgeekrun-pro/releases/tag/ui-v0.20.4' }
    return { ok: true, text: async () => '<a href="/lovits/geekgeekrun-pro/releases/download/ui-v0.20.4/geekgeekrun-pro_0.20.4_arm64.dmg">download</a><a href="https://evil.example/a.dmg">bad</a>' }
  }
  const result = await checkReleaseUpdate('0.20.3', 'darwin', 'arm64', request)
  assert.equal(result.releaseVersion, '0.20.4')
  assert.equal(result.assetName, 'geekgeekrun-pro_0.20.4_arm64.dmg')
  assert.equal(await checkReleaseUpdate('0.20.4', 'darwin', 'arm64', request), null)
  assert.equal(calls.length, 6)
})
