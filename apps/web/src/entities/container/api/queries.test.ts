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
});
