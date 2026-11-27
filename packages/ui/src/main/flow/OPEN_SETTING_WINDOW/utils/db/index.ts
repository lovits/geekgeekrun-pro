import createDbWorker from './worker/index?nodeWorker&url'
import { type Worker } from 'node:worker_threads'
import { randomUUID } from 'node:crypto'
import { PageReq, JobLibraryReq, CompanyLibraryReq } from '../../../../../common/types/pagination'

let worker: Worker | null = null
let workerExitCode: number | null = null
let initPromise: Promise<Worker> | null = null
export const initDbWorker = () => {
  if (worker && typeof workerExitCode !== 'number') {
    return initPromise ?? Promise.resolve(worker)
  }
  if (initPromise) return initPromise
  const currentWorker = createDbWorker()
  worker = currentWorker
  workerExitCode = null
  initPromise = new Promise<Worker>((resolve, reject) => {
    currentWorker.once('exit', (exitCode) => {
      workerExitCode = exitCode
      if (worker === currentWorker) {
        worker = null
        initPromise = null
      }
      reject(new Error(`数据库线程异常退出 (${exitCode})`))
    })
    currentWorker.on('message', function handler(data) {
      if (data.type === 'DB_INIT_SUCCESS') {
        currentWorker.off('message', handler)
        resolve(currentWorker)
      } else if (data.type === 'DB_INIT_FAIL') {
        currentWorker.off('message', handler)
        currentWorker.terminate()
        if (worker === currentWorker) {
          worker = null
          initPromise = null
        }
        reject(data.error)
      }
    })
  })
  return initPromise
}

const createWorkerPromise = async (data) => {
  const activeWorker = await initDbWorker()
  const uuid = randomUUID()
  return new Promise<{ data?: any; [key: string]: any }>((resolve, reject) => {
    function onExit(code: number) {
      activeWorker.off('message', handler)
      reject(new Error(`数据库查询中断 (${code})`))
    }
    function handler(msg) {
      const { _uuid, ...payload } = msg ?? {}
      if (_uuid === uuid) {
        activeWorker.off('message', handler)
        activeWorker.off('exit', onExit)
        resolve(payload)
      }
    }
    activeWorker.once('exit', onExit)
    activeWorker.on('message', handler)
    activeWorker.postMessage({
      _uuid: uuid,
      ...data
    })
  })
}

export const getAutoStartChatRecord = async ({ pageNo, pageSize }: Partial<PageReq> = {}) => {
  const res = await createWorkerPromise({
    type: 'getAutoStartChatRecord',
    pageNo,
    pageSize
  })
  return res
}

export const exportRuntimeData = () => createWorkerPromise({ type: 'exportRuntimeData' })
export const getSimulationJobs = () => createWorkerPromise({ type: 'getSimulationJobs' })

export const getMarkAsNotSuitRecord = async ({ pageNo, pageSize }: Partial<PageReq> = {}) => {
  const res = await createWorkerPromise({
    type: 'getMarkAsNotSuitRecord',
    pageNo,
    pageSize
  })
  return res
}

export const getBossLibrary = async ({ pageNo, pageSize }: Partial<PageReq> = {}) => {
  const res = await createWorkerPromise({
    type: 'getBossLibrary',
    pageNo,
    pageSize
  })
  return res
}

export const getSimulationCompanyFacts = async () => createWorkerPromise({ type: 'getSimulationCompanyFacts' })

export const getCompanyLibrary = async ({ pageNo, pageSize, scale, industry }: Partial<CompanyLibraryReq> = {}) => {
  const res = await createWorkerPromise({
    type: 'getCompanyLibrary',
    scale,
    industry,
    pageNo,
    pageSize
  })
  return res
}

export const getJobLibrary = async ({ pageNo, pageSize, companyName, companyId, companyOrder }: Partial<JobLibraryReq> = {}) => {
  const res = await createWorkerPromise({
    type: 'getJobLibrary',
    pageNo,
    pageSize,
    companyName,
    companyId,
    companyOrder
  })
  return res
}

export const getJobHistoryByEncryptId = async (encryptJobId) => {
  const res = await createWorkerPromise({
    type: 'getJobHistoryByEncryptId',
    encryptJobId
  })
  return res
}

export const saveAndGetCurrentRunRecord = async () => {
  const res = await createWorkerPromise({
    type: 'saveAndGetCurrentRunRecord'
  })
  return res
}
