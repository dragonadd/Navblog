import assert from 'node:assert/strict'
import { test } from 'node:test'
import settingsJson from '../data/settings.json'
import type { BlogSettings } from '../src/shared/types'
import { normalizeCustomResources, normalizeResourceUrl, renderCustomResources } from '../src/shared/custom-resources'

const settings = (overrides: Partial<BlogSettings> = {}): BlogSettings => ({ ...settingsJson, ...overrides })
const html = '<!doctype html><html><head><base href="/" /><link rel="stylesheet" href="styles.css" /></head><body><app-root></app-root></body></html>'

test('兼容旧配置，空资源不输出任何专用资源标签', () => {
  const old = settings()
  for (const key of ['customCssEnable', 'customCss', 'customExternalCss', 'customJsEnable', 'customExternalJs'] as const) delete old[key]
  assert.equal(renderCustomResources(html, old).includes('data-navblog-resource'), false)
})

test('外部资源仅接受完整 HTTPS 或站内路径，不接受凭据、执行协议与模糊地址', () => {
  for (const value of ['http://example.com/x.js', 'javascript:alert(1)', 'data:text/javascript,alert(1)', '//example.com/x.js', 'https:example.com/x.js', 'https://user:pass@example.com/x.js', 'x\\evil.js', 'x\ny.js', '#script', '']) {
    assert.throws(() => normalizeResourceUrl(value), undefined, value)
  }
  assert.equal(normalizeResourceUrl(' HTTPS://EXAMPLE.COM:443/x.js#one '), 'https://example.com/x.js')
  assert.equal(normalizeResourceUrl('scripts/local.js#one'), 'scripts/local.js')
  assert.equal(normalizeResourceUrl('/assets/local.css'), '/assets/local.css')
})

test('地址规范化后去重，保留顺序及不同查询参数，忽略空行', () => {
  const result = normalizeCustomResources(settings({ customExternalJs: ['', 'https://EXAMPLE.com:443/x.js#one', 'https://example.com/x.js#two', 'https://example.com/x.js?v=2', 'local.js', './local.js', '/blog/local.js'] }), '/blog/')
  assert.deepEqual(result.customExternalJs, ['https://example.com/x.js', 'https://example.com/x.js?v=2', 'local.js'])
})

test('禁用专用样式和脚本后不注入，保留配置；高级 head 内容仍独立存在', () => {
  const legacy = '<html><head><script src="https://example.com/legacy.js"></script></head><body></body></html>'
  const result = renderCustomResources(legacy, settings({ customCssEnable: false, customCss: '</style><script>alert(1)</script>', customExternalCss: ['无效地址'], customJsEnable: false, customExternalJs: ['javascript:alert(1)'] }))
  assert.equal(result.includes('data-navblog-resource'), false)
  assert.match(result, /legacy\.js/)
  assert.equal(result.includes('alert(1)'), false)
})

test('CSS 文本不能闭合 style 标签或伪装为 HTML，避免注入脚本', () => {
  for (const css of ['</STYLE><script>alert(1)</script>', '<style>body { color:red }</style>', '/* </style> */']) {
    assert.throws(() => normalizeCustomResources(settings({ customCss: css })), /CSS/)
  }
  assert.equal(normalizeCustomResources(settings({ customCss: '  body { color: red; }\r\n' })).customCss, 'body { color: red; }')
})

test('与高级 head 的同类资源、内联 CSS 去重，正确识别引号和 HTML 转义', () => {
  const legacy = `<html><head><script SRC='https://example.com/a.js?x=1&amp;y=2'></script><link href="./custom.css" rel="stylesheet"><style>body { color: red; }</style></head><body></body></html>`
  const result = renderCustomResources(legacy, settings({ customCss: 'body { color: red; }', customExternalCss: ['custom.css'], customExternalJs: ['https://example.com/a.js?x=1&y=2'] }))
  assert.equal(result.includes('data-navblog-resource'), false)
})

test('注释、脚本字符串中的假标签不会阻止真实资源注入；不同类型资源分别去重', () => {
  const legacy = `<html><head><!-- <script src="https://example.com/custom.js"></script> --><script>const example = '<link rel="stylesheet" href="custom.css">'</script><link rel="stylesheet" href="https://example.com/shared"></head><body></body></html>`
  const result = renderCustomResources(legacy, settings({ customExternalCss: ['custom.css'], customExternalJs: ['https://example.com/custom.js', 'https://example.com/shared'] }))
  assert.equal((result.match(/data-navblog-resource="js"/g) || []).length, 2)
  assert.equal((result.match(/data-navblog-resource="css"/g) || []).length, 1)
})

test('重复调用不会重复注入，删除/禁用配置会移除旧输出，自定义样式位于主题之后', () => {
  const config = settings({ customCss: 'body { color:red; }', customExternalCss: ['https://example.com/x.css'], customExternalJs: ['https://example.com/first.js', 'https://example.com/second.js'] })
  const first = renderCustomResources(html, config)
  assert.equal(renderCustomResources(first, config), first)
  assert.ok(first.indexOf('styles.css') < first.indexOf('data-navblog-resource="css"'))
  assert.ok(first.indexOf('data-navblog-resource="css"') < first.indexOf('data-navblog-resource="style"'))
  assert.ok(first.indexOf('first.js') < first.indexOf('second.js'))
  assert.equal(renderCustomResources(first, settings()).includes('data-navblog-resource'), false)
})

test('新外部标签匿名跨域、无来源信息，脚本 defer；地址中的字符不能逃逸属性', () => {
  const result = renderCustomResources(html, settings({ customExternalCss: ['https://example.com/x.css?a=1&b=2'], customExternalJs: ['scripts/a"b.js?x=1&y=2'] }))
  assert.match(result, /x\.css\?a=1&amp;b=2" crossorigin="anonymous" referrerpolicy="no-referrer"/)
  assert.match(result, /src="scripts\/a&quot;b\.js\?x=1&amp;y=2" defer crossorigin="anonymous" referrerpolicy="no-referrer"/)
})

test('资源不会插入脚本字符串或注释里的 head 结束标签', () => {
  const legacy = '<html><head><!-- </head> --><script>const text = "</head>"</script></head><body></body></html>'
  const result = renderCustomResources(legacy, settings({ customCss: 'body { color:red; }' }))
  assert.ok(result.indexOf('</script>') < result.indexOf('data-navblog-resource="style"'))
  assert.match(result, /const text = "<\/head>"<\/script>/)
})
