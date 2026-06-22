import type { SchemePrintData } from '../types/printDtos';

interface SchemePrintDocumentProps {
  data: SchemePrintData;
}

export function SchemePrintDocument({ data }: SchemePrintDocumentProps) {
  return (
    <>
      <h1>סכימת משמרת — {data.shiftName}</h1>
      <div className="print-meta">
        <div>תאריך: {data.shiftDate}</div>
        <div>אזור הפצה: {data.distributionArea}</div>
        <div>נוצר בתאריך: {data.generatedAt}</div>
      </div>

      {data.workGroups.map((group, index) => (
        <div key={index} className="page-break-inside" style={{ marginBottom: '6mm' }}>
          <h2>
            {group.groupName}
            <span style={{ fontSize: '10pt', fontWeight: 400, marginRight: 8 }}>
              ({group.orderCount} הזמנות, {group.totalQuantity} יחידות)
            </span>
          </h2>

          <table className="print-table">
            <thead>
              <tr>
                <th>מס' הזמנה</th>
                <th>לקוח</th>
                <th>נקודה</th>
                <th>כמות</th>
                <th>סטטוס</th>
              </tr>
            </thead>
            <tbody>
              {group.orders.map((order, oi) => (
                <tr key={oi}>
                  <td>{order.orderNumber}</td>
                  <td>{order.customerName}</td>
                  <td>{order.pointName}</td>
                  <td className="print-qty">{order.quantity}</td>
                  <td>{order.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </>
  );
}
