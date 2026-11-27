import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { defaultAutoChatSchedule, validateAutoChatSchedule, autoChatWindow, assertAutoChatTime } from './auto-chat-schedule.mjs'

const root = path.join(os.homedir(), '.geekgeekrun')
export const autoChatSchedulePath = path.join(root, 'config/auto-chat-schedule.json')
export const autoChatScheduleStatePath = path.join(root, 'storage/auto-chat-schedule-state.json')
export const autoChatSchedulePausePath = path.join(root, 'storage/auto-chat-schedule-pause.json')
export function readScheduleJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')) }
  catch (error) { if (error.code === 'ENOENT') return fallback; throw error }
}
export function readAutoChatSchedule() { return validateAutoChatSchedule(readScheduleJson(autoChatSchedulePath, defaultAutoChatSchedule)) }
export function checkAutoChatTime() {
  if (process.env.GEEKGEEKRUND_WORKER_ID === 'geekSimulateApplications' || process.argv.some(arg => arg === '--mode=geekSimulateApplications' || arg === '--mode=verifyBossFilters')) return
  assertAutoChatTime(readAutoChatSchedule(), new Date(), { scheduled: process.env.GEEKGEEKRUN_SCHEDULED_CHAT === '1', pausedWindow: readScheduleJson(autoChatSchedulePausePath, '') })
}
export function autoChatAllowedNow() { try { checkAutoChatTime(); return true } catch { return false } }
export function currentAutoChatWindow() { return autoChatWindow(readAutoChatSchedule()) }
