# 部署分支与文章密码修复

用户使用 Cloudflare test 分支部署，要求凭证跟随该分支，并将文章密码门槛降至4位。持续执行，保留原有数据，不使用真实凭证写仓库。

- 默认 branch 改为 auto，CF_PAGES_BRANCH 等部署环境优先，其次当前本地分支；明确填写 main/test 时尊重显式选择。标签和 PR 合并引用不自动作为写入分支，缺少来源时阻止构建。
- 登录页与密码管理显示实际 GitService.repo.branch，保留分支绑定的密码密文和 sessionStorage 隔离。401 不误报为密码错误，提示 Token/部署文件问题。
- 文章密码最少4字符；后台登录密码仍最少8字符且含字母数字。AES-GCM/PBKDF2参数和原密文格式保持。
- 回归包括 CF test 配置生成、test 密码提交/部署读取/登录、main 不被修改、4位文章密码和3位拒绝。更新 README/配置/加密/认证说明，检查 Angular 构建和静态产物。

部署后用户需将新版提交到 test 分支，用 Token 登录对应站点并重新设置密码，等待 test 部署完成。旧 main 凭证不自动迁移。

状态：已完成。116 项单元与服务测试、5 组真实构建脚本通过；实际 CF test 模拟构建和手机/桌面登录页验收通过。普通本地构建已恢复，TypeScript 检查通过，6 份原 data 文件哈希保持一致。完整记录见 `docs/acceptance-fixes.md` 与 `tmp/branch-auth/`。
