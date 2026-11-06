import { describe, expect, it } from 'vitest';
import { shouldUseMocks } from './mocks';

describe('shouldUseMocks', () => {
  it.each(['true', 'TRUE', 'True', ' true '])('activa el modo con %j', (value) => {
    expect(shouldUseMocks(value, 'development')).toBe(true);
  });

  it.each([undefined, '', 'false', 'FALSE', '1', 'yes'])('no lo activa con %j', (value) => {
    expect(shouldUseMocks(value, 'development')).toBe(false);
  });

  it('nunca se activa en los tests', () => {
    expect(shouldUseMocks('TRUE', 'test')).toBe(false);
  });
});
