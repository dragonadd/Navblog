import {
  CRYPTO_ITERATIONS,
  decryptText,
  encryptText,
  parseCipher,
  type CipherPayload,
} from './crypto'
export const ENCRYPTED_SUMMARY = '本文已加密，请输入密码阅读。'
export const POST_CRYPTO_ITERATIONS = CRYPTO_ITERATIONS
const FORMAT = 'navblog-encrypted'
export type EncryptedPostPayload = CipherPayload & {
  format: 'navblog-encrypted'
}
export function parseEncryptedPayload(body: string): EncryptedPostPayload {
  try {
    return parseCipher(body, FORMAT) as EncryptedPostPayload
  } catch {
    throw new Error('加密文章数据损坏或版本不支持')
  }
}
export function isEncryptedBody(body: string): boolean {
  return /^\s*\{/.test(body) && /"format"\s*:\s*"navblog-encrypted"/.test(body)
}
export async function encryptPostBody(
  body: string,
  password: string,
): Promise<string> {
  if (Array.from(password).length < 12)
    throw new Error('加密密码至少需要 12 个字符，请使用较长的口令')
  const source = await encryptText(body, password, FORMAT)
  parseEncryptedPayload(source)
  return source
}
export async function decryptPostBody(
  body: string,
  password: string,
): Promise<string> {
  parseEncryptedPayload(body)
  return decryptText(body, password, FORMAT)
}
