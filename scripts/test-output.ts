import os from 'node:os'
import path from 'node:path'

/** 验证日志与临时备份保存在源码目录之外，可通过环境变量指定位置。 */
export const TEST_OUTPUT = path.join(
  process.env['NAVBLOG_TEST_OUTPUT_DIR'] || os.tmpdir(),
  'navblog-tests',
)
