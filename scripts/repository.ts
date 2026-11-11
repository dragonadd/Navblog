import { execFileSync } from 'node:child_process'

export function readRepositoryOrigin(cwd: string): string {
  try {
    return execFileSync('git', ['remote', 'get-url', 'origin'], {
      cwd,
      encoding: 'utf8',
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim()
  } catch {
    return ''
  }
}

function detectedRepository(value: string): string {
  try {
    const ssh = value.match(/^[^/@\s]+@([^:\s]+):(.+)$/)
    const url = new URL(
      ssh ? `https://${ssh[1]}/${ssh[2]}` : value.replace(/^git\+/, ''),
    )
    if (!['http:', 'https:', 'ssh:', 'git:'].includes(url.protocol)) return ''
    if (!['github.com', 'gitee.com', 'gitlab.com'].includes(url.hostname))
      return ''
    const parts = url.pathname
      .replace(/\/+$/, '')
      .replace(/\.git$/i, '')
      .split('/')
      .slice(1)
    if (
      parts.length !== 2 ||
      parts.some((p) => !/^[\w.-]+$/.test(p) || p === '.' || p === '..')
    )
      return ''
    return `https://${url.hostname}/${parts.join('/')}`
  } catch {
    return ''
  }
}

export function resolveRepository(
  value: string,
  env: NodeJS.ProcessEnv,
  origin: string,
): string {
  value = value.trim()
  if (value !== 'auto') {
    if (!value) return ''
    let url: URL
    try {
      url = new URL(value)
    } catch {
      throw new Error('仓库地址必须是完整的 HTTP(S) URL 或 auto')
    }
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.pathname.split('/').filter(Boolean).length < 2
    )
      throw new Error('仓库地址必须是完整的 HTTP(S) URL，且不能包含登录凭据')
    if (
      url.hash ||
      [...url.searchParams.keys()].some(
        (key) => !['branch', 'projectId'].includes(key),
      )
    )
      throw new Error(
        '仓库地址查询参数只支持 branch 和 projectId，不能包含片段或登录凭据',
      )
    return value
  }
  const candidates = [
    env.GITHUB_REPOSITORY
      ? `${env.GITHUB_SERVER_URL || 'https://github.com'}/${env.GITHUB_REPOSITORY}`
      : '',
    env.REPOSITORY_URL || '',
    env.VERCEL_GIT_PROVIDER === 'github'
      ? `https://github.com/${env.VERCEL_GIT_REPO_OWNER || ''}/${env.VERCEL_GIT_REPO_SLUG || ''}`
      : '',
    env.CI_PROJECT_URL || '',
    origin,
  ]
  for (const candidate of candidates) {
    const repo = detectedRepository(candidate)
    if (repo) return repo
  }
  return ''
}
