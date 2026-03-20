import { describe, expect, it } from 'vitest';
import { containerKeys } from './queries';

describe('containerKeys', () => {
  it('uses a stable key for container types', () => {
    expect(containerKeys.types()).toEqual(['container', 'types']);
  });

  it('rebinds container storage when the selected container changes', () => {
    expect(containerKeys.storage('container-a')).not.toEqual(containerKeys.storage('container-b'));
    expect(containerKeys.storage(null)).toEqual(['container', 'storage', 'none']);
  });

  it('uses a dedicated stable key for canonical current location', () => {
    expect(containerKeys.currentLocation('container-a')).toEqual(['container', 'current-location', 'container-a']);
    expect(containerKeys.currentLocation(null)).toEqual(['container', 'current-location', 'none']);
  });
});
