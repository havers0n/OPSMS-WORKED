import React, { createElement } from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';
import type { RackFace } from '@wos/domain';
import { RackSections } from './rack-sections';

vi.mock('react-konva', () => ({
  Group: ({ children, ...props }: { children?: React.ReactNode }) =>
    createElement('Group', props, children),
  Shape: ({ children, ...props }: { children?: React.ReactNode }) =>
    createElement('Shape', props, children),
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
        isSelected: false,
        rackRotationDeg: 0,
        showFaceToken: true,
        showSectionNumbers: true,
        faceTokenProminence: 'dominant',
        sectionNumberProminence: 'dominant'
      })
    );
  });
  return renderer;
}

function getSectionNumberTexts(renderer: TestRenderer.ReactTestRenderer) {
  return renderer.root
    .findAll((node) => String(node.type) === 'Text' && /^\d+$/.test(String(node.props.text)))
    .map((node) => String(node.props.text));
}

type MockContextCall = {
  fn: string;
  args: unknown[];
};

function createMockCanvasContext() {
  const calls: MockContextCall[] = [];
  let strokeStyle: unknown;
  let lineWidth: unknown;
  const push = (fn: string, ...args: unknown[]) => calls.push({ fn, args });
  return {
    calls,
    context: {
      save: () => push('save'),
      restore: () => push('restore'),
      setLineDash: (...args: unknown[]) => push('setLineDash', ...args),
      beginPath: () => push('beginPath'),
      moveTo: (...args: unknown[]) => push('moveTo', ...args),
      lineTo: (...args: unknown[]) => push('lineTo', ...args),
      stroke: () => push('stroke'),
      fillStrokeShape: (...args: unknown[]) => push('fillStrokeShape', ...args),
      set strokeStyle(value: unknown) {
        strokeStyle = value;
        push('strokeStyle', value);
      },
      get strokeStyle() {
        return strokeStyle;
      },
      set lineWidth(value: unknown) {
        lineWidth = value;
        push('lineWidth', value);
      },
      get lineWidth() {
        return lineWidth;
      }
    }
  };
}

function renderRackSections(props?: Partial<React.ComponentProps<typeof RackSections>>) {
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(
      createElement(RackSections, {
        geometry: baseGeometry,
        faceA: createFace('face-a'),
        faceB: null,
        isSelected: false,
        rackRotationDeg: 0,
        showFaceToken: true,
        showSectionNumbers: true,
        faceTokenProminence: 'dominant',
        sectionNumberProminence: 'dominant',
        ...props
      })
    );
  });
  return renderer;
}

