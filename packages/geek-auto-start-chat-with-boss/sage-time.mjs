import { checkAutoChatTime } from '@geekgeekrun/utils/auto-chat-schedule-store.mjs'
import { waitAndCheckAutoChatTime } from '@geekgeekrun/utils/auto-chat-schedule.mjs'
import { readConfigFile } from './runtime-file-utils.mjs'
import { sleep } from "@geekgeekrun/utils/sleep.mjs"
import { normalizeChatRestConfig } from '@geekgeekrun/utils/successful-chat-rest.mjs'

let totalEnabledTimes = 0
let recordedOpCount = 0
export const waitForSageTimeOrJustContinue = async ({
  tag,
  hooks,
} = {}) => {
  const { isSageTimeEnabled, sageTimePauseMinute, sageTimeOpTimes: rawCount } = normalizeChatRestConfig(readConfigFile('boss.json'))
  const sageTimeOpTimes = Number.isInteger(Number(rawCount)) && Number(rawCount) > 0 ? Number(rawCount) : 100
  if (!isSageTimeEnabled) {
    recordedOpCount = 0
    return
  }
  const tagText = tag ? ` ${tag}` : ''
  if (recordedOpCount >= sageTimeOpTimes) {
    totalEnabledTimes++
    console.log(`[SageTime${tagText}] 请求已达限制，开启；当前记录次数 ${recordedOpCount}；第 ${totalEnabledTimes} 次开启`)
    await hooks?.sageTimeEnter?.promise({
      tag,
      totalEnabledTimes,
      recordedOpCount,
    })
    await waitAndCheckAutoChatTime(sageTimePauseMinute * 60 * 1000, sleep, checkAutoChatTime)
    console.log(`[SageTime${tagText}] 请求限制已解除，关闭；当前记录次数 ${recordedOpCount}；第 ${totalEnabledTimes} 次关闭`)
    await hooks?.sageTimeExit?.promise({
      tag,
      totalEnabledTimes,
      recordedOpCount,
    })
    recordedOpCount = 1
  }
  else {
    console.log(`[SageTime${tagText}] 请求未达限制；当前记录次数 ${recordedOpCount}；已开启过 ${totalEnabledTimes} 次`)
    recordedOpCount++
  }
}