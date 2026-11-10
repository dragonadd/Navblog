/** 浏览器原生 Web Crypto；密码和正文只在调用者内存中处理。 */
export const ENCRYPTED_SUMMARY = '本文已加密，请输入密码阅读。'
export const POST_CRYPTO_ITERATIONS = 600_000
const FORMAT = 'navblog-encrypted'
const AAD = new TextEncoder().encode('navblog-encrypted:v1')
const MAX_PAYLOAD_LENGTH = 24 * 1024 * 1024

export interface EncryptedPostPayload {
  format: 'navblog-encrypted'
  version: 1
  cipher: 'AES-GCM'
  kdf: 'PBKDF2-SHA-256'
  iterations: number
  salt: string
  iv: string
  ciphertext: string
}

function base64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i += 8192)
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192))
  return btoa(binary)
}

function unbase64(value: unknown): Uint8Array<ArrayBuffer> {
  if (
    typeof value !== 'string' ||
    !value ||
    value.length % 4 !== 0 ||
    !/^[A-Za-z0-9+/]*={0,2}$/.test(value)
  )
    throw new Error('加密文章数据损坏')
  const bytes = Uint8Array.from(atob(value), (char) => char.charCodeAt(0))
  if (base64(bytes) !== value) throw new Error('加密文章数据损坏')
  return bytes
}

/** 严格验证版本、算法和参数，损坏数据不能回退为明文。 */
export function parseEncryptedPayload(body: string): EncryptedPostPayload {
  try {
    if (body.length > MAX_PAYLOAD_LENGTH) throw new Error()
    const p = JSON.parse(body)
    if (
      !p ||
      typeof p !== 'object' ||
      Array.isArray(p) ||
      Object.keys(p).sort().join(',') !==
        'cipher,ciphertext,format,iterations,iv,kdf,salt,version' ||
      p.format !== FORMAT ||
      p.version !== 1 ||
      p.cipher !== 'AES-GCM' ||
      p.kdf !== 'PBKDF2-SHA-256' ||
      p.iterations !== POST_CRYPTO_ITERATIONS ||
      unbase64(p.salt).length !== 16 ||
      unbase64(p.iv).length !== 12 ||
      unbase64(p.ciphertext).length < 16
    )
      throw new Error()
    return p as EncryptedPostPayload
  } catch {
    throw new Error('加密文章数据损坏或版本不支持')
  }
}

export function isEncryptedBody(body: string): boolean {
  return /^\s*\{/.test(body) && /"format"\s*:\s*"navblog-encrypted"/.test(body)
}

function webCrypto(): Crypto {
  if (!globalThis.crypto?.subtle)
    throw new Error('当前环境不支持加密，请使用 HTTPS 或 localhost')
  return globalThis.crypto
}

async function deriveKey(
  password: string,
  salt: Uint8Array<ArrayBuffer>,
  usage: 'encrypt' | 'decrypt',
) {
  const api = webCrypto()
  const material = await api.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveKey'],
  )
  return api.subtle.deriveKey(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt,
      iterations: POST_CRYPTO_ITERATIONS,
    },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    [usage],
  )
}

export async function encryptPostBody(
  body: string,
  password: string,
): Promise<string> {
  if (Array.from(password).length < 12)
    throw new Error('加密密码至少需要 12 个字符，请使用较长的口令')
  const api = webCrypto()
  const salt = api.getRandomValues(new Uint8Array(16))
  const iv = api.getRandomValues(new Uint8Array(12))
  const key = await deriveKey(password, salt, 'encrypt')
  const ciphertext = await api.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: AAD, tagLength: 128 },
    key,
    new TextEncoder().encode(body),
  )
  const payload: EncryptedPostPayload = {
    format: FORMAT,
    version: 1,
    cipher: 'AES-GCM',
    kdf: 'PBKDF2-SHA-256',
    iterations: POST_CRYPTO_ITERATIONS,
    salt: base64(salt),
    iv: base64(iv),
    ciphertext: base64(new Uint8Array(ciphertext)),
  }
  const serialized = JSON.stringify(payload, null, 2)
  parseEncryptedPayload(serialized)
  return serialized
}

export async function decryptPostBody(
  body: string,
  password: string,
): Promise<string> {
  const payload = parseEncryptedPayload(body)
  const api = webCrypto()
  try {
    const key = await deriveKey(password, unbase64(payload.salt), 'decrypt')
    const plaintext = await api.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: unbase64(payload.iv),
        additionalData: AAD,
        tagLength: 128,
      },
      key,
      unbase64(payload.ciphertext),
    )
    return new TextDecoder('utf-8', { fatal: true }).decode(plaintext)
  } catch {
    throw new Error('密码错误或加密内容已损坏')
  }
}
