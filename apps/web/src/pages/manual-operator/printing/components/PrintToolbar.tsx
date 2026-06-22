import { Link } from 'react-router-dom';
import { routes } from '@/shared/config/routes';

export function PrintToolbar() {
  return (
    <div className="no-print" style={{ position: 'sticky', top: 0, zIndex: 100, background: '#fff', borderBottom: '1px solid #ccc', padding: '8px 16px', display: 'flex', gap: 12, alignItems: 'center', direction: 'rtl' }}>
      <button
        type="button"
        onClick={() => window.print()}
        style={{ padding: '6px 16px', background: '#0f6a8e', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 600, fontSize: 14 }}
      >
        הדפס
      </button>
      <Link
        to={routes.operatorManualPrinting}
        style={{ padding: '6px 16px', background: '#f0f0f0', color: '#333', border: '1px solid #ccc', borderRadius: 4, textDecoration: 'none', fontWeight: 500, fontSize: 14 }}
      >
        חזור להדפסות
      </Link>
    </div>
  );
}
