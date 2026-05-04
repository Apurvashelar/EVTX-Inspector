import { get, set, del, keys } from 'idb-keyval'
import type { FileEntry } from '../types'

const KEY = (id: string) => `evtx-file:${id}`

export async function persistFile(entry: FileEntry): Promise<void> {
  if (entry.metadata.type === 'sample') return
  try { await set(KEY(entry.id), entry) } catch { /* ignore quota errors */ }
}

export async function unpersistFile(id: string): Promise<void> {
  try { await del(KEY(id)) } catch { /* ignore */ }
}

export async function loadPersistedFiles(): Promise<FileEntry[]> {
  try {
    const allKeys = await keys()
    const fileKeys = (allKeys as string[]).filter(k => typeof k === 'string' && k.startsWith('evtx-file:'))
    const results = await Promise.all(fileKeys.map(k => get<FileEntry>(k)))
    return results.filter((f): f is FileEntry => !!f?.metadata?.hash)
  } catch {
    return []
  }
}
