#!/bin/zsh
set -eu
cd "$(dirname "$0")"
if command -v node >/dev/null 2>&1; then
  creator_node="$(command -v node)"
elif [ -x "$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node" ]; then
  creator_node="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node"
else
  print '请先安装 Node.js 22.13 或以上版本，然后运行 npm ci 和 npm run dev。'
  exit 1
fi
export PATH="$(dirname "$creator_node"):$PATH"
if [ ! -d node_modules ]; then
  print '首次启动请在本目录运行 npm ci，安装依赖后再次启动。'
  exit 1
fi
exec "$creator_node" scripts/run-framework.mjs dev
