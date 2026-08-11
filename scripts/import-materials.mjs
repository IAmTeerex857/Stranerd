#!/usr/bin/env node
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { tsImport } from 'tsx/esm/api'

const module = await tsImport(pathToFileURL(path.resolve('server/materialsImport.ts')).href, import.meta.url)
await module.importCli(process.argv.slice(2))
