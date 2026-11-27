import { RegExpParser } from '@eslint-community/regexpp'
import { describeRegex } from '../JobFilterSettingsPreview/describe-regex.mjs'

export function companyEntries(value = '', regex = false) {
  if (!value.trim()) return []
  if (!regex) return value.split(/[,，\n]/).map(label => label.trim()).filter(Boolean).map(label => ({ label, source: label }))
  try {
    return new RegExpParser().parsePattern(value).alternatives.map(alternative => ({
      source: alternative.raw,
      label: alternative.elements.every(node => node.type === 'Character')
        ? alternative.elements.map(node => String.fromCodePoint(node.value)).join('')
        : describeRegex(alternative.raw).rules.map(rule => `${rule.label}：${rule.items.join('、')}`).join('；')
    }))
  } catch { return [{ source: value, label: '自定义正则规则（可在正则设置中查看）' }] }
}

export function addCompany(value, company, regex = false) {
  const name = company.trim()
  const entries = companyEntries(value, regex)
  if (!name || entries.some(item => item.label.toLowerCase() === name.toLowerCase())) return value
  const source = regex ? name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : name
  return [...entries.map(item => item.source), source].join(regex ? '|' : ',')
}

export function removeCompany(value, index, regex = false) {
  return companyEntries(value, regex).filter((_, i) => i !== index).map(item => item.source).join(regex ? '|' : ',')
}
