# 后台双模式认证 Implementation Plan

> Use superpowers:executing-plans，连续执行已获批准方案，保留当前工作区和前序修改。

**Goal:** 无密码时 Token 登录，有密文时默认密码登录并保留 Token 兜底；独立设置/修改/移除登录密码。
**Architecture:** GitService 统一校验 Token 并仅存 sessionStorage；AuthService 实时读取部署的 data/auth.json，Web Crypto 加密 Token 并通过现有 Git API 条件写入。密码仅作 PBKDF2 密钥材料。构建严格验证并发布密文文件，不打包为设置。
**Tech stack:** Angular/TypeScript/Tailwind，原生 Web Crypto、Fetch、sessionStorage；无新依赖。

## 已确认规则

- 密码 >=8 位且含字母和数字；提示“为了安全性，建议使用 12 位以上的独有密码”。不改变文章加密的 12 位规则。
- AES-256-GCM + PBKDF2-SHA-256 600000 次，随机 salt16/IV12，v1/AAD 与仓库身份绑定。auth.json 仅格式/版本/算法/迭代次数/salt/iv/密文。
- 请求 data/auth.json?t=Date.now()，cache:no-store、credentials:omit、超时；404/204/空白表示未设。网络/HTML/格式错误显示重试和Token兜底。
- Token/密码不进localStorage、日志、导出或设置。旧localStorage token清除而不迁移。会话按部署子路径/仓库隔离；关闭标签页通常失效，但浏览器恢复可能保留。
- Token直登/解密登录共用校验。用户身份与仓库写权限验证；Git服务端最终决定写操作是否获准。
- 安全模块独立按钮，强度即时红色提示/保存禁用；移除页内确认。
- 改密和删除按读取时文件版本提交，部署提示不可承诺已生效。删除不撤销历史Token，需说明轮换。
- 本地演示禁止处理真实Token，安全模块仅解释；测试使用内存Git和测试凭证，不创建真实auth文件。
- 公共auth路径不影响RSS/搜索/预渲染；CSS/脚本信任风险及最小权限Token说明更新README。

## Tasks / Checks

1. RED→GREEN：共享密码规则/加密封装验证/解密/格式拒绝；Session Token迁移、隔离、校验失败不存储、存储失败不登录。
2. AuthService：公开时间戳读取/超时/错误分支、版本化设置/移除；JSON不含Token或密码。GitService条件删除保持其他调用兼容。
3. UI：Token/Password Tabs、加载/错误/取消、session退出、密码管理模块与强度提示；构建资产只复制已验证密文。
4. 验证全套测试、真实构建产物扫描/移除、浏览器无密码/有密码Tabs（仅测试凭证）、手机/桌面；独立审查并修复重要发现。
5. 更新README/docs/authentication.md、旧localStorage描述；正式内容及演示副本恢复。

## Review focus

离线猜密风险；同源脚本获取session凭证；仓库/分支混用；JSON损坏误降级；Git并发改密或移除；导航中异步登录完成后残留会话；开发/生产auth资产同路径；复制/恢复标签页不作绝对失效保证。
