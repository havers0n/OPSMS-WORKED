import React, { useState } from 'react';
import {
  useNavigationRackId,
  useNavigationActiveLevel,
  useSelectionLocationId,
  useSetLevel,
  useSelectLocation,
} from '../model/v2/v2-selectors';
import { mockLocationsByLevel } from './storage-navigator.fixtures';

/**
 * StorageNavigator — Interactive V2 navigator for storage mode.
 *
 * V2 Integration:
 * - Reads navigation-store: rackId, activeLevel (display context)
 * - Writes navigation-store: setLevel (level tab clicks)
 * - Reads selection-store: locationId (highlight selected item)
 * - Writes selection-store: selectLocation (location item clicks)
 *
 * Local UI state:
 * - searchQuery: substring filter on location ID
 * - occupancyFilter: 'all' | 'empty-only'
 *
 * Non-goals (deferred to PR5+):
 * - No inspector wiring
 * - No canvas highlight integration
 * - No legacy store bridge
 * - No task mode
 */
export function StorageNavigator() {
  // V2 store — read
  const rackId = useNavigationRackId() ?? 'Unknown Rack';
  const activeLevel = useNavigationActiveLevel() ?? 1;
  const selectedLocationId = useSelectionLocationId() ?? null;

  // V2 store — write
  const setLevel = useSetLevel();
  const selectLocation = useSelectLocation();

  // Local UI state
  const [searchQuery, setSearchQuery] = useState('');
  const [occupancyFilter, setOccupancyFilter] = useState<'all' | 'empty-only'>('all');

  // Filtering chain
  const locationsForLevel = mockLocationsByLevel[activeLevel] ?? [];
  const visibleLocations = locationsForLevel
    .filter(loc => occupancyFilter === 'all' || loc.status === 'empty')
    .filter(loc =>
      searchQuery.trim() === '' ||
      loc.id.toLowerCase().includes(searchQuery.trim().toLowerCase())
    );

  const filtersActive = occupancyFilter !== 'all' || searchQuery.trim() !== '';

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
                onClick={() => setLevel(level)}
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
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
          <span className="text-gray-400">🔍</span>
        </div>

        {/* Occupancy Filter Buttons */}
        <div className="flex gap-2">
          <button
            className={`flex-1 px-2 py-1.5 text-xs font-medium border rounded transition-colors ${
              occupancyFilter === 'empty-only'
                ? 'bg-blue-100 border-blue-400 text-blue-900'
                : 'bg-gray-50 border-gray-300 text-gray-700 hover:bg-gray-100'
            }`}
            onClick={() => setOccupancyFilter('empty-only')}
          >
            🟢 Empty Only
          </button>
          <button
            className={`flex-1 px-2 py-1.5 text-xs font-medium border rounded transition-colors ${
              occupancyFilter === 'all'
                ? 'bg-blue-100 border-blue-400 text-blue-900'
                : 'bg-gray-50 border-gray-300 text-gray-700 hover:bg-gray-100'
            }`}
            onClick={() => setOccupancyFilter('all')}
          >
            All
          </button>
        </div>
      </div>

      {/* Location List (Scrollable) */}
      <div className="flex-1 overflow-y-auto">
        {locationsForLevel.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-gray-500">
            No locations for level {activeLevel}
          </div>
        ) : visibleLocations.length === 0 && filtersActive ? (
          <div className="px-4 py-8 text-center text-sm text-gray-500">
            No locations match current filters
          </div>
        ) : (
          <div>
            {/* Level Header */}
            <div className="sticky top-0 px-4 py-2 bg-gray-100 border-b border-gray-200">
              <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                Level {activeLevel} ({visibleLocations.length} locations)
              </h3>
            </div>

            {/* Location Items */}
            <div className="divide-y divide-gray-200">
              {visibleLocations.map((location) => (
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
                  onClick={() => selectLocation(location.id)}
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
        )}
      </div>

      {/* Footer: Implementation Status */}
      <div className="px-4 py-2 border-t border-gray-200 flex-shrink-0 text-xs text-gray-500 bg-gray-50">
        <p>
          <span className="font-medium">PR4 Status:</span> Interactive — level tabs, search,
          occupancy filter, and location selection active. Inspector wiring deferred to PR5+.
        </p>
      </div>
    </div>
  );
}