describe('RackSections numbering', () => {
  it('renders structural section numbers when section geometry is large enough', () => {
    const renderer = renderSections();
    const textValues = getSectionNumberTexts(renderer);
    expect(textValues).toEqual(['1', '2']);
  });

  it('hides section numbers when section geometry is too small', () => {
    const renderer = renderSections({
      ...baseGeometry,
      width: 24,
      faceAWidth: 24
    });
    const textNodes = renderer.root.findAll(
      (node) => String(node.type) === 'Text' && /^\d+$/.test(String(node.props.text))
    );
    expect(textNodes).toHaveLength(0);
  });

  it('places section labels in top section-owned rails (not section-body center)', () => {
    const renderer = renderSections();
    const labels = renderer.root.findAll(
      (node) => String(node.type) === 'Text' && /^\d+$/.test(String(node.props.text))
    );

    expect(labels).toHaveLength(2);
    for (const label of labels) {
      expect(Number(label.props.y)).toBeLessThan(20);
      expect(Number(label.props.y)).toBeLessThan(baseGeometry.height / 2);
    }
  });

  it('keeps the same rail ownership in paired racks for both faces', () => {
    const faceA = createFace('face-a');
    const faceB = {
      ...createFace('face-b'),
      side: 'B' as const
    };
    const pairedGeometry = {
      ...baseGeometry,
      isPaired: true,
      spineY: 40
    };

    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        createElement(RackSections, {
          geometry: pairedGeometry,
          faceA,
          faceB,
          isSelected: false,
          rackRotationDeg: 0,
          showFaceToken: true,
          showSectionNumbers: true,
          faceTokenProminence: 'dominant',
          sectionNumberProminence: 'dominant'
        })
      );
    });

    const labels = renderer.root
      .findAll(
        (node) => String(node.type) === 'Group' && node.props.name === 'section-label-rotator'
      )
      .map((node) => Number(node.props.y))
      .sort((a, b) => a - b);

    expect(labels).toHaveLength(4);
    expect(labels[0]).toBeLessThan(pairedGeometry.spineY);
    expect(labels[1]).toBeLessThan(pairedGeometry.spineY);
    expect(labels[2]).toBeGreaterThan(pairedGeometry.spineY);
    expect(labels[3]).toBeGreaterThan(pairedGeometry.spineY);
  });

  it('renders face tokens from face/header rail owner only', () => {
    const faceA = createFace('face-a');
    const faceB = {
      ...createFace('face-b'),
      side: 'B' as const
    };
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        createElement(RackSections, {
          geometry: {
            ...baseGeometry,
            isPaired: true,
            spineY: 40
          },
          faceA,
          faceB,
          isSelected: false,
          rackRotationDeg: 0,
          showFaceToken: true,
          showSectionNumbers: true,
          faceTokenProminence: 'dominant',
          sectionNumberProminence: 'dominant'
        })
      );
    });
    const faceTokens = renderer.root
      .findAll(
        (node) =>
          String(node.type) === 'Text' &&
          node.props.name === 'face-token-label' &&
          (node.props.text === 'A' || node.props.text === 'B')
      )
      .map((node) => String(node.props.text))
      .sort();

    expect(faceTokens).toEqual(['A', 'B']);
  });

  it('does not render face token for single racks', () => {
    const renderer = renderSections();
    const faceTokens = renderer.root.findAll(
      (node) => String(node.type) === 'Text' && node.props.name === 'face-token-label'
    );
    expect(faceTokens).toHaveLength(0);
  });

  it('hides section labels when stage gate disables section namespace', () => {
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        createElement(RackSections, {
          geometry: baseGeometry,
          faceA: createFace('face-a'),
          faceB: null,
          isSelected: false,
          rackRotationDeg: 0,
          showFaceToken: true,
          showSectionNumbers: false,
          faceTokenProminence: 'dominant',
          sectionNumberProminence: 'background'
        })
      );
    });

    const sectionLabels = renderer.root.findAll(
      (node) => String(node.type) === 'Text' && node.props.name === 'section-label'
    );
    expect(sectionLabels).toHaveLength(0);
  });

  it('keeps face and section label text horizontal by counter-rotating in vertical racks', () => {
    const faceA = createFace('face-a');
    const faceB = {
      ...createFace('face-b'),
      side: 'B' as const
    };
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        createElement(RackSections, {
          geometry: {
            ...baseGeometry,
            isPaired: true,
            spineY: 40
          },
          faceA,
          faceB,
          isSelected: false,
          rackRotationDeg: 90,
          showFaceToken: true,
          showSectionNumbers: true,
          faceTokenProminence: 'dominant',
          sectionNumberProminence: 'dominant'
        })
      );
    });

    const faceRotators = renderer.root.findAll(
      (node) => String(node.type) === 'Group' && node.props.name === 'face-token-label-rotator'
    );
    const sectionRotators = renderer.root.findAll(
      (node) => String(node.type) === 'Group' && node.props.name === 'section-label-rotator'
    );

    expect(faceRotators.length).toBeGreaterThan(0);
    expect(sectionRotators.length).toBeGreaterThan(0);
    for (const node of [...faceRotators, ...sectionRotators]) {
      expect(node.props.rotation).toBe(-90);
    }
  });
});

