import {
  decryptText,
  encryptText,
  parseCipher,
  type CipherPayload,
} from './crypto'
import type { RepoInfo } from '../app/services/git.service'

export const AUTH_PATH = 'data/auth.json'
const FORMAT = 'navblog-auth'
export const AUTH_MAX_LENGTH = 8192
export const AUTH_DEPLOY_MESSAGE =
  '已提交，正在部署，请等待 1–2 分钟；部署成功后刷新页面生效。'
export function authIdentity(repo: RepoInfo): string {
  return JSON.stringify([
    repo.provider,
    repo.host,
    repo.owner,
    repo.repo,
    repo.branch,
    repo.projectId || '',
  ])
}
export function validLoginPassword(value: string): boolean {
  return (
    Array.from(value).length >= 8 && /[a-z]/i.test(value) && /[0-9]/.test(value)
  )
}
export function validateTokenText(token: string): string {
  const text = token.trim()
  if (!text || text.length > 2048 || /[\s\u0000-\u001f\u007f]/.test(text))
    throw new Error('Token 格式无效')
  return text
}
export function parseAuth(source: string): CipherPayload {
  try {
    return parseCipher(source, FORMAT, AUTH_MAX_LENGTH)
  } catch {
    throw new Error(
      '登录凭证文件损坏或版本不支持，请使用 Token 登录并重新设置密码',
    )
  }
}
export async function encryptAuth(
  token: string,
  password: string,
  identity: string,
): Promise<string> {
  if (!validLoginPassword(password))
    throw new Error('密码至少 8 位，且必须包含字母和数字')
  const source = await encryptText(
    validateTokenText(token),
    password,
    FORMAT,
    identity,
  )
  parseAuth(source)
  return source
}
export async function decryptAuth(
  source: string,
  password: string,
  identity: string,
): Promise<string> {
  parseAuth(source)
  return validateTokenText(
    await decryptText(source, password, FORMAT, identity),
  )
}
