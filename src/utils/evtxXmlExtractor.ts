// Extracts known EVTX System fields from a rendered XML string via targeted regex.
// Using regex over DOMParser because DOMParser is unavailable in all Worker environments.

function attr(xml: string, tag: string, attribute: string): string {
  const re = new RegExp(`<${tag}[^>]*\\s${attribute}="([^"]*)"`, 'i')
  const m = xml.match(re)
  return m ? m[1] : ''
}

function text(xml: string, tag: string): string {
  const re = new RegExp(`<${tag}[^>]*>([^<]*)<\\/${tag}>`, 'i')
  const m = xml.match(re)
  return m ? m[1].trim() : ''
}

const LEVEL_NAMES: Record<string, string> = {
  '0': 'LogAlways',
  '1': 'Critical',
  '2': 'Error',
  '3': 'Warning',
  '4': 'Information',
  '5': 'Verbose',
}

export function extractEvtxFields(xml: string): Record<string, string> {
  const level = text(xml, 'Level')
  const eventData: Record<string, string> = {}
  const dataRe = /<Data(?:\s+Name="([^"]*)")?[^>]*>([^<]*)<\/Data>/gi
  let m: RegExpExecArray | null
  const parts: string[] = []
  while ((m = dataRe.exec(xml)) !== null) {
    const name = m[1] ?? `field${parts.length}`
    const val = m[2].trim()
    eventData[name] = val
    parts.push(`${name}=${val}`)
  }

  return {
    EventRecordID: text(xml, 'EventRecordID'),
    TimeCreated: attr(xml, 'TimeCreated', 'SystemTime'),
    EventID: text(xml, 'EventID'),
    Level: LEVEL_NAMES[level] ?? level,
    Channel: text(xml, 'Channel'),
    Computer: text(xml, 'Computer'),
    Provider: attr(xml, 'Provider', 'Name'),
    UserID: attr(xml, 'Security', 'UserID'),
    Keywords: text(xml, 'Keywords'),
    Task: text(xml, 'Task'),
    Opcode: text(xml, 'Opcode'),
    EventData: parts.join(' | '),
  }
}
