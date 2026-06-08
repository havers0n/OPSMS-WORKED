import React, { createElement } from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RackBody } from './rack-body';

const rackBodyKonvaMocks = vi.hoisted(() => ({
  groupNodes: [] as Array<{
    clearCache: ReturnType<typeof vi.fn>;
    cache: ReturnType<typeof vi.fn>;
    batchDraw: ReturnType<typeof vi.fn>;
    getLayer: () => { batchDraw: ReturnType<typeof vi.fn> };
  }>
}));

vi.mock('react-konva', () => ({
  Group: class MockGroup extends React.Component<{ children?: React.ReactNode }> {
    clearCache = vi.fn();
    cache = vi.fn();
    batchDraw = vi.fn();
    getLayer = () => ({ batchDraw: this.batchDraw });

    constructor(props: { children?: React.ReactNode }) {
      super(props);
      rackBodyKonvaMocks.groupNodes.push(this);
    }

    render() {
      const { children, ...props } = this.props;
      return createElement('Group', props, children);
    }
  },
  Line: ({ children, ...props }: { children?: React.ReactNode }) =>
    createElement('Line', props, children),
  Rect: ({ children, ...props }: { children?: React.ReactNode }) =>
    createElement('Rect', props, children),
  Text: ({ children, ...props }: { children?: React.ReactNode }) =>
    createElement('Text', props, children)
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

beforeEach(() => {
  rackBodyKonvaMocks.groupNodes.length = 0;
});

const singleGeometry = {
  x: 0,
  y: 0,
  width: 200,
  height: 80,
  faceAWidth: 200,
  faceBWidth: 200,
  centerX: 100,
  centerY: 40,
  isPaired: false,
  spineY: 40
};

const pairedGeometry = {
  ...singleGeometry,
  isPaired: true
};

const asymmetricGeometry = {
  ...pairedGeometry,
  width: 220,
  faceAWidth: 220,
  faceBWidth: 200,
  centerX: 110
};

function renderRackBody(params?: {
  displayCode?: string;
  geometry?: typeof singleGeometry;
  prominence?: 'dominant' | 'secondary' | 'background';
  placement?: 'header-left' | 'lower-left-mid';
  rotationDeg?: 0 | 90 | 180 | 270;
  isPaired?: boolean;
  isAsymmetric?: boolean;
  isSelected?: boolean;
  isHovered?: boolean;
  isPassive?: boolean;
  showRackCode?: boolean;
  disableStrokes?: boolean;
  isActivelyPanning?: boolean;
  shellRendering?: 'normal' | 'cached';
  disableShadows?: boolean;
  simpleShell?: boolean;
  disableLabels?: boolean;
  disableBodyStrokes?: boolean;
}) {
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(
      createElement(RackBody, {
        geometry: params?.geometry ?? (params?.isAsymmetric
          ? asymmetricGeometry
          : params?.isPaired
            ? pairedGeometry
            : singleGeometry),
        displayCode: params?.displayCode ?? 'R-01',
        rotationDeg: params?.rotationDeg ?? 0,
        isSelected: params?.isSelected ?? false,
        isHovered: params?.isHovered ?? false,
        isPassive: params?.isPassive,
        showRackCode: params?.showRackCode ?? true,
        rackCodeProminence: params?.prominence ?? 'dominant',
        rackCodePlacement: params?.placement ?? 'lower-left-mid',
        disableStrokes: params?.disableStrokes,
        isActivelyPanning: params?.isActivelyPanning,
        shellRendering: params?.shellRendering,
        disableShadows: params?.disableShadows,
        simpleShell: params?.simpleShell,
        disableLabels: params?.disableLabels,
        disableBodyStrokes: params?.disableBodyStrokes
      })
    );
  });
  return renderer;
}

function updateRackBody(
  renderer: TestRenderer.ReactTestRenderer,
  params?: Parameters<typeof renderRackBody>[0]
) {
  act(() => {
    renderer.update(
      createElement(RackBody, {
        geometry: params?.geometry ?? (params?.isAsymmetric
          ? asymmetricGeometry
          : params?.isPaired
            ? pairedGeometry
            : singleGeometry),
        displayCode: params?.displayCode ?? 'R-01',
        rotationDeg: params?.rotationDeg ?? 0,
        isSelected: params?.isSelected ?? false,
        isHovered: params?.isHovered ?? false,
        isPassive: params?.isPassive,
        showRackCode: params?.showRackCode ?? true,
        rackCodeProminence: params?.prominence ?? 'dominant',
        rackCodePlacement: params?.placement ?? 'lower-left-mid',
        disableStrokes: params?.disableStrokes,
        isActivelyPanning: params?.isActivelyPanning,
        shellRendering: params?.shellRendering,
        disableShadows: params?.disableShadows,
        simpleShell: params?.simpleShell,
        disableLabels: params?.disableLabels,
        disableBodyStrokes: params?.disableBodyStrokes
      })
    );
  });
}

function getCachedShellNode() {
  const shell = rackBodyKonvaMocks.groupNodes.find(
    (node) => node.cache.mock.calls.length > 0
  );
  expect(shell).toBeDefined();
  return shell!;
}

function getIdentityGroup(renderer: TestRenderer.ReactTestRenderer) {
  return renderer.root.find(
    (node) =>
      String(node.type) === 'Group' &&
      typeof node.props.rotation === 'number' &&
      node.findAll((child) => String(child.type) === 'Text' && child.props.text === 'R-01').length > 0
  );
}

function getRects(renderer: TestRenderer.ReactTestRenderer) {
  return renderer.root.findAll((node) => String(node.type) === 'Rect');
}

function countRectsByRole(renderer: TestRenderer.ReactTestRenderer) {
  return getRects(renderer).reduce<Record<string, number>>((counts, rect) => {
    const role = String(rect.props.wosRectRole ?? 'unknown');
    counts[role] = (counts[role] ?? 0) + 1;
    return counts;
  }, {});
}

function getShellGroup(renderer: TestRenderer.ReactTestRenderer) {
  return renderer.root.findAll((node) => String(node.type) === 'Group')[0]!;
}

function serializeVisualShell(renderer: TestRenderer.ReactTestRenderer) {
  return {
    shell: {
      listening: getShellGroup(renderer).props.listening,
      opacity: getShellGroup(renderer).props.opacity
    },
    rects: getRects(renderer).map((rect) => ({
      role: rect.props.wosRectRole ?? null,
      x: rect.props.x ?? null,
      y: rect.props.y ?? null,
      width: rect.props.width ?? null,
      height: rect.props.height ?? null,
      fill: rect.props.fill ?? null,
      stroke: rect.props.stroke ?? null,
      strokeEnabled: rect.props.strokeEnabled ?? null,
      strokeWidth: rect.props.strokeWidth ?? null,
      opacity: rect.props.opacity ?? null,
      visible: rect.props.visible ?? null,
      dash: rect.props.dash ?? null
    })),
    labels: renderer.root.findAll((node) => String(node.type) === 'Text').map((text) => ({
      text: text.props.text,
      fontSize: text.props.fontSize,
      fontStyle: text.props.fontStyle,
      opacity: text.props.opacity
    })),
    labelGroups: renderer.root
      .findAll(
        (node) =>
          String(node.type) === 'Group' &&
          typeof node.props.rotation === 'number'
      )
      .map((group) => ({
        x: group.props.x,
        y: group.props.y,
        rotation: group.props.rotation
      }))
  };
}

describe('RackBody identity label ownership', () => {
  it('splits rack shell diagnostics into stable body sub-roles', () => {
    expect(countRectsByRole(renderRackBody())).toMatchObject({
      'rack-body-main': 1,
      'rack-body-stripe': 1
    });
    expect(countRectsByRole(renderRackBody({ isPaired: true }))).toMatchObject({
      'rack-body-main': 1,
      'rack-body-stripe': 2
    });
    expect(
      countRectsByRole(renderRackBody({ isAsymmetric: true }))
    ).toMatchObject({
      'rack-body-main': 1,
      'rack-body-overhang': 1,
      'rack-body-stripe': 2
    });
  });

  it('renders paired face B stripe on the outer edge, not the internal seam', () => {
    const renderer = renderRackBody({ isPaired: true });
    const faceBStripe = renderer.root.find(
      (node) => String(node.type) === 'Rect' && String(node.props.fill) === '#7c3aed'
    );

    // height=80 -> stripeH clamps to 8 => outer edge starts at y=72
    expect(faceBStripe.props.y).toBe(72);
  });

  it('keeps rack code in a stable leading shell anchor across all prominence states', () => {
    const dominantAnchor = getIdentityGroup(renderRackBody({ prominence: 'dominant' }));
    const secondaryAnchor = getIdentityGroup(renderRackBody({ prominence: 'secondary' }));
    const backgroundAnchor = getIdentityGroup(renderRackBody({ prominence: 'background' }));

    expect(Number(dominantAnchor.props.x)).toBeLessThan(singleGeometry.width / 2);
    expect(Number(secondaryAnchor.props.x)).toBeLessThan(singleGeometry.width / 2);
    expect(Number(backgroundAnchor.props.x)).toBeLessThan(singleGeometry.width / 2);
    expect(dominantAnchor.props.x).toBe(secondaryAnchor.props.x);
    expect(secondaryAnchor.props.x).toBe(backgroundAnchor.props.x);
    expect(dominantAnchor.props.y).toBe(secondaryAnchor.props.y);
    expect(secondaryAnchor.props.y).toBe(backgroundAnchor.props.y);
  });

  it('keeps rack code in a stable non-header shell lane', () => {
    const identityGroup = getIdentityGroup(renderRackBody({ prominence: 'secondary' }));
    expect(Number(identityGroup.props.y)).toBeGreaterThan(20);
    expect(Number(identityGroup.props.y)).toBeLessThan(singleGeometry.height / 2);
  });

  it('keeps identity ownership in the same quiet left-shell band for single and paired racks', () => {
    const singleAnchor = getIdentityGroup(renderRackBody({ isPaired: false }));
    const pairedAnchor = getIdentityGroup(renderRackBody({ isPaired: true }));

    expect(singleAnchor.props.x).toBe(pairedAnchor.props.x);
    expect(Number(singleAnchor.props.y)).toBeGreaterThan(20);
    expect(Number(pairedAnchor.props.y)).toBeGreaterThan(20);
    expect(Number(singleAnchor.props.y)).toBeLessThan(singleGeometry.height / 2);
    expect(Number(pairedAnchor.props.y)).toBeLessThan(singleGeometry.height / 2);
  });

  it('keeps the same leading anchor ownership for horizontal and vertical racks', () => {
    const horizontalAnchor = getIdentityGroup(
      renderRackBody({ rotationDeg: 0, placement: 'lower-left-mid' })
    );
    const verticalAnchor = getIdentityGroup(
      renderRackBody({ rotationDeg: 90, placement: 'lower-left-mid' })
    );
    const verticalAnchor270 = getIdentityGroup(
      renderRackBody({ rotationDeg: 270, placement: 'lower-left-mid' })
    );

    expect(Number(horizontalAnchor.props.x)).toBeLessThan(singleGeometry.width / 2);
    // For 90/270deg we compute local anchor from desired screen top-left inset.
    expect(Number(verticalAnchor.props.x)).toBeLessThan(singleGeometry.width / 2);
    expect(Number(verticalAnchor.props.y)).toBeGreaterThan(singleGeometry.height / 2);
    expect(Number(verticalAnchor270.props.x)).toBeGreaterThan(singleGeometry.width / 2);
    expect(Number(verticalAnchor270.props.y)).toBeLessThan(singleGeometry.height / 2);
  });

  it('keeps rack code text upright for all rack rotations', () => {
    expect(Math.abs(Number(getIdentityGroup(renderRackBody({ rotationDeg: 0 })).props.rotation))).toBe(0);
    expect(getIdentityGroup(renderRackBody({ rotationDeg: 90 })).props.rotation).toBe(-90);
    expect(getIdentityGroup(renderRackBody({ rotationDeg: 180 })).props.rotation).toBe(-180);
    expect(getIdentityGroup(renderRackBody({ rotationDeg: 270 })).props.rotation).toBe(-270);
  });

  it('uses non-semantic demotion channels for background rack code', () => {
    const renderer = renderRackBody({ prominence: 'background' });
    const rackCodeText = renderer.root.find(
      (node) => String(node.type) === 'Text' && String(node.props.text) === 'R-01'
    );
    expect(Number(rackCodeText.props.opacity)).toBeLessThan(0.7);
    expect(String(rackCodeText.props.fontStyle)).toBe('normal');
  });

  it('uses identical rack-code anchor across stage-like prominence changes', () => {
    const dominantAnchor = getIdentityGroup(
      renderRackBody({ isPaired: true, prominence: 'dominant', placement: 'lower-left-mid' })
    );
    const secondaryAnchor = getIdentityGroup(
      renderRackBody({ isPaired: true, prominence: 'secondary', placement: 'lower-left-mid' })
    );
    const backgroundAnchor = getIdentityGroup(
      renderRackBody({ isPaired: true, prominence: 'background', placement: 'lower-left-mid' })
    );

    expect(dominantAnchor.props.x).toBe(secondaryAnchor.props.x);
    expect(secondaryAnchor.props.x).toBe(backgroundAnchor.props.x);
    expect(dominantAnchor.props.y).toBe(secondaryAnchor.props.y);
    expect(secondaryAnchor.props.y).toBe(backgroundAnchor.props.y);
  });

  it('keeps full rack body visual effects while idle', () => {
    const renderer = renderRackBody({ isSelected: true });
    const rects = getRects(renderer);
    const body = rects.find(
      (rect) => rect.props.wosRectRole === 'rack-body-main'
    );
    const selection = rects.find(
      (rect) => rect.props.wosRectRole === 'selection-highlight'
    );
    const badgeStroke = rects
      .filter((rect) => rect.props.wosRectRole === 'badge-decoration')
      .find((rect) => rect.props.strokeEnabled === true);

    expect(body?.props.strokeEnabled).toBe(true);
    expect(body?.props.shadowBlur).toBeGreaterThan(0);
    expect(selection?.props.visible).not.toBe(false);
    expect(selection?.props.opacity).toBeGreaterThan(0);
    expect(badgeStroke?.props.strokeEnabled).toBe(true);
  });

  it('uses lightweight visual props during active pan without removing nodes', () => {
    const renderer = renderRackBody({
      isSelected: true,
      isActivelyPanning: true
    });
    const rects = getRects(renderer);
    const body = rects.find(
      (rect) => rect.props.wosRectRole === 'rack-body-main'
    );
    const selection = rects.find(
      (rect) => rect.props.wosRectRole === 'selection-highlight'
    );
    const badgeStroke = rects
      .filter((rect) => rect.props.wosRectRole === 'badge-decoration')
      .find((rect) => rect.props.strokeWidth === 0);

    expect(body?.props.strokeEnabled).toBe(false);
    expect(body?.props.shadowBlur).toBe(0);
    expect(selection).toBeDefined();
    expect(selection?.props.visible).toBe(false);
    expect(badgeStroke?.props.strokeEnabled).toBe(false);
  });

  it('keeps cached and normal shell output visually equivalent across rack states', () => {
    const states: Array<Parameters<typeof renderRackBody>[0]> = [
      {},
      { isSelected: true },
      { isHovered: true },
      { isPassive: true },
      { isSelected: true, isPassive: true },
      { rotationDeg: 0 },
      { rotationDeg: 90 },
      { rotationDeg: 180 },
      { rotationDeg: 270 },
      { isPaired: true },
      { isAsymmetric: true },
      { showRackCode: true, displayCode: 'R-77' },
      { showRackCode: false },
      { isSelected: true, isActivelyPanning: true },
      { isSelected: true, isActivelyPanning: false },
      { prominence: 'secondary', placement: 'header-left' },
      { prominence: 'background', placement: 'lower-left-mid' }
    ];

    for (const state of states) {
      const normal = serializeVisualShell(
        renderRackBody({ ...state, shellRendering: 'normal' })
      );
      const cached = serializeVisualShell(
        renderRackBody({ ...state, shellRendering: 'cached' })
      );

      expect(cached).toEqual(normal);
    }
  });

  it('keeps the cached shell non-listening so it cannot cover cell overlays or hit targets', () => {
    const renderer = renderRackBody({ shellRendering: 'cached' });

    expect(getShellGroup(renderer).props.listening).toBe(false);
  });

  it('keeps passive opacity out of selected and active-pan visuals', () => {
    expect(getShellGroup(renderRackBody({ isPassive: true })).props.opacity).toBe(0.5);
    expect(
      getShellGroup(renderRackBody({ isPassive: true, isSelected: true })).props.opacity
    ).toBe(1);
    expect(
      getShellGroup(renderRackBody({ isPassive: true, isActivelyPanning: true })).props.opacity
    ).toBe(1);
  });

  it('does not enable the shell cache unless the diagnostics flag opts in', () => {
    const normal = renderRackBody();
    const normalShell = rackBodyKonvaMocks.groupNodes[0];

    expect(normalShell?.cache).not.toHaveBeenCalled();
    expect(normalShell?.clearCache).toHaveBeenCalledTimes(1);

    renderRackBody({ shellRendering: 'cached' });
    expect(getCachedShellNode().cache).toHaveBeenCalledTimes(1);
    void normal;
  });

  it.each([
    ['geometry width/height', { geometry: { ...singleGeometry, width: 240, height: 90, centerX: 120, centerY: 45 } }],
    ['rotationDeg', { rotationDeg: 90 }],
    ['isSelected', { isSelected: true }],
    ['isHovered', { isHovered: true }],
    ['isPassive', { isPassive: true }],
    ['showRackCode', { showRackCode: false }],
    ['displayCode', { displayCode: 'R-99' }],
    ['rackCodeProminence', { prominence: 'background' }],
    ['rackCodePlacement', { placement: 'header-left' }],
    ['disableStrokes', { disableStrokes: true }],
    ['isActivelyPanning', { isActivelyPanning: true }]
  ] as const)('refreshes the cached shell when %s changes', (_name, changedProps) => {
    const renderer = renderRackBody({ shellRendering: 'cached' });
    const shell = getCachedShellNode();

    expect(shell.cache).toHaveBeenCalledTimes(1);

    updateRackBody(renderer, {
      shellRendering: 'cached',
      ...changedProps
    });

    expect(shell.clearCache).toHaveBeenCalledTimes(2);
    expect(shell.cache).toHaveBeenCalledTimes(2);
    expect(shell.batchDraw).toHaveBeenCalledTimes(2);
  });

  it('clears a cached shell when diagnostics switch back to normal rendering', () => {
    const renderer = renderRackBody({ shellRendering: 'cached' });
    const shell = getCachedShellNode();

    updateRackBody(renderer, { shellRendering: 'normal' });

    expect(shell.cache).toHaveBeenCalledTimes(1);
    expect(shell.clearCache).toHaveBeenCalledTimes(2);
  });

  describe('disableShadows prop', () => {
    it('removes all shadow props from main shell and label pill', () => {
      const normal = renderRackBody({ isSelected: true });
      const shadowless = renderRackBody({ isSelected: true, disableShadows: true });
      const normalRects = getRects(normal);
      const shadowlessRects = getRects(shadowless);

      const normalMain = normalRects.find((r) => r.props.wosRectRole === 'rack-body-main');
      const shadowlessMain = shadowlessRects.find((r) => r.props.wosRectRole === 'rack-body-main');
      expect(normalMain?.props.shadowBlur).toBeGreaterThan(0);
      expect(normalMain?.props.shadowOpacity).toBeGreaterThan(0);
      expect(shadowlessMain?.props.shadowBlur).toBe(0);
      expect(shadowlessMain?.props.shadowOpacity).toBe(0);

      const normalBadge = normalRects.filter((r) => r.props.wosRectRole === 'badge-decoration');
      const shadowlessBadge = shadowlessRects.filter((r) => r.props.wosRectRole === 'badge-decoration');
      expect(normalBadge.length).toBeGreaterThan(0);
      expect(shadowlessBadge.length).toBeGreaterThan(0);
      for (const badge of shadowlessBadge) {
        if (badge.props.shadowBlur !== undefined) {
          expect(badge.props.shadowBlur).toBe(0);
        }
      }
    });

    it('preserves fills, strokes, stripes, labels and selection visuals', () => {
      const shadowless = renderRackBody({ isSelected: true, disableShadows: true });
      const rects = getRects(shadowless);
      expect(rects.find((r) => r.props.wosRectRole === 'rack-body-main')?.props.fill).toBeTruthy();
      expect(rects.find((r) => r.props.wosRectRole === 'rack-body-main')?.props.stroke).toBeTruthy();
      expect(rects.find((r) => r.props.wosRectRole === 'rack-body-stripe')).toBeTruthy();
      expect(rects.find((r) => r.props.wosRectRole === 'selection-highlight')).toBeTruthy();
      expect(shadowless.root.findAll((n) => String(n.type) === 'Text').length).toBeGreaterThan(0);
    });
  });

  describe('simpleShell prop', () => {
    it('renders only one lightweight main Rect per rack', () => {
      const renderer = renderRackBody({ simpleShell: true });
      const rects = getRects(renderer);
      expect(rects).toHaveLength(1);
      expect(rects[0]!.props.wosRectRole).toBe('rack-body-main');
    });

    it('preserves rack position, width, height and base fill', () => {
      const renderer = renderRackBody({ simpleShell: true, geometry: { ...singleGeometry, width: 300, height: 100, centerX: 150, centerY: 50 } });
      const rect = getRects(renderer)[0]!;
      expect(rect.props.width).toBe(300);
      expect(rect.props.height).toBe(100);
      expect(rect.props.fill).toBe('#ffffff');
    });

    it('removes cornerRadius, stroke, shadow', () => {
      const renderer = renderRackBody({ simpleShell: true, isSelected: true });
      const rect = getRects(renderer)[0]!;
      expect(rect.props.cornerRadius).toBe(0);
      expect(rect.props.stroke).toBeUndefined();
      expect(rect.props.shadowBlur).toBe(0);
    });

    it('removes stripes, labels, selection, spine and boundary lines', () => {
      const renderer = renderRackBody({ simpleShell: true, isSelected: true, isPaired: true, isAsymmetric: true });
      const rects = getRects(renderer);
      expect(rects.filter((r) => r.props.wosRectRole === 'rack-body-stripe')).toHaveLength(0);
      expect(rects.filter((r) => r.props.wosRectRole === 'selection-highlight')).toHaveLength(0);
      expect(rects.filter((r) => r.props.wosRectRole === 'rack-body-overhang')).toHaveLength(0);
      expect(renderer.root.findAll((n) => String(n.type) === 'Line')).toHaveLength(0);
      expect(renderer.root.findAll((n) => String(n.type) === 'Text')).toHaveLength(0);
    });
  });

  describe('disableLabels prop', () => {
    it('suppresses only the label Group subtree', () => {
      const normal = renderRackBody({ showRackCode: true });
      const labeless = renderRackBody({ showRackCode: true, disableLabels: true });

      expect(normal.root.findAll((n) => String(n.type) === 'Text').length).toBeGreaterThan(0);
      expect(labeless.root.findAll((n) => String(n.type) === 'Text')).toHaveLength(0);

      const normalRects = getRects(normal);
      const labelessRects = getRects(labeless);
      const normalBadgeCount = normalRects.filter((r) => r.props.wosRectRole === 'badge-decoration').length;
      const labelessBadgeCount = labelessRects.filter((r) => r.props.wosRectRole === 'badge-decoration').length;
      expect(labelessBadgeCount).toBe(0);
      expect(normalBadgeCount).toBeGreaterThan(0);
    });

    it('preserves main body, fills, strokes, stripes and shadows', () => {
      const labeless = renderRackBody({ isSelected: true, disableLabels: true });
      const rects = getRects(labeless);
      expect(rects.find((r) => r.props.wosRectRole === 'rack-body-main')?.props.fill).toBeTruthy();
      expect(rects.find((r) => r.props.wosRectRole === 'rack-body-main')?.props.stroke).toBeTruthy();
      expect(rects.find((r) => r.props.wosRectRole === 'rack-body-main')?.props.shadowBlur).toBeGreaterThan(0);
      expect(rects.find((r) => r.props.wosRectRole === 'rack-body-stripe')).toBeTruthy();
      expect(rects.find((r) => r.props.wosRectRole === 'selection-highlight')).toBeTruthy();
    });
  });

  describe('disableBodyStrokes prop', () => {
    it('suppresses main shell stroke', () => {
      const renderer = renderRackBody({ disableBodyStrokes: true });
      const body = getRects(renderer).find((r) => r.props.wosRectRole === 'rack-body-main');
      expect(body?.props.stroke).toBeUndefined();
      expect(body?.props.strokeEnabled).toBe(false);
    });

    it('suppresses spine and boundary lines', () => {
      const paired = renderRackBody({ isPaired: true, disableBodyStrokes: true });
      expect(paired.root.findAll((n) => String(n.type) === 'Line')).toHaveLength(0);

      const asymmetric = renderRackBody({ isAsymmetric: true, disableBodyStrokes: true });
      expect(asymmetric.root.findAll((n) => String(n.type) === 'Line')).toHaveLength(0);
    });

    it('preserves fills, shadows, stripes and labels', () => {
      const renderer = renderRackBody({ isSelected: true, disableBodyStrokes: true });
      const rects = getRects(renderer);
      const body = rects.find((r) => r.props.wosRectRole === 'rack-body-main');
      expect(body?.props.fill).toBeTruthy();
      expect(body?.props.shadowBlur).toBeGreaterThan(0);
      expect(rects.find((r) => r.props.wosRectRole === 'rack-body-stripe')).toBeTruthy();
      expect(renderer.root.findAll((n) => String(n.type) === 'Text').length).toBeGreaterThan(0);
    });
  });
});
