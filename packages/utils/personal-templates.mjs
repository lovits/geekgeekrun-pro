import fs from 'node:fs'
import { atomicWriteFile } from './atomic-file-write.mjs'

const textKinds = ['expected-companies', 'blocked-companies', 'job-preferences', 'hr-profile', 'hr-prompt']
export function readPersonalTemplates(file) {
  if (!fs.existsSync(file)) return []
  const data = JSON.parse(fs.readFileSync(file, 'utf8'))
  if (!Array.isArray(data)) throw new Error('个人模板文件格式有误，请检查本地文件')
  return data
}
export async function savePersonalTemplate(file, entry) {
  if (typeof entry?.name !== 'string' || !entry.name.trim() || entry.name.length > 60 || !(textKinds.includes(entry.kind) ? typeof entry.data === 'string' : entry.kind === 'job-regex' && entry.data && typeof entry.data === 'object' && !Array.isArray(entry.data)) || JSON.stringify(entry.data).length > 200000) throw new Error('模板名称或内容无效')
  const templates = readPersonalTemplates(file), name = entry.name.trim()
  if (templates.some(item => item.kind === entry.kind && item.name === name)) throw new Error('该名称已存在，请使用其他名称')
  templates.push({ name, kind: entry.kind, data: entry.data })
  await atomicWriteFile(file, JSON.stringify(templates))
}
export async function deletePersonalTemplate(file, { kind, name }) {
  await atomicWriteFile(file, JSON.stringify(readPersonalTemplates(file).filter(item => item.kind !== kind || item.name !== name)))
}

export async function initializePersonalTemplates(file, kind, defaults) {
  if (![...textKinds, 'job-regex'].includes(kind) || !Array.isArray(defaults) || defaults.length > 500 || defaults.some(item => typeof item?.name !== 'string' || !item.name.trim() || item.name.length > 60 || (kind === 'job-regex' ? !item.data || typeof item.data !== 'object' || Array.isArray(item.data) : typeof item.data !== 'string') || JSON.stringify(item.data).length > 200000)) throw new Error('模板数据无效')
  const entries = readPersonalTemplates(file)
  if (!entries.some(item => item.kind === '__initialized__' && item.name === kind)) {
    for (const item of defaults) {
      if (!entries.some(existing => existing.kind === kind && existing.name === item.name)) entries.push({ kind, name: item.name, data: item.data })
    }
    entries.push({ kind: '__initialized__', name: kind })
    await atomicWriteFile(file, JSON.stringify(entries))
  }
  return entries.filter(item => item.kind === kind)
}
