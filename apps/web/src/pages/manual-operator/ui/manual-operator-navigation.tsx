import { Calendar, CheckSquare, ClipboardList, Package, Printer, Upload, Users, ListTodo, Route } from 'lucide-react';
import type { ManualOperatorSection } from '@/shared/config/routes';
import {
  manualOperatorSectionPath,
  routes
} from '@/shared/config/routes';

export type ManualOperatorSectionGroup =
  | 'workflow'
  | 'management'
  | 'data-planning';

export interface ManualOperatorSectionItem {
  section: ManualOperatorSection;
  label: string;
  path: string;
  testId: string;
  icon: typeof ListTodo;
  group: ManualOperatorSectionGroup;
}

export const manualOperatorSectionItems: ManualOperatorSectionItem[] = [
  { section: 'work', label: 'עבודה', path: routes.operatorManualWork, testId: 'manual-section-work', icon: ListTodo, group: 'workflow' },
  { section: 'summary', label: 'סיכום', path: routes.operatorManualSummary, testId: 'manual-section-summary', icon: Calendar, group: 'management' },
  { section: 'check', label: 'בדיקה', path: routes.operatorManualCheck, testId: 'manual-section-check', icon: CheckSquare, group: 'workflow' },
  { section: 'people', label: 'עובדים', path: routes.operatorManualPeople, testId: 'manual-section-people', icon: Users, group: 'management' },
  { section: 'products', label: 'מוצרים', path: routes.operatorManualProducts, testId: 'manual-section-products', icon: Package, group: 'management' },
  { section: 'ashlamot', label: 'אשלמות', path: routes.operatorManualAshlamot, testId: 'manual-section-ashlamot', icon: ClipboardList, group: 'workflow' },
  { section: 'printing', label: 'הדפסה', path: routes.operatorManualPrinting, testId: 'manual-section-printing', icon: Printer, group: 'workflow' },
  { section: 'import', label: 'ייבוא', path: routes.operatorManualImport, testId: 'manual-section-import', icon: Upload, group: 'data-planning' },
  { section: 'lines', label: 'תכנון קווים', path: routes.operatorManualLines, testId: 'manual-section-lines', icon: Route, group: 'data-planning' }
];

export const manualOperatorSectionGroups: Array<{
  id: ManualOperatorSectionGroup;
  label: string;
}> = [
  { id: 'workflow', label: 'תהליך עבודה' },
  { id: 'management', label: 'ניהול ובקרה' },
  { id: 'data-planning', label: 'נתונים ותכנון' }
];

export function getManualOperatorSectionLabel(section: ManualOperatorSection) {
  return manualOperatorSectionItems.find((item) => item.section === section)?.label ?? section;
}

export function getManualOperatorSectionPath(section: ManualOperatorSection) {
  return manualOperatorSectionPath(section);
}
