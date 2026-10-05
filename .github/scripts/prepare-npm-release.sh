set -euo pipefail
export NUXT_TELEMETRY_DISABLED=1 CI=true
export NPM_CONFIG_USERCONFIG="$RUNNER_TEMP/empty.npmrc"
export NPM_CONFIG_GLOBALCONFIG="$RUNNER_TEMP/empty-global.npmrc"
export npm_config_registry=https://registry.npmjs.org
touch "$NPM_CONFIG_USERCONFIG" "$NPM_CONFIG_GLOBALCONFIG"
npm install --global npm@11.12.1
mkdir -p "$RUNNER_TEMP/package-release"
MANAGER=$(node -p 'require("./package.json").packageManager')
if test "$MANAGER" = pnpm@10.29.3; then
  npm install --global pnpm@10.29.3
  pnpm install --frozen-lockfile
  :
  pnpm pack --pack-destination "$RUNNER_TEMP/package-release"
  node -e 'const fs=require("node:fs"),p=require("./package.json");fs.writeFileSync(process.env.RUNNER_TEMP+"/package-pack.json",JSON.stringify([{name:p.name,version:p.version,filename:"crowsi-provider-http-transport-0.10.1.tgz"}]))'
else
  test "$MANAGER" = npm@11.12.1
  npm ci --ignore-scripts
  npm pack --json --foreground-scripts=false --pack-destination "$RUNNER_TEMP/package-release" > "$RUNNER_TEMP/package-pack.json"
fi
python3 .github/scripts/check-package.py "$RUNNER_TEMP/package-release/crowsi-provider-http-transport-0.10.1.tgz"
node .github/scripts/package-consumer.mjs "$RUNNER_TEMP/package-release/crowsi-provider-http-transport-0.10.1.tgz"
:
