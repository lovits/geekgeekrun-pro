import fs from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { atomicWriteFile } from './atomic-file-write.mjs'

export function hrContextKey(parts) { return createHash('sha256').update(JSON.stringify(parts)).digest('hex') }
export async function readHrContext(file) {
  try { return JSON.parse(await fs.readFile(file, 'utf8')) }
  catch (error) { if (error.code === 'ENOENT') return null; throw error }
}
export async function saveHrScreeningSnapshot(directory, jobId, input, decision) {
  if (!jobId) return
  const folder = path.join(directory, 'hr-screening')
  await fs.mkdir(folder, { recursive: true, mode: 0o700 })
  await atomicWriteFile(path.join(folder, hrContextKey([jobId]) + '.json'), JSON.stringify({ input, decision, at: new Date().toISOString() }))
}

export async function saveHrJobSnapshot(directory, jobId, jobInfo, selectedJob = {}) {
  if (!jobId) return
  const folder = path.join(directory, 'hr-jobs')
  await fs.mkdir(folder, { recursive: true, mode: 0o700 })
  const keys = ['jobName', 'postDescription', 'experienceName', 'degreeName', 'salaryDesc', 'jobType', 'address', 'cityName', 'brandName', 'brandIndustry', 'brandScaleName']
  const job = Object.fromEntries(keys.map(key => [key, jobInfo?.[key] ?? selectedJob[key]]).filter(([, value]) => value !== undefined))
  await atomicWriteFile(path.join(folder, hrContextKey([jobId]) + '.json'), JSON.stringify(job))
}
