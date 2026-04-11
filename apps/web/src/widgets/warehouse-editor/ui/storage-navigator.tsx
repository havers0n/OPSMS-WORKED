import React from 'react';
import { useNavigationRackId, useNavigationActiveLevel, useSelectionLocationId } from '../model/v2/v2-selectors';
import { mockLocationsByLevel } from './storage-navigator.fixtures';

/**
 * StorageNavigator — Isolated shell component for storage mode.
 *
 * This component provides navigation UI for warehouse locations:
 * - Search input (shell, no filtering logic yet)
 * - Occupancy filter buttons (shell, no filter state yet)
 * - Level tabs (shell, no switching logic yet)
 * - Location list (static, from fixture data)
 *
 * V2 Integration:
 * - Reads navigation-store: rackId, activeLevel (display context)
 * - Reads selection-store: locationId (highlight selected item)
 * - No mutations or side effects
 *
 * Integration Status:
 * - Component is isolated, not yet integrated into warehouse-editor
 * - Deferred to PR4/integration PR
 */
export function StorageNavigator() {
  // V2 store selectors (graceful nulls)
  const rackId = useNavigationRackId() ?? 'Unknown Rack';
  const activeLevel = useNavigationActiveLevel() ?? 1;
  const selectedLocationId = useSelectionLocationId() ?? null;

  // Get locations for active level from fixture
  const locationsForLevel = mockLocationsByLevel[activeLevel] ?? [];

  return (
    <div className="flex flex-col h-full bg-white border-r border-gray-200 w-80 overflow-hidden">
      {/* Header: Rack Context Display */}
      <div className="px-4 py-3 border-b border-gray-200 flex-shrink-0">
        <div className="text-sm font-semibold text-gray-700">
          Current: <span className="text-gray-900">{rackId}</span>
        </div>
      </div>

      {/* Level Tabs */}
      <div className="px-4 py-3 border-b border-gray-200 flex-shrink-0">
        <div className="flex gap-2 items-center">
          <span className="text-xs font-medium text-gray-600">Level:</span>
          <div className="flex gap-2">
            {[1, 2, 3].map((level) => (
              <button
                key={level}
                className={`px-3 py-1 text-sm font-medium rounded border transition-colors ${
                  activeLevel === level
                    ? 'bg-blue-100 border-blue-400 text-blue-900'
                    : 'bg-gray-50 border-gray-300 text-gray-700 hover:bg-gray-100'
                }`}
                disabled
                title="Level switching deferred to PR3+"
              >
                {level}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="px-4 py-3 border-b border-gray-200 flex-shrink-0 space-y-2">
        {/* Search Input */}
        <div className="flex items-center gap-2 bg-gray-50 border border-gray-300 rounded px-2 py-1">
          <input
            type="text"
            placeholder="Find location..."
            className="flex-1 bg-transparent text-sm outline-none placeholder-gray-400"
            disabled
            title="Search filtering deferred to PR3+"
          />
          <span className="text-gray-400">🔍</span>
        </div>

        {/* Occupancy Filter Buttons */}
        <div className="flex gap-2">
          <button
            className="flex-1 px-2 py-1.5 text-xs font-medium border rounded transition-colors bg-gray-50 border-gray-300 text-gray-700 hover:bg-gray-100"
            disabled
            title="Filter logic deferred to PR3+"
          >
            🟢 Empty Only
          </button>
          <button
            className="flex-1 px-2 py-1.5 text-xs font-medium border rounded transition-colors bg-gray-50 border-gray-300 text-gray-700 hover:bg-gray-100"
            disabled
            title="Filter logic deferred to PR3+"
          >
            All
          </button>
        </div>
      </div>

      {/* Location List (Scrollable) */}
      <div className="flex-1 overflow-y-auto">
        {locationsForLevel.length > 0 ? (
          <div>
            {/* Level Header */}
            <div className="sticky top-0 px-4 py-2 bg-gray-100 border-b border-gray-200">
              <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                Level {activeLevel} ({locationsForLevel.length} locations)
              </h3>
            </div>

            {/* Location Items */}
            <div className="divide-y divide-gray-200">
              {locationsForLevel.map((location) => (
                <div
                  key={location.id}
                  className={`px-4 py-2 text-sm flex items-center gap-2 cursor-pointer transition-colors ${
                    selectedLocationId === location.id
                      ? 'bg-blue-50 border-l-2 border-blue-400'
                      : 'hover:bg-gray-50'
                  }`}
                  title={
                    selectedLocationId === location.id
                      ? `Selected: ${location.id}`
                      : `Location ${location.id} - ${location.status}`
                  }
                >
                  {/* Status Icon */}
                  <span className="text-base flex-shrink-0">
                    {location.status === 'empty' && '🟢'}
                    {location.status === 'occupied' && '🔴'}
                    {location.status === 'full' && '⚪'}
                  </span>

                  {/* Location ID */}
                  <span className="font-mono font-medium text-gray-900 flex-1">
                    {location.id}
                  </span>

                  {/* Container ID (if occupied) */}
                  {location.containerId && (
                    <span className="text-xs text-gray-600 flex-shrink-0">
                      {location.containerId}
                    </span>
                  )}

                  {/* Selection Indicator */}
                  {selectedLocationId === location.id && (
                    <span className="text-xs text-blue-600 font-semibold flex-shrink-0">←</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="px-4 py-8 text-center text-sm text-gray-500">
            No locations for level {activeLevel}
          </div>
        )}
      </div>

      {/* Footer: Implementation Status */}
      <div className="px-4 py-2 border-t border-gray-200 flex-shrink-0 text-xs text-gray-500 bg-gray-50">
        <p>
          <span className="font-medium">PR2 Status:</span> Shell only. Real data, mutations, and
          inspector wiring deferred to PR3+.
        </p>
      </div>
    </div>
  );
}
