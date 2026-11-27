import { AUTO_CHAT_ERROR_EXIT_CODE } from '../../common/enums/auto-start-chat'
import { daemonEE, sendToDaemon } from '../flow/OPEN_SETTING_WINDOW/connect-to-daemon'
import { saveAndGetCurrentRunRecord } from '../flow/OPEN_SETTING_WINDOW/utils/db'
import minimist from 'minimist'

export async function runCommon({ mode, simulationLimit, simulationRunId, scheduled = false, keepHostAlive = false }: { mode: string; simulationLimit?: number; simulationRunId?: string; scheduled?: boolean; keepHostAlive?: boolean }) {
  await sendToDaemon(
    {
      type: 'user-process-register'
    },
    {
      needCallback: true
    }
  )
  const taskList = (
    await sendToDaemon(
      {
        type: 'get-status'
      },
      {
        needCallback: true
      }
    )
  )?.workers
  const runningTask = taskList?.find((it) => it.workerId === mode)
  if (runningTask) {
    const commandlineArgs = minimist(runningTask.args ?? [])
    const runRecordId = Number(commandlineArgs['run-record-id'])
    console.log('任务已在运行中')
    return {
      runRecordId,
      isAlreadyRunning: true
    }
  }
  const currentRunRecord = (await saveAndGetCurrentRunRecord())?.data
  const subProcessEnv = {
    ...process.env,
    ...(scheduled ? { GEEKGEEKRUN_SCHEDULED_CHAT: '1' } : {}),
    GEEKGEEKRUND_NO_AUTO_RESTART_EXIT_CODE: [
      AUTO_CHAT_ERROR_EXIT_CODE.PUPPETEER_IS_NOT_EXECUTABLE,
      AUTO_CHAT_ERROR_EXIT_CODE.LOGIN_STATUS_INVALID,
      AUTO_CHAT_ERROR_EXIT_CODE.LLM_UNAVAILABLE,
      AUTO_CHAT_ERROR_EXIT_CODE.SCHEDULE_CLOSED
    ].join(',')
  }
  const args =
    process.env.NODE_ENV === 'development'
      ? [process.argv[1], `--mode=${mode}`, `--run-record-id=${currentRunRecord?.id || 0}`]
      : [`--mode=${mode}`, `--run-record-id=${currentRunRecord?.id || 0}`]
  if (simulationLimit != null) args.push(`--simulation-limit=${simulationLimit}`, `--simulation-run-id=${simulationRunId}`)
  await sendToDaemon(
    {
      type: 'start-worker',
      workerId: mode,
      command: process.argv[0],
      args,
      env: subProcessEnv,
      keepAliveOnDisconnect: Boolean(keepHostAlive || globalThis.GEEKGEEKRUN_PROCESS_ROLE === 'ui')
    },
    {
      needCallback: true
    }
  )
  if (!keepHostAlive) daemonEE.on('message', (message) => {
    if (message.type === 'worker-exited') {
      if (
        message.workerId === mode &&
        !message.restarting &&
        globalThis.GEEKGEEKRUN_PROCESS_ROLE !== 'ui'
      ) {
        process.exit(0)
      }
    }
  })
  return {
    runRecordId: currentRunRecord?.id
  }
}
