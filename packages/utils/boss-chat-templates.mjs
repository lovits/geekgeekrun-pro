// Conservative phrase examples, not a claim of an official or exhaustive BOSS catalog.
export const bossNonReplyTemplates = [
  { kind: '岗位不匹配', reason: '招聘方已明确婉拒，无需回复', examples: [
    '您与当前岗位暂不匹配', '您与当前职位暂不匹配',
    '抱歉，您的经历与我们的岗位要求不匹配', '抱歉，您的经历与我们的职位要求不匹配',
    '很抱歉，您的经历与岗位要求不太匹配', '很抱歉，您的经历与我们的职位要求不匹配',
    '不好意思，不太合适哦', '不好意思，不太合适', '不太匹配', '不合适'
  ] },
  { kind: '岗位结束', reason: '岗位已关闭或已招满，无需回复', examples: [
    '该岗位已关闭', '该职位已关闭', '当前岗位已关闭', '当前职位已关闭', '岗位已招满', '职位已招满',
    '不好意思，岗位已经招满了', '很抱歉，该岗位已停止招聘', '感谢投递，祝您求职顺利'
  ] },
  { kind: '收讫与收尾', reason: '仅确认收到或礼貌收尾，无需回复', examples: [
    '好的', '好', '收到', '谢谢', '我先看下', '我先看一下', '简历已收到', '已收到简历，后续联系',
    '您的简历已收到，合适会与您联系', '感谢您的投递，我们会尽快查看您的简历'
  ] },
  { kind: '平台状态', reason: '仅为平台操作状态提示，无需回复', examples: [
    '对方已同意，您的附件简历已发送给对方', '您的附件简历已发送给Boss点击查看附件'
  ] }
]

const normalize = text => String(text || '').replace(/\[(?:祈祷|抱拳|微笑)\]/g, '').replace(/[\s，,。.!！?？~～…“”"'；;、：:]/g, '')
const phrases = new Map(bossNonReplyTemplates.flatMap(group => group.examples.map(text => [normalize(text), group.reason])))

export function bossTemplateSkipReason(messages) {
  const lastSelf = messages.findLastIndex(message => message.isSelf)
  const incoming = messages.slice(lastSelf + 1)
  if (!incoming.length || incoming.some(message => message.isSelf !== false || message.messageType !== 'text')) return ''
  const reasons = incoming.map(message => phrases.get(normalize(message.text)))
  // An extra question, invitation or different opportunity must not be lost behind an old closing.
  return reasons.every(Boolean) ? [...new Set(reasons)].join('；') : ''
}
