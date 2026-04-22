import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import TestRenderer, { act } from 'react-test-renderer';
import { ProductMediaSection } from './product-media-section';

(
  globalThis as typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT?: boolean;
  }
).IS_REACT_ACT_ENVIRONMENT = true;

describe('ProductMediaSection', () => {
  it('renders selected media state and wires thumbnail/lightbox callbacks', () => {
    const onImageLoadError = vi.fn();
    const onSelectImage = vi.fn();
    const onOpenLightbox = vi.fn();
    const onCloseLightbox = vi.fn();
    const onGoToPreviousImage = vi.fn();
    const onGoToNextImage = vi.fn();

    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        React.createElement(ProductMediaSection, {
          productName: 'Demo Product',
          displayImages: ['/a.png', '/b.png'],
          activeImageIndex: 1,
          selectedImageUrl: '/b.png',
          lightboxOpen: true,
          onImageLoadError,
          onSelectImage,
          onOpenLightbox,
          onCloseLightbox,
          onGoToPreviousImage,
          onGoToNextImage
        })
      );
    });

    const root = renderer.root;
    expect(root.findByProps({ className: 'text-xs text-slate-500' }).children.join('')).toBe('2/2');

    const buttons = root.findAllByType('button');
    act(() => {
      buttons[0]!.props.onClick();
      buttons[1]!.props.onClick();
      buttons[2]!.props.onClick();
      buttons[3]!.props.onClick();
      buttons[4]!.props.onClick();
      buttons[5]!.props.onClick();
      root.findByProps({ role: 'presentation' }).props.onClick();
    });

    expect(onOpenLightbox).toHaveBeenCalledTimes(1);
    expect(onSelectImage).toHaveBeenCalledWith(0);
    expect(onSelectImage).toHaveBeenCalledWith(1);
    expect(onCloseLightbox).toHaveBeenCalledTimes(2);
    expect(onGoToPreviousImage).toHaveBeenCalledTimes(1);
    expect(onGoToNextImage).toHaveBeenCalledTimes(1);

    const images = root.findAllByType('img');
    act(() => {
      images[0]!.props.onError();
      images[1]!.props.onError();
      images[3]!.props.onError();
    });

    expect(onImageLoadError).toHaveBeenNthCalledWith(1, '/b.png');
    expect(onImageLoadError).toHaveBeenNthCalledWith(2, '/a.png');
    expect(onImageLoadError).toHaveBeenNthCalledWith(3, '/b.png');
  });
});
