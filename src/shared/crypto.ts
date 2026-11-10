/** 文章与登录凭证共用原生加密运算，格式和认证附加数据保持隔离。 */
export const CRYPTO_ITERATIONS = 600_000
export interface CipherPayload {
  format: string
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
    throw new Error('加密数据损坏')
  const bytes = Uint8Array.from(atob(value), (c) => c.charCodeAt(0))
  if (base64(bytes) !== value) throw new Error('加密数据损坏')
  return bytes
}
export function parseCipher(
  source: string,
  format: string,
  maxLength = 24 * 1024 * 1024,
): CipherPayload {
  try {
    if (source.length > maxLength) throw new Error()
    const p = JSON.parse(source)
    if (
      !p ||
      typeof p !== 'object' ||
      Array.isArray(p) ||
      Object.keys(p).sort().join(',') !==
        'cipher,ciphertext,format,iterations,iv,kdf,salt,version' ||
      p.format !== format ||
      p.version !== 1 ||
      p.cipher !== 'AES-GCM' ||
      p.kdf !== 'PBKDF2-SHA-256' ||
      p.iterations !== CRYPTO_ITERATIONS ||
      unbase64(p.salt).length !== 16 ||
      unbase64(p.iv).length !== 12 ||
      unbase64(p.ciphertext).length < 16
    )
      throw new Error()
    return p
  } catch {
    throw new Error('加密数据损坏或版本不支持')
  }
}
function api(): Crypto {
  if (!globalThis.crypto?.subtle)
    throw new Error('当前环境不支持加密，请使用 HTTPS 或 localhost')
  return globalThis.crypto
}
async function key(
  password: string,
  salt: Uint8Array<ArrayBuffer>,
  usage: 'encrypt' | 'decrypt',
) {
  const material = await api().subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveKey'],
  )
  return api().subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: CRYPTO_ITERATIONS },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    [usage],
  )
}
const aad = (format: string, context: string) =>
  new TextEncoder().encode(`${format}:v1${context ? ':' + context : ''}`)
export async function encryptText(
  text: string,
  password: string,
  format: string,
  context = '',
): Promise<string> {
  const crypto = api(),
    salt = crypto.getRandomValues(new Uint8Array(16)),
    iv = crypto.getRandomValues(new Uint8Array(12))
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
      additionalData: aad(format, context),
      tagLength: 128,
    },
    await key(password, salt, 'encrypt'),
    new TextEncoder().encode(text),
  )
  const p: CipherPayload = {
    format,
    version: 1,
    cipher: 'AES-GCM',
    kdf: 'PBKDF2-SHA-256',
    iterations: CRYPTO_ITERATIONS,
    salt: base64(salt),
    iv: base64(iv),
    ciphertext: base64(new Uint8Array(ciphertext)),
  }
  return JSON.stringify(p, null, 2)
}
export async function decryptText(
  source: string,
  password: string,
  format: string,
  context = '',
): Promise<string> {
  const p = parseCipher(source, format),
    crypto = api()
  try {
    const plaintext = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: unbase64(p.iv),
        additionalData: aad(format, context),
        tagLength: 128,
      },
      await key(password, unbase64(p.salt), 'decrypt'),
      unbase64(p.ciphertext),
    )
    return new TextDecoder('utf-8', { fatal: true }).decode(plaintext)
  } catch {
    throw new Error('密码错误或加密内容已损坏')
  }
}
