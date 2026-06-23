import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { ManualOperatorSection } from '@/shared/config/routes';
import { useMediaQuery } from '@/shared/hooks/use-media-query';
import {
  getManualOperatorSectionLabel,
  manualOperatorSectionGroups,
  manualOperatorSectionItems
} from './manual-operator-navigation';

interface ManualSectionSwitcherProps {
  activeSection: ManualOperatorSection;
  onSelectSection: (section: ManualOperatorSection) => void;
}

export function ManualSectionSwitcher({
  activeSection,
  onSelectSection
}: ManualSectionSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const isMobile = useMediaQuery('(max-width: 767px)');
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const panelId = useId();

  const groupedItems = useMemo(
    () =>
      manualOperatorSectionGroups.map((group) => ({
        ...group,
        items: manualOperatorSectionItems.filter((item) => item.group === group.id)
      })),
    []
  );

  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(event: MouseEvent | TouchEvent) {
      const target = event.target as Node | null;
      if (!target) return;
      if (triggerRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setIsOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  function handleSelect(section: ManualOperatorSection) {
    onSelectSection(section);
    setIsOpen(false);
  }

  return (
    <div className="relative" dir="rtl">
      <button
        ref={triggerRef}
        type="button"
        className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm transition-colors hover:border-gray-300 hover:bg-gray-50"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-controls={panelId}
        data-testid="manual-section-switcher-trigger"
        onClick={() => setIsOpen((open) => !open)}
      >
        <span>{getManualOperatorSectionLabel(activeSection)}</span>
        <ChevronDown
          size={16}
          className={`text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      {isOpen && (
        <>
          {isMobile && <div className="fixed inset-0 z-30 bg-slate-900/20" aria-hidden="true" />}
          <div
            ref={panelRef}
            id={panelId}
            role="dialog"
            aria-label="מעבר בין חלקי מפעיל ידני"
            data-testid="manual-section-switcher-panel"
            className={
              isMobile
                ? 'fixed inset-x-3 top-[calc(env(safe-area-inset-top)+4.75rem)] z-40 rounded-2xl border border-gray-200 bg-white p-3 shadow-2xl'
                : 'absolute right-0 top-[calc(100%+0.5rem)] z-40 w-[22rem] rounded-2xl border border-gray-200 bg-white p-3 shadow-xl'
            }
          >
            <div className="space-y-3">
              {groupedItems.map((group) => (
                <section
                  key={group.id}
                  aria-labelledby={`${panelId}-${group.id}`}
                  data-testid={`manual-section-group-${group.id}`}
                >
                  <h2
                    id={`${panelId}-${group.id}`}
                    className="px-2 pb-1 text-xs font-semibold tracking-[0.08em] text-gray-500"
                  >
                    {group.label}
                  </h2>
                  <div className="space-y-1">
                    {group.items.map((item) => {
                      const isActive = item.section === activeSection;
                      return (
                        <button
                          key={item.section}
                          type="button"
                          className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-right text-sm transition-colors ${
                            isActive
                              ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-200'
                              : 'text-gray-700 hover:bg-gray-50'
                          }`}
                          aria-current={isActive ? 'page' : undefined}
                          data-testid={item.testId}
                          onClick={() => handleSelect(item.section)}
                        >
                          <span className="font-medium">{item.label}</span>
                          {isActive && <span className="text-xs font-semibold text-blue-600">פעיל</span>}
                        </button>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
