export type StorageDebugFlags = {
  debugEnabled: boolean;
  disableStorageWorkspace: boolean;
  disableStorageCanvas: boolean;
  disableRackLayer: boolean;
  disableRackCells: boolean;
  disableRackRuntimeVisuals: boolean;
  disableRackBodies: boolean;
  disableCanvasSceneData: boolean;
  forceKonvaPixelRatio1: boolean;
  disableStorageData: boolean;
  disableInspector: boolean;
  disableNavigator: boolean;
  disableOccupancyOverlay: boolean;
  disableRackBodyShadows: boolean;
  simpleRackBodyShell: boolean;
  disableRackBodyLabels: boolean;
  disableRackBodyStrokes: boolean;
};

function isEnabled(params: URLSearchParams, key: string) {
  return params.get(key) === '1';
}

export function resolveStorageDebugFlags(search: string): StorageDebugFlags {
  const params = new URLSearchParams(search);
  const debugEnabled = isEnabled(params, 'debug');

  return {
    debugEnabled,
    disableStorageWorkspace: debugEnabled && isEnabled(params, 'disableStorageWorkspace'),
    disableStorageCanvas: debugEnabled && isEnabled(params, 'disableStorageCanvas'),
    disableRackLayer: debugEnabled && isEnabled(params, 'disableRackLayer'),
    disableRackCells: debugEnabled && isEnabled(params, 'disableRackCells'),
    disableRackRuntimeVisuals: debugEnabled && isEnabled(params, 'disableRackRuntimeVisuals'),
    disableRackBodies: debugEnabled && isEnabled(params, 'disableRackBodies'),
    disableCanvasSceneData: debugEnabled && isEnabled(params, 'disableCanvasSceneData'),
    forceKonvaPixelRatio1: debugEnabled && isEnabled(params, 'forceKonvaPixelRatio1'),
    disableStorageData: debugEnabled && isEnabled(params, 'disableStorageData'),
    disableInspector: debugEnabled && isEnabled(params, 'disableInspector'),
    disableNavigator: debugEnabled && isEnabled(params, 'disableNavigator'),
    disableOccupancyOverlay: debugEnabled && isEnabled(params, 'disableOccupancyOverlay'),
    disableRackBodyShadows: debugEnabled && isEnabled(params, 'disableRackBodyShadows'),
    simpleRackBodyShell: debugEnabled && isEnabled(params, 'simpleRackBodyShell'),
    disableRackBodyLabels: debugEnabled && isEnabled(params, 'disableRackBodyLabels'),
    disableRackBodyStrokes: debugEnabled && isEnabled(params, 'disableRackBodyStrokes')
  };
}

export function readStorageDebugFlagsFromWindow(): StorageDebugFlags {
  if (typeof window === 'undefined') {
    return resolveStorageDebugFlags('');
  }

  return resolveStorageDebugFlags(window.location.search);
}

export function resolveEffectiveKonvaPixelRatio(params: {
  devicePixelRatio: number | null | undefined;
  flags: Pick<StorageDebugFlags, 'forceKonvaPixelRatio1'>;
}) {
  if (params.flags.forceKonvaPixelRatio1) return 1;
  return params.devicePixelRatio && params.devicePixelRatio > 0
    ? params.devicePixelRatio
    : 1;
}
