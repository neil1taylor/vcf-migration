import { describe, it, expect } from 'vitest';
import { REQUIRED_SHEETS, RECOMMENDED_SHEETS } from './constants';

describe('REQUIRED_SHEETS', () => {
  it('only requires vInfo', () => {
    expect(REQUIRED_SHEETS).toEqual(['vInfo']);
  });

  it('does not require vDisk or vDatastore', () => {
    expect(REQUIRED_SHEETS).not.toContain('vDisk');
    expect(REQUIRED_SHEETS).not.toContain('vDatastore');
  });
});

describe('RECOMMENDED_SHEETS', () => {
  it('includes vDisk and vDatastore as recommended', () => {
    expect(RECOMMENDED_SHEETS).toContain('vDisk');
    expect(RECOMMENDED_SHEETS).toContain('vDatastore');
  });
});
