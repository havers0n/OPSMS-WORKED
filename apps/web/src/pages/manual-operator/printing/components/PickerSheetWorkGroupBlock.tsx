import type { PickerSheetWorkGroup, PickerSheetScope } from '../types/printDtos';

interface PickerSheetWorkGroupBlockProps {
  workGroup: PickerSheetWorkGroup;
  scope: PickerSheetScope;
  lineName: string;
  isFirst: boolean;
}

export function PickerSheetWorkGroupBlock({ workGroup, scope, lineName, isFirst }: PickerSheetWorkGroupBlockProps) {
  const forcePageBreak = scope !== 'workGroup' && !isFirst;

  return (
    <div className={forcePageBreak ? 'page-break-before' : ''} style={{ marginBottom: '6mm' }}>
      <h2>
        {lineName} — {workGroup.name}
        <span style={{ fontSize: '10pt', fontWeight: 400, marginRight: 8 }}>
          ({workGroup.items.length} פריטים)
        </span>
      </h2>

      <table className="print-table">
        <thead>
          <tr>
            <th>מק״ט</th>
            <th>שם מוצר</th>
            <th>כמות</th>
            <th>הערה</th>
          </tr>
        </thead>
        <tbody>
          {workGroup.items.map((item, ii) => (
            <tr key={ii}>
              <td style={{ direction: 'ltr', textAlign: 'right' }}>
                {item.warning === 'sku_display_collision' ? item.sku : item.displaySku}
                {item.warning === 'sku_display_collision' && (
                  <span style={{ color: '#b91c1c', fontSize: '7pt', marginRight: 4 }}>
                    התנגשות
                  </span>
                )}
              </td>
              <td>{item.description}</td>
              <td className="print-qty">{item.quantity}</td>
              <td>{item.warning === 'sku_display_collision' ? 'מק״ט מלא זמני' : ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
