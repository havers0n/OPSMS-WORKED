import React, { createElement } from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';
import type { RackFace } from '@wos/domain';
import { RackSections } from './rack-sections';

vi.mock('react-konva', () => ({
  Group: ({ children, ...props }: { children?: React.ReactNode }) =>
    createElement('Group', props, children),
  Line: ({ children, ...props }: { children?: React.ReactNode }) =>
    createElement('Line', props, children),
  Rect: ({ children, ...props }: { children?: React.ReactNode }) =>
    createElement('Rect', props, children),
  Text: ({ children, ...props }: { children?: React.ReactNode }) =>
    createElement('Text', props, children)
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const baseGeometry = {
  x: 0,
  y: 0,
  width: 200,
  height: 80,
  faceAWidth: 200,
  faceBWidth: 200,
  centerX: 100,
  centerY: 40,
  isPaired: false,
  spineY: 0
};

function createFace(id: string): RackFace {
  return {
    id,
    side: 'A',
    enabled: true,
    slotNumberingDirection: 'ltr',
    isMirrored: false,
    mirrorSourceFaceId: null,
    sections: [
      {
        id: `${id}-section-1`,
        ordinal: 1,
        length: 3,
        levels: [{ id: `${id}-level-1`, ordinal: 1, slotCount: 2 }]
      },
      {
        id: `${id}-section-2`,
        ordinal: 2,
        length: 3,
        levels: [{ id: `${id}-level-1`, ordinal: 1, slotCount: 2 }]
      }
    ]
  };
}

function renderSections(geometry = baseGeometry) {
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(
      createElement(RackSections, {
        geometry,
        faceA: createFace('face-a'),
        faceB: null,
        isSelected: false
      })
    );
  });
  return renderer;
}

describe('RackSections numbering', () => {
  it('renders structural section numbers when section geometry is large enough', () => {
    const renderer = renderSections();
    const textValues = renderer.root
      .findAll((node) => String(node.type) === 'Text')
      .map((node) => String(node.props.text));
    expect(textValues).toEqual(['1', '2']);
  });

  it('hides section numbers when section geometry is too small', () => {
    const renderer = renderSections({
      ...baseGeometry,
      width: 24,
      faceAWidth: 24
    });
    const textNodes = renderer.root.findAll((node) => String(node.type) === 'Text');
    expect(textNodes).toHaveLength(0);
  });
});