describe('RackSections divider shapes', () => {
  it('renders face A divider shape with unchanged coordinates/style and listening=false', () => {
    const renderer = renderRackSections();
    const shapes = renderer.root.findAll((node) => String(node.type) === 'Shape');

    expect(shapes).toHaveLength(1);
    const [shape] = shapes;
    expect(shape.props.listening).toBe(false);
    expect(shape.props.opacity).toBe(0.5);

    const sceneFunc = shape.props.sceneFunc as (ctx: unknown, shapeNode: unknown) => void;
    const { calls, context } = createMockCanvasContext();
    const shapeNode = {};
    sceneFunc(context, shapeNode);

    expect(calls.find((c) => c.fn === 'setLineDash')?.args[0]).toEqual([4, 3]);
    expect(calls.find((c) => c.fn === 'lineWidth')?.args[0]).toBe(1);

    const moveCalls = calls.filter((c) => c.fn === 'moveTo').map((c) => c.args);
    const lineCalls = calls.filter((c) => c.fn === 'lineTo').map((c) => c.args);
    expect(moveCalls).toEqual([[100, 4]]);
    expect(lineCalls).toEqual([[100, 76]]);
  });

  it('renders selected paired face A/B divider shapes with unchanged y-ranges and selected style', () => {
    const faceA = createFace('face-a');
    const faceB = { ...createFace('face-b'), side: 'B' as const };
    const renderer = renderRackSections({
      geometry: { ...baseGeometry, isPaired: true, spineY: 40 },
      faceA,
      faceB,
      isSelected: true
    });
    const shapes = renderer.root.findAll((node) => String(node.type) === 'Shape');

    expect(shapes).toHaveLength(2);
    shapes.forEach((shape) => {
      expect(shape.props.listening).toBe(false);
      expect(shape.props.opacity).toBe(0.9);
    });

    const [faceAShape, faceBShape] = shapes;
    const ctxA = createMockCanvasContext();
    const ctxB = createMockCanvasContext();
    const shapeNode = {};
    (faceAShape.props.sceneFunc as (ctx: unknown, shapeNode: unknown) => void)(
      ctxA.context,
      shapeNode
    );
    (faceBShape.props.sceneFunc as (ctx: unknown, shapeNode: unknown) => void)(
      ctxB.context,
      shapeNode
    );

    expect(ctxA.calls.find((c) => c.fn === 'lineWidth')?.args[0]).toBe(1.5);
    expect(ctxB.calls.find((c) => c.fn === 'lineWidth')?.args[0]).toBe(1.5);
    expect(ctxA.calls.find((c) => c.fn === 'setLineDash')?.args[0]).toEqual([4, 3]);
    expect(ctxB.calls.find((c) => c.fn === 'setLineDash')?.args[0]).toEqual([4, 3]);

    const aMoveCalls = ctxA.calls.filter((c) => c.fn === 'moveTo').map((c) => c.args);
    const aLineCalls = ctxA.calls.filter((c) => c.fn === 'lineTo').map((c) => c.args);
    const bMoveCalls = ctxB.calls.filter((c) => c.fn === 'moveTo').map((c) => c.args);
    const bLineCalls = ctxB.calls.filter((c) => c.fn === 'lineTo').map((c) => c.args);

    expect(aMoveCalls).toEqual([[100, 4]]);
    expect(aLineCalls).toEqual([[100, 36]]);
    expect(bMoveCalls).toEqual([[100, 44]]);
    expect(bLineCalls).toEqual([[100, 76]]);
  });

  it('does not render invalid face B divider shape for non-paired racks', () => {
    const faceA = createFace('face-a');
    const faceB = { ...createFace('face-b'), side: 'B' as const };
    const renderer = renderRackSections({
      geometry: { ...baseGeometry, isPaired: false },
      faceA,
      faceB
    });
    const shapes = renderer.root.findAll((node) => String(node.type) === 'Shape');
    expect(shapes).toHaveLength(1);
  });
});
