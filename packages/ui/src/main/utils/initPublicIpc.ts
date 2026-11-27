import { configSaveHandler, waitForConfigSaves, validateConfigRegex } from '../features/config-save'
import { companyListMemberships, setCompanyListMembership } from '@geekgeekrun/utils/company-list-actions.mjs'
import { jobFilterOptions } from '@geekgeekrun/utils/job-filter-options.mjs'
import { BrowserWindow, dialog, ipcMain, shell } from 'electron'
import gtag from './gtag'
import { projectUrl } from '@geekgeekrun/utils/project-links.mjs'
import buildInfo from '../../common/build-info.json'
import os from 'node:os'
import fs from 'node:fs'
import path from 'node:path'
import { readPersonalTemplates, savePersonalTemplate, deletePersonalTemplate, initializePersonalTemplates } from '@geekgeekrun/utils/personal-templates.mjs'
import {
  ensureStorageFileExist,
  writeStorageFile,
  configFileNameList,
  readConfigFile,
  readStorageFile,
  writeConfigFile
} from '@geekgeekrun/geek-auto-start-chat-with-boss/runtime-file-utils.mjs'
import { configFolderPath } from '@geekgeekrun/geek-auto-start-chat-with-boss/runtime-file-utils.mjs'

import { registerBrowserAssistantIpc } from '../window/browserAssistantWindow'

