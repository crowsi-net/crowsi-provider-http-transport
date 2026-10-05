import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, readdirSync, lstatSync } from 'node:fs'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
const [mode, directory] = process.argv.slice(2)
const sha = process.env.GITHUB_SHA
const name = '@crowsi/provider-http-transport',
  version = '0.10.1',
  filename = 'crowsi-provider-http-transport-0.10.1.tgz'
if (!lstatSync(join(directory, filename)).isFile()) throw Error('Regular archive required')
if (!/^[a-f0-9]{40}$/.test(sha ?? '') || process.env.GITHUB_REPOSITORY !== 'crowsi-net/crowsi-provider-http-transport')
  throw Error('Exact approved public source required')
const hashArchive = () =>
  createHash('sha256')
    .update(readFileSync(join(directory, filename)))
    .digest('hex')
const inspect = () => {
  const manifest = JSON.parse(execFileSync('tar', ['-xOf', join(directory, filename), 'package/package.json']))
  if (manifest.name !== name || manifest.version !== version || manifest.private === true)
    throw Error('Archive identity mismatch')
  execFileSync('python3', ['.github/scripts/check-package.py', join(directory, filename)], { stdio: 'inherit' })
}
if (mode === 'prepare') {
  const pack = JSON.parse(readFileSync(join(process.env.RUNNER_TEMP, 'package-pack.json')))
  if (pack.length !== 1 || pack[0].name !== name || pack[0].version !== version || pack[0].filename !== filename)
    throw Error('Unexpected pack identity')
  inspect()
  const sha256 = hashArchive()
  writeFileSync(
    join(directory, 'release.json'),
    `${JSON.stringify({ source: sha, name, version, filename, sha256 })}\n`,
  )
  writeFileSync(process.env.GITHUB_OUTPUT, `archive-sha256=${sha256}\n`, { flag: 'a' })
} else if (mode === 'verify') {
  const files = readdirSync(directory).sort()
  if (
    JSON.stringify(files) !== JSON.stringify([filename, 'release.json'].sort()) ||
    files.some((f) => !lstatSync(join(directory, f)).isFile())
  )
    throw Error('Unexpected artifact contents')
  const record = JSON.parse(readFileSync(join(directory, 'release.json')))
  if (
    record.source !== sha ||
    record.name !== name ||
    record.version !== version ||
    record.filename !== filename ||
    record.sha256 !== process.env.EXPECTED_ARCHIVE_SHA256 ||
    !/^[a-f0-9]{64}$/.test(record.sha256)
  )
    throw Error('Release binding mismatch')
  if (hashArchive() !== record.sha256) throw Error('Archive digest mismatch')
  inspect()
} else throw Error('Expected prepare or verify')
