import fs from 'fs'
import path from 'path'

const dbPath = path.join(process.cwd(), 'data', 'db.json')

export function readDb() {
  return JSON.parse(fs.readFileSync(dbPath, 'utf-8'))
}

export function writeDb(data) {
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2))
}

export function createId(prefix = 'id') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export function getToken(req) {
  const auth = req.headers.authorization || ''
  if (!auth.startsWith('Bearer ')) return ''
  return auth.slice(7)
}
