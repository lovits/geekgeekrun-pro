import vm from 'node:vm'
import { createHrResumeBinding } from '../hr-auto-reply.mjs'

export const fakeBinding = (resume = { resumeId: 'r', showName: '简历.pdf' }) => createHrResumeBinding({ resumeFileId: '00000000-0000-0000-0000-000000000000.pdf', resumeSha256: 'a'.repeat(64) }, { uploadTime: '2026-11-22', ...resume })

const friend = { encryptBossId: 'boss', encryptJobId: 'job' }
const incoming = { mid: 'hr', isSelf: false, messageType: 'text', text: '请发简历', status: 0 }
export function fakePage({ invitation = false, resumes = [{ resumeId: 'r', showName: '简历.pdf' }], ack = true, draft = '', resumeFlow = 'chooser', onType, contact = '', contactNeedsAccount = false, contactAvailable = true, contactFlow = 'confirm', onContactOpen } = {}) {
  resumes = resumes.map(resume => ({ uploadTime: '2026-11-22', ...resume }))
  const state = { friend: { ...friend }, messages: [structuredClone(incoming)], requestResume: false, requestPhone: false, requestWeiXin: false, contactPanel: '', chooser: false, panel: false, resumes, typed: draft, clicks: [], readRequests: [] }
  if (contact) state.messages[0].text = contact === 'wechat' ? '请加一下微信' : '方便留个电话号码吗'
  if (invitation) state.messages[0] = { ...incoming, text: contact ? `我想与您交换${contact === 'wechat' ? '微信' : '电话'}，您是否同意` : incoming.text, messageType: 'dialog', dialog: { type: contact === 'wechat' ? 1 : contact === 'phone' ? 11 : 2, operated: false } }
  const node = (text, click) => ({ textContent: text, childNodes: [{ nodeType: 3, textContent: text }], getClientRects: () => [1], classList: { contains: () => false }, click, disabled: false })
  const confirmContact = () => {
    const kind = state.contactPanel; state.contactPanel = ''; state.clicks.push(`${kind}-confirm`)
    if (ack) { if (invitation) state.messages[0].dialog.operated = true; else state[kind === 'phone' ? 'requestPhone' : 'requestWeiXin'] = true }
  }
  const openContact = entry => { state.contactPanel = contact; state.clicks.push(entry); onContactOpen?.(state); if (contactFlow === 'immediate') confirmContact() }
  const confirmResume = () => {
    state.chooser = false; state.panel = false; state.clicks.push('resume-confirm')
    if (ack) { if (invitation) state.messages[0].dialog.operated = true; else state.requestResume = true }
  }
  const openResume = entry => {
    state.clicks.push(entry)
    if (resumeFlow === 'immediate') confirmResume()
    else if (resumeFlow === 'confirm') state.panel = true
    else state.chooser = true
  }
  const sendText = () => { state.clicks.push('text-send'); if (ack) state.messages.push({ mid: 'sent', isSelf: true, text: state.typed, status: 1 }) }
  const document = {
    querySelector(selector) {
      if (selector === '.chat-conversation') return { __vue__: { selectedFriend$: state.friend } }
      if (selector === '.message-content .chat-record') return { __vue__: { list$: state.messages } }
      if (selector.includes('.chat-im.chat-editor')) return { __vue__: { conversation$: { requestResume: state.requestResume, requestPhone: state.requestPhone, requestWeiXin: state.requestWeiXin } } }
      if (selector.includes('choose-resume-dialog') && state.chooser) return { ...node(''), __vue__: { resumeList: state.resumes }, querySelectorAll: () => state.resumes.map(resume => node('', () => state.clicks.push(`choose:${resume.showName}`))) }
      if (selector.includes('panel-resume') && state.panel) return node('')
      return null
    },
    querySelectorAll(selector) {
      if (selector.includes('[data-mid]')) return [{ getAttribute: () => 'hr', querySelectorAll: buttons => buttons.includes('.card-btn') ? [node('同意', () => contact ? openContact(`accept-${contact}`) : openResume('accept-resume'))] : [] }]
      if (selector.includes('.toolbar-btn')) return [node('发简历', () => openResume('resume-toolbar')), ...['wechat','phone'].map(kind => ({ ...node(kind === 'wechat' ? '换微信' : '换电话', () => openContact(`${kind}-toolbar`)), textContent: kind === 'phone' ? '换电话 确认与对方交换电话吗？取消确定' : '换微信', classList: { contains: value => !contactAvailable && value === 'unable' } }))]
      if (selector === '.choose-resume-dialog' && state.chooser) return [node('外层弹窗'), { ...node('内层弹窗'), __vue__: { resumeList: state.resumes }, querySelectorAll: () => state.resumes.map(resume => node('', () => state.clicks.push(`choose:${resume.showName}`))) }]
      if (selector.includes('.resume-list .list-item') && state.chooser) return resumes.map(resume => ({ ...node('', () => state.clicks.push(`choose:${resume.showName}`)), querySelector: () => ({ textContent: resume.showName }) }))
      if (selector.includes('.btn-confirm') && state.chooser) return [node('发送', confirmResume)]
      if (selector.includes('.panel-resume .btn-sure-v2') && state.panel) return [node('确定', confirmResume)]
      if (selector.includes(state.contactPanel === 'phone' ? '.panel-contact' : '.panel-wechat') && state.contactPanel) {
        if (selector.includes('input[type=text]')) return contactNeedsAccount ? [node('')] : []
        if (selector.includes('.btn-sure-v2')) return [node('确定', confirmContact)]
        return [node('')]
      }
      if (selector.includes('.btn-send')) return [node('发送', sendText)]
      if (selector.includes('choose-resume-dialog') && state.chooser) return [node('')]
      if (selector.includes('panel-resume') && state.panel) return [node('')]
      return []
    }
  }
  const fetch = async (url, options) => {
    if (url !== '/wapi/zpgeek/resume/attachment/checkbox.json?from=2' || options.method && options.method !== 'GET') throw new Error('模拟环境禁止任何其他网络请求')
    state.readRequests.push(url)
    return { ok: true, json: async () => ({ code: 0, zpData: { resumeList: state.resumes } }) }
  }
  const execute = (fn, args) => vm.runInNewContext(`(${fn.toString()})(...args)`, { document, args, fetch, Event: class {} })
  const editable = { get textContent() { return state.typed }, set textContent(value) { state.typed = value }, dispatchEvent() {} }
  const input = { type: async text => { state.typed += text; onType?.(state) }, evaluate: async (fn, ...args) => fn(editable, ...args) }
  const page = {
    evaluate: async (fn, ...args) => execute(fn, args),
    evaluateHandle: async (fn, ...args) => { const element = execute(fn, args); return { asElement: () => element || null, dispose: async () => {} } },
    $: async () => input,
    waitForFunction: async (fn, _options, ...args) => { if (!execute(fn, args)) throw new Error('网站确认超时') }
  }
  return { page, state }
}
