// ─────────────────────────────────────────────────────────
// Profanity filter — English + Tagalog
// Simple, reliable substring-based detection with word-boundary
// checks. Masking always preserves the original length so cursor
// position is not lost when the user types.
// ─────────────────────────────────────────────────────────

const ENGLISH_BAD = [
  'fuck', 'fucking', 'fucker', 'fucked', 'motherfucker',
  'shit', 'shitty', 'bullshit',
  'bitch', 'bitching',
  'bastard',
  'asshole',
  'dick', 'dickhead',
  'pussy',
  'cunt',
  'whore', 'slut',
  'damn', 'goddamn',
  'crap',
  'piss',
  'retard', 'retarded',
  'faggot',
  'nigga', 'nigger',
  'wanker', 'twat',
  'bollocks', 'prick',
]

const TAGALOG_BAD = [
  'putangina', 'putang ina', 'puta', 'putang',
  'tangina', 'tang ina',
  'gago', 'gaga',
  'bobo', 'boba',
  'tanga',
  'ulol', 'ungas',
  'lintik',
  'punyeta',
  'hayop', 'hayup',
  'kupal',
  'tarantado',
  'engot',
  'inutil',
  'leche',
  'pakyu',
  'kingina',
  'peste',
  'buwisit',
  'hinayupak',
  'siraulo',
  'pokpok',
  'malandi',
]

// Sort longest-first so "fucking" masks before "fuck"
const ALL_BAD = Array.from(new Set([...ENGLISH_BAD, ...TAGALOG_BAD])).sort(
  (a, b) => b.length - a.length
)

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export interface ProfanityCheck {
  clean: boolean
  matched: string[]
  filtered: string
}

export function checkProfanity(text: string): ProfanityCheck {
  if (!text || !text.trim()) {
    return { clean: true, matched: [], filtered: text }
  }

  // Normalize: lowercase, non-alphanumeric → space, collapse spaces
  const normalized = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  const matched: string[] = []
  let filtered = text

  for (const bad of ALL_BAD) {
    const parts = bad
      .toLowerCase()
      .split(/\s+/)
      .map(escapeRegex)

    // Detect on the normalized string with word boundaries
    const normalizedPattern = parts.join(' ')
    let isMatch = false
    try {
      const detectRe = new RegExp(
        `(^|[^a-z0-9])${normalizedPattern}([^a-z0-9]|$)`,
        'i'
      )
      isMatch = detectRe.test(normalized)
    } catch {
      isMatch = false
    }

    if (isMatch && !matched.includes(bad)) {
      matched.push(bad)
    }

    // Mask on the ORIGINAL text — allows any non-alphanumeric
    // separator between multi-word phrases (space, dash, etc.)
    // and preserves length so the cursor doesn't jump.
    const maskSource = parts.join('[^a-zA-Z0-9]+')
    try {
      const maskRe = new RegExp(maskSource, 'gi')
      filtered = filtered.replace(maskRe, (m) => '*'.repeat(m.length))
    } catch {
      // ignore bad regex, keep original
    }
  }

  return {
    clean: matched.length === 0,
    matched,
    filtered,
  }
}