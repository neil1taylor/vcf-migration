// Section counter for sequential DOCX heading numbers
// Handles optional sections cleanly by incrementing only when a section is included

export interface SectionCounter {
  /** Current section number */
  readonly current: number;
  /** Increment and return the new section number */
  next(): number;
  /** Return a sub-section string like "X.N" using the current section number */
  sub(n: number): string;
}

export function createSectionCounter(start: number = 0): SectionCounter {
  let current = start;
  return {
    get current() { return current; },
    next() { return ++current; },
    sub(n: number) { return `${current}.${n}`; },
  };
}
