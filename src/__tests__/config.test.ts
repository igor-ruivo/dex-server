import { config, getEnabledSources, getSourcesByType } from '../config';

describe('Configuration', () => {
  test('should have valid configuration', () => {
    expect(config).toBeDefined();
    expect(config.cronSchedule).toBeDefined();
    expect(config.outputDir).toBeDefined();
    expect(config.maxRetries).toBeGreaterThan(0);
    expect(config.timeout).toBeGreaterThan(0);
    expect(Array.isArray(config.sources)).toBe(true);
  });

  test('should return enabled sources', () => {
    const enabledSources = getEnabledSources();
    expect(Array.isArray(enabledSources)).toBe(true);
    expect(enabledSources.every(source => source.enabled)).toBe(true);
  });

  test('should filter sources by type', () => {
    const eventSources = getSourcesByType('events');
    const raidSources = getSourcesByType('raids');
    const gameMasterSources = getSourcesByType('game-master');

    expect(Array.isArray(eventSources)).toBe(true);
    expect(Array.isArray(raidSources)).toBe(true);
    expect(Array.isArray(gameMasterSources)).toBe(true);

    expect(eventSources.every(source => source.type === 'events')).toBe(true);
    expect(raidSources.every(source => source.type === 'raids')).toBe(true);
    expect(gameMasterSources.every(source => source.type === 'game-master')).toBe(true);
  });
}); 