export default function initPublicIpc() {
  registerBrowserAssistantIpc()
  const templatePath = path.join(configFolderPath, 'personal-templates.json')
  ipcMain.handle('list-personal-templates', async () => { await waitForConfigSaves(); return readPersonalTemplates(templatePath) })
  configSaveHandler('initialize-personal-templates', (_, { kind, defaults }) => initializePersonalTemplates(templatePath, kind, defaults))
  configSaveHandler('save-personal-template', (_, entry) => savePersonalTemplate(templatePath, entry))
  configSaveHandler('delete-personal-template', (_, entry) => deletePersonalTemplate(templatePath, entry))
  let companyWrites = Promise.resolve()
  const queueCompanyWrite = action => {
    const operation = companyWrites.catch(() => {}).then(action)
    companyWrites = operation.then(() => {}, () => {})
    return operation
  }
  configSaveHandler('save-common-job-condition-config', (event, payload, { embedded = false } = {}) => queueCompanyWrite(async () => {
    validateConfigRegex(payload)
    payload = { ...readConfigFile('common-job-condition-config.json'), ...payload }
    await writeConfigFile('common-job-condition-config.json', payload)
    for (const win of BrowserWindow.getAllWindows()) win.webContents.send('common-job-condition-config-updated', { config: payload, memberships: companyListMemberships({ common: payload, boss: readConfigFile('boss.json'), targets: readConfigFile('target-company-list.json') }) })
    if (!embedded) BrowserWindow.fromWebContents(event.sender)?.close()
  }))
  ipcMain.handle('get-company-list-memberships', () => companyListMemberships({ common: readConfigFile('common-job-condition-config.json'), boss: readConfigFile('boss.json'), targets: readConfigFile('target-company-list.json') }))
  ipcMain.handle('set-company-list-membership', (_, { company, list, enabled: requested } = {}) => queueCompanyWrite(async () => {
    const common = readConfigFile('common-job-condition-config.json'), boss = readConfigFile('boss.json'), targets = readConfigFile('target-company-list.json')
    const next = setCompanyListMembership({ common, boss, targets }, company, list, requested)
    const updates = [['common-job-condition-config.json', common, next.common], ['boss.json', boss, next.boss], ['target-company-list.json', targets, next.targets]]
    let changed = false
    for (const [file, before, after] of updates) if (JSON.stringify(before) !== JSON.stringify(after)) { await writeConfigFile(file, after); changed = true }
    for (const win of BrowserWindow.getAllWindows()) win.webContents.send('common-job-condition-config-updated', { config: next.common, targetCompanies: next.targets, blockedCompanies: next.boss.blockCompanyNameRegExpStr || '', memberships: next.memberships })
    const switches = jobFilterOptions(readConfigFile('job-ai-match.json')).regex
    const enabled = switches[list === 'expected' ? 'companies' : 'blockedCompanies']
    return { changed, memberships: next.memberships, warning: !requested && list === 'blocked' && switches.blockedCompanies && next.blocked ? '已移除此公司的独立条目，但仍匹配其他屏蔽规则；可到公共设置查看。' : !enabled ? '名单已保存；对应公司筛选开关当前关闭，启用后生效。' : list === 'expected' && switches.blockedCompanies && next.blocked ? '已加入期望公司，但仍命中屏蔽规则；屏蔽规则优先。' : '' }
  }))
  ipcMain.on(
    'update-window-size',
    (
      ev,
      size: {
        width: number
        height: number
        animate?: boolean
      }
    ) => {
      const win = BrowserWindow.fromWebContents(ev.sender)
      if (!win) {
        return
      }
      win.setMinimumSize(size.width, size.height)
      win.setSize(size.width, size.height, size.animate)
    }
  )
  ipcMain.on('open-external-link', (_, link) => {
    shell.openExternal(link, {
      activate: true
    })
  })
  ipcMain.on('gtag', (_ev, { name, params } = {}) => {
    gtag(name, {
      ...params,
      electron_log_source: 'renderer'
    })
  })
  ipcMain.on('send-feed-back-to-github-issue', (_ev, _payload) => {
    const getIssueUrlWithBody = (issueBody: string = '') => {
      const baseUrl = `${projectUrl}/issues/new`
      issueBody = issueBody || ''
      if (!issueBody || !issueBody.trim()) {
        return baseUrl
      }
      const urlObj = new URL(baseUrl)
      urlObj.searchParams.append('body', issueBody)

      return urlObj.toString()
    }

    shell.openExternal(
      getIssueUrlWithBody(`\n\n\n-----
版本号：${buildInfo.version}(${buildInfo.buildVersion})
提交：${buildInfo.buildHash.substring(0, 6)}
操作系统信息: \`${os.type()}\` / \`${os.release()}\` / \`${os.arch()}\``),
      {
        activate: true
      }
    )
  })

  ipcMain.handle('read-storage-file', async (_ev, payload) => {
    ensureStorageFileExist()
    return await readStorageFile(payload.fileName)
  })

  ipcMain.handle('write-storage-file', async (_ev, payload) => {
    ensureStorageFileExist()
    return await writeStorageFile(payload.fileName, JSON.parse(payload.data))
  })
  ipcMain.handle('get-os-platform', () => {
    return os.platform()
  })
  ipcMain.handle('choose-file', (ev, { fileChooserConfig }) => {
    if (!fileChooserConfig) {
      fileChooserConfig = {}
    }
    const win = BrowserWindow.fromWebContents(ev.sender)
    if (!win) {
      return dialog.showOpenDialog(fileChooserConfig)
    } else {
      return dialog.showOpenDialog(win, fileChooserConfig)
    }
  })
  ipcMain.handle('check-executable-file', (_ev, filePath: string) => {
    if (!filePath?.trim()) {
      return {
        message: '文件名无效'
      }
    }
    if (!fs.existsSync(filePath)) {
      return {
        message: '文件不存在'
      }
    }
    if (!fs.statSync(filePath).isFile()) {
      const messageSeg = ['文件不是可执行文件']
      if (os.platform() === 'darwin') {
        messageSeg.push(
          'macOS 平台，可执行文件位于“App包.app/Contents/MacOS/ 文件夹下”，而不是“App包.app”文件夹整体'
        )
      }
      return {
        message: messageSeg.join('；')
      }
    }
    return null
  })

  ipcMain.handle('fetch-config-file-content', async () => {
    await waitForConfigSaves()
    const configFileContentList = configFileNameList.map((fileName) => {
      return readConfigFile(fileName)
    })
    const result = {
      config: {}
    }

    configFileNameList.forEach((fileName, index) => {
      result.config[fileName] = configFileContentList[index]
    })

    return result
  })
}
