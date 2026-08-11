#!/usr/bin/env node
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { tsImport } from 'tsx/esm/api'
import 'dotenv/config'

const module = await tsImport(pathToFileURL(path.resolve('server/materialsImport.ts')).href, import.meta.url)
const args = process.argv.slice(2)
const value = (flag, fallback) => {
  const index = args.indexOf(flag)
  return index < 0 ? fallback : args[index + 1]
}
const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) throw new Error('Verification requires SUPABASE_URL and SUPABASE_SECRET_KEY')
const materialsRoot = path.resolve(value('--materials-root', 'Materials'))
const manifest = await module.buildMaterialsManifest({
  outputRoot: path.join(materialsRoot, 'output'),
  publicBaseUrl: `${url}/storage/v1/object/public/materials`,
  approveQuestions: args.includes('--approve-questions'),
  subjects: value('--subject')?.split(','),
})
console.log(JSON.stringify({ corpusHash: manifest.corpusHash, ...await module.verifyMaterialsManifest(manifest, url, key) }, null, 2))
