// Interview answer persistence — localStorage scoped by environment fingerprint

const CACHE_KEY = 'vcf-ai-interview';

export interface InterviewAnswer {
  questionId: string;
  question: string;
  answer: string;
  topic: string;
  insights: string[];
  timestamp: number;
}

interface CachedInterview {
  answers: InterviewAnswer[];
  environmentFingerprint: string;
  lastUpdated: string;
}

export function getCachedInterview(environmentFingerprint: string): InterviewAnswer[] {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CachedInterview;
    if (parsed.environmentFingerprint !== environmentFingerprint) return [];
    return parsed.answers || [];
  } catch {
    return [];
  }
}

export function setCachedInterview(
  answers: InterviewAnswer[],
  environmentFingerprint: string
): void {
  try {
    const cached: CachedInterview = {
      answers,
      environmentFingerprint,
      lastUpdated: new Date().toISOString(),
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cached));
  } catch {
    // Silently fail
  }
}

export function clearInterviewCache(): void {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch {
    // Silently fail
  }
}
