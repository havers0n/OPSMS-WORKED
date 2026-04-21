import type { ReactNode } from 'react';
import { Layer, Stage } from 'react-konva';

export function WarehouseScene({
  width,
  height,
  children
}: {
  width: number;
  height: number;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
      <Stage width={width} height={height}>
        <Layer>{children}</Layer>
      </Stage>
    </div>
  );
}
