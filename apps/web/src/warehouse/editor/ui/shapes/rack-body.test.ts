import React, { createElement } from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';
import { RackBody } from './rack-body';

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

function renderRackBody(params?: {
  prominence?: 'dominant' | 'secondary' | 'background';
  placement?: 'header-left' | 'lower-left-mid';
  rotationDeg?: 0 | 90 | 180 | 270;
  isPaired?: boolean;
  isSelected?: boolean;
  isActivelyPanning?: boolean;
}) {
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(
      createElement(RackBody, {
        geometry: params?.isPaired ? pairedGeometry : singleGeometry,
        displayCode: 'R-01',
        rotationDeg: params?.rotationDeg ?? 0,
        isSelected: params?.isSelected ?? false,
        isHovered: false,
        showRackCode: true,
        rackCodeProminence: params?.prominence ?? 'dominant',
        rackCodePlacement: params?.placement ?? 'lower-left-mid',
        isActivelyPanning: params?.isActivelyPanning
      })
    );
  });
  return renderer;
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

describe('RackBody identity label ownership', () => {
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
    const body = rects.find((rect) => rect.props.wosRectRole === 'rack-body');
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
    const body = rects.find((rect) => rect.props.wosRectRole === 'rack-body');
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
});
