import { describe, expect, it } from 'vitest';
import { pickTaskKeys } from './queries';

describe('pickTaskKeys', () => {
  it('uses a stable root key for all pick-task queries', () => {
    expect(pickTaskKeys.all).toEqual(['pick-task']);
  });

  it('scopes detail key to the given taskId', () => {
    const taskId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    expect(pickTaskKeys.detail(taskId)).toEqual(['pick-task', 'detail', taskId]);
  });

  it('uses a stable sentinel for null taskId', () => {
    expect(pickTaskKeys.detail(null)).toEqual(['pick-task', 'detail', 'none']);
  });

  it('produces distinct keys for different task IDs', () => {
    const keyA = pickTaskKeys.detail('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
    const keyB = pickTaskKeys.detail('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
    expect(keyA).not.toEqual(keyB);
  });
});
