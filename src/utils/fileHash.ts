// Fast non-cryptographic hash for a File — used as localStorage key prefix for flags.
// Hashes first 8 KB + file size + name so that the same file re-loaded restores flags.
export async function computeFileHash(file: File): Promise<string> {
  const slice = file.slice(0, 8192)
  const buffer = await slice.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  let h = file.size
  for (let i = 0; i < bytes.length; i++) {
    h = (Math.imul(h, 31) + bytes[i]) | 0
  }
  return `${file.name}_${file.size}_${Math.abs(h).toString(16)}`
}
