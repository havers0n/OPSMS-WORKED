import { Calendar, CheckSquare, ClipboardList, Package, Printer, Upload, Users, ListTodo } from 'lucide-react';
import type { ManualOperatorSection } from '@/shared/config/routes';
import {
  manualOperatorSectionPath,
  routes
} from '@/shared/config/routes';

export interface ManualOperatorSectionItem {
  section: ManualOperatorSection;
  label: string;
  path: string;
  testId: string;
  icon: typeof ListTodo;
}

export const manualOperatorSectionItems: ManualOperatorSectionItem[] = [
  { section: 'work', label: 'עבודה', path: routes.operatorManualWork, testId: 'manual-section-work', icon: ListTodo },
  { section: 'summary', label: 'סיכום', path: routes.operatorManualSummary, testId: 'manual-section-summary', icon: Calendar },
  { section: 'check', label: 'בדיקה', path: routes.operatorManualCheck, testId: 'manual-section-check', icon: CheckSquare },
  { section: 'people', label: 'עובדים', path: routes.operatorManualPeople, testId: 'manual-section-people', icon: Users },
  { section: 'products', label: 'מוצרים', path: routes.operatorManualProducts, testId: 'manual-section-products', icon: Package },
  { section: 'ashlamot', label: 'אשלמות', path: routes.operatorManualAshlamot, testId: 'manual-section-ashlamot', icon: ClipboardList },
  { section: 'printing', label: 'הדפסה', path: routes.operatorManualPrinting, testId: 'manual-section-printing', icon: Printer },
  { section: 'import', label: 'ייבוא', path: routes.operatorManualImport, testId: 'manual-section-import', icon: Upload }
];

export function getManualOperatorSectionLabel(section: ManualOperatorSection) {
  return manualOperatorSectionItems.find((item) => item.section === section)?.label ?? section;
}

export function getManualOperatorSectionPath(section: ManualOperatorSection) {
  return manualOperatorSectionPath(section);
}
