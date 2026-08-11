/**
 * ============================================================================
 * YEREL EMBEDDING MOTORU / LOCAL EMBEDDING ENGINE
 * ============================================================================
 * Ucretsiz, sinirsiz, tamamen cevrimdisi. Hicbir harici API cagirmaz.
 * Free, unlimited, fully offline. No external API calls.
 *
 * Yontem: karakter n-gram + kelime tabanli "hashing trick" ile sabit boyutlu
 * (256) L2-normalize vektor. Cosine benzerligi ile anlamsal yakinlik olcumu.
 * Kendi embedding modelinizi (ornek: Ollama /api/embeddings) baglamak icin
 * SADECE `embedText` govdesini degistirin.
 * ============================================================================
 */

export const EMBEDDING_DIM = 256;

const STOPWORDS = new Set([
  "ve", "ile", "bir", "bu", "da", "de", "icin", "ama", "cok", "gibi", "the", "a", "an",
  "and", "or", "of", "to", "in", "is", "are", "for", "with", "on", "that", "it",
]);

function normalize(input: string): string {
  return input
    .toLowerCase()
    .replace(/[ıİ]/g, "i")
    .replace(/[şŞ]/g, "s")
    .replace(/[ğĞ]/g, "g")
    .replace(/[üÜ]/g, "u")
    .replace(/[öÖ]/g, "o")
    .replace(/[çÇ]/g, "c")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hash(token: string, salt: number): number {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < token.length; i += 1) {
    h ^= token.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h) % EMBEDDING_DIM;
}

function tokenize(text: string): string[] {
  const words = normalize(text).split(" ").filter((w) => w.length > 1 && !STOPWORDS.has(w));
  const tokens: string[] = [];
  for (const word of words) {
    const stem = word.slice(0, 6);
    tokens.push(stem);
    for (let i = 0; i + 3 <= stem.length; i += 1) tokens.push(stem.slice(i, i + 3));
  }
  for (let i = 0; i + 1 < words.length; i += 1) {
    tokens.push(`${words[i]!.slice(0, 5)}_${words[i + 1]!.slice(0, 5)}`);
  }
  return tokens;
}

/** Metni sabit boyutlu, L2-normalize vektore cevirir. */
export function embedText(text: string): number[] {
  const vector = new Array<number>(EMBEDDING_DIM).fill(0);
  const tokens = tokenize(text);
  if (tokens.length === 0) return vector;

  const counts = new Map<string, number>();
  for (const token of tokens) counts.set(token, (counts.get(token) ?? 0) + 1);

  for (const [token, count] of counts) {
    const weight = 1 + Math.log(count);
    vector[hash(token, 0)]! += weight;
    vector[hash(token, 0x9e37)]! += weight * 0.5;
  }

  let norm = 0;
  for (const value of vector) norm += value * value;
  norm = Math.sqrt(norm);
  if (norm === 0) return vector;
  return vector.map((value) => value / norm);
}

/** Cosine benzerligi (vektorler normalize oldugu icin dot product). */
export function cosineSimilarity(a: number[], b: number[]): number {
  let sum = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i += 1) sum += a[i]! * b[i]!;
  return Math.max(0, Math.min(1, sum));
}
