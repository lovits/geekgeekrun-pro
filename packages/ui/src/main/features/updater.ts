import packageJson from '../../../package.json'
import os from 'node:os'
import { checkReleaseUpdate } from '@geekgeekrun/utils/release-update.mjs'
import { NewReleaseInfo } from '../../common/types/update'

export const currentOsPlatform = os.platform()
export const checkUpdateForUi = async (): Promise<NewReleaseInfo | null> => {
  return checkReleaseUpdate(packageJson.version, os.platform(), os.arch())
}
