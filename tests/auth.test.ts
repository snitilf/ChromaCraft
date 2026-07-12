import { describe, it, expect } from 'vitest';
import { isAuthorized } from '../api/_lib/auth';

const TOKEN = 'correct-horse-battery-staple-9f3c1a';

describe('isAuthorized', () => {
  it('denies when the expected token is unset (fail closed)', () => {
    expect(isAuthorized(`Bearer ${TOKEN}`, undefined)).toBe(false);
  });

  it('denies when the expected token is an empty string', () => {
    expect(isAuthorized(`Bearer ${TOKEN}`, '')).toBe(false);
  });

  it('allows a correct Bearer token', () => {
    expect(isAuthorized(`Bearer ${TOKEN}`, TOKEN)).toBe(true);
  });

  it('denies a wrong token', () => {
    expect(isAuthorized('Bearer not-the-token', TOKEN)).toBe(false);
  });

  it('denies a token that is a prefix of the expected value', () => {
    expect(isAuthorized(`Bearer ${TOKEN.slice(0, -1)}`, TOKEN)).toBe(false);
  });

  it('denies a missing Bearer prefix', () => {
    expect(isAuthorized(TOKEN, TOKEN)).toBe(false);
  });

  it('denies a lowercase bearer prefix', () => {
    expect(isAuthorized(`bearer ${TOKEN}`, TOKEN)).toBe(false);
  });

  it('denies an empty header', () => {
    expect(isAuthorized('', TOKEN)).toBe(false);
  });

  it('denies an undefined header', () => {
    expect(isAuthorized(undefined, TOKEN)).toBe(false);
  });

  it('denies "Bearer " with no token', () => {
    expect(isAuthorized('Bearer ', TOKEN)).toBe(false);
  });

  it('round-trips a token containing spaces and unicode', () => {
    const weird = 'p ass wörd スペース key';
    expect(isAuthorized(`Bearer ${weird}`, weird)).toBe(true);
    // a trailing space is part of the candidate and must not match
    expect(isAuthorized(`Bearer ${weird} `, weird)).toBe(false);
  });
});
