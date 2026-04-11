# Inspector & Navigation Redesign — Navigator-First Architecture



## Core Principle



**Navigation is NOT dependent on the canvas.** The system must work equally well with canvas hidden, minimized, or not yet loaded. This is a warehouse operations system, not a spatial exploration tool.



---



## System Architecture



### Three Independent Surfaces



```

┌─────────────────────────────────────────────────────────────┐

│ [View] [Storage] [Layout] — Mode Tabs                       │

└─────────────────────────────────────────────────────────────┘

┌──────────────┬─────────────────────────────────┬────────────┐

│   NAVIGATOR  │        CANVAS (OPTIONAL)        │ INSPECTOR  │

│              │                                 │            │

│ Search       │ [Rack 01 floor plan view]      │ Breadcrumb │

│ Filter       │ Click to highlight selection   │            │

│ Level Tabs   │ (or toggle off completely)     │ Location   │

│ Location List│                                 │ Detail     │

│ [Previous]   │                                 │            │

│ [Next]       │                                 │ Quick      │

│ [Recent]     │                                 │ Actions    │

│              │                                 │ [buttons]  │

└──────────────┴─────────────────────────────────┴────────────┘

```



---



## Part 1: Navigator (Primary Navigation Surface)



### Navigator Layout & Components



```

┌─────────────────────────────┐

│   LOCATION NAVIGATOR        │ ← First-class system component

├─────────────────────────────┤

│ Current: [Rack 01] ▼        │ ← Scope indicator (clickable)

│                             │

│ Level:  [1] [2] [3]         │ ← Quick level switcher

│        ↑ active level       │

│                             │

│ SEARCH & FILTER             │

│ Find: [_____________] 🔍    │ ← Primary: instant jump by ID

│ [🟢 Empty Only] [All]       │ ← Secondary: occupancy filter

│                             │

│ ───────────────────────     │

│ LEVEL 1 (9 locations)       │

│ ───────────────────────     │

│ 01-A.02.01  🟢              │ ← Scannable item (<40px)

│ 01-A.02.02  🔴  XYZ         │    ID + status + container ID (if compact)

│ 01-A.02.03  🟢  ← current   │ ← Selection highlight

│ 01-A.02.04  ⚪              │

│ 01-A.02.05  🟢              │

│ 01-A.02.06  🔴  ABC         │

│ 01-A.02.07  🟢              │

│ 01-A.02.08  🟢              │

│ 01-A.02.09  🟢              │

│                             │

│ ───────────────────────     │

│ RECENT LOCATIONS            │

│ ───────────────────────     │

│ 01-A.03.05  🟢              │ ← Recently visited (for quick return)

│ 01-A.01.12  🔴  PQR         │

│                             │

│ [◀ Previous] [Next ▶]       │ ← Quick nav to adjacent locations

│                             │

│              ⬇ scroll       │

└─────────────────────────────┘

```



### Navigator Interactions



**Search (Primary):**

- User types "01-A.03.05" in search box

- List filters to match instantly

- User clicks result to select

- Inspector updates immediately

- Canvas highlights (if visible)



**Level Switching:**

- Click [2] tab

- List updates to show Level 2 locations

- Navigator list reorganizes

- Inspector clears (no location selected yet)



**Occupancy Filter:**

- Click [🟢 Empty Only] toggle

- List shows only unoccupied locations

- Useful for finding available slots to place containers



**Recent Locations:**

- Shows last 3-5 visited locations

- Quick return without searching

- Useful for operations like "moving between two locations"



**Previous/Next:**

- Buttons to jump to adjacent location in list

- Useful for sequential operations (e.g., filling slots)

- Updates inspector, canvas highlight changes



### Navigator List Item Structure



**Compact Scannable Format:**

```

LOCATION_ID  STATUS_ICON  [CONTAINER_ID]  [BADGE]



Examples:

01-A.02.01   🟢                              ← Empty, no badge

01-A.02.02   🔴          XYZ                 ← Occupied with container

01-A.02.03   ⚪                      [90%]   ← At capacity warning

01-A.02.04   🟢                              ← Empty

```



**Color Coding:**

- 🟢 = Empty (available for placement)

- 🔴 = Occupied (has container)

- ⚪ = At Capacity (full or near-full)



**Information Hierarchy:**

1. Location ID (always visible, scannable)

2. Status icon (quick visual)

3. Container ID (only if occupied, optional detail)

4. Capacity badge (only if relevant to task)



**Scan Time:** <1 second per item to decide action



---



## Part 2: Inspector (Read-Only Detail Surface)



### Inspector Structure



```

┌─────────────────────────────┐

│ [Rack 01] / [Level 1]       │ ← Breadcrumb (context, not nav)

│ / [Location 01-A.02.03.01] │

├─────────────────────────────┤

│ STATUS SUMMARY (60px)       │

│ 🟢 Empty | Type: Rack Slot  │

│ Capacity: Single Container  │

├─────────────────────────────┤

│ CURRENT CONTENTS (80px)     │

│ None                        │

│                             │

│ OR (if occupied):           │

│ 🟡 Container XYZ            │

│ Status: Active              │

│ Expires: 2026-05            │

├─────────────────────────────┤

│ INVENTORY (expandable, 100px)

│ ▼ 0 Items                   │

│   (empty, can expand)       │

│                             │

│   OR if present:            │

│ ▼ 3 Items                   │

│   Product A ... 10 units    │

│   Product B ... 5 units     │

│   Product C ... 2 units     │

├─────────────────────────────┤

│ QUICK ACTIONS (60px)        │

│ [Place] [Move] [View Policy]│ ← Opens task mode

│                             │

│ OR (if occupied):           │

│ [Move] [Quarantine]         │

│ [Edit Inventory] [Remove]   │

├─────────────────────────────┤

│ LOCATION INFO (expandable)  │

│ ▼ Details                   │

│ Capacity Mode: Single       │

│ Policy: SKU Type A only     │

│ Retention: 30 days max      │

└─────────────────────────────┘

```



### Inspector Rules (STRICT)



**Always:**

- Read-only (no edit forms)

- Minimal scroll (~300-400px)

- Shows "What is here?"

- Compact, scannable



**Never:**

- Configuration UI

- Workflow logic

- Multi-step forms

- Anything that mutates state



**Updates when:**

- User clicks location in Navigator

- User navigates to adjacent location [Previous]/[Next]

- User searches and selects result

- Task mode completes and returns



---



## Part 3: Canvas (Secondary Spatial Context)



### Canvas Role



**Optional.** The system works identically with canvas hidden.



**When visible:**

- Shows floor plan of warehouse

- Highlights selected location (from Navigator)

- Provides spatial context for learning layout

- Clickable to select location (convenience, not required)

- Can be toggled off (icon or menu)



**When hidden/not loaded:**

- Navigator works exactly the same

- Inspector works exactly the same

- All tasks completable without it



**Note:** Canvas is "nice to have," not "must have."



---



## Part 4: Task Mode (Mutation Workflows)



### Task Mode Principles



- Full-screen or large overlay (dedicated workspace)

- Isolates one task at a time (Place, Move, Edit)

- Uses Navigator-style location selection (not canvas clicks)

- Replaces inspector while active

- Closes on completion or cancel

- Returns user to Navigator + Inspector



### Task: Place Container in Location



**Trigger:** Click [Place] in Inspector



**Workflow:**

```

┌───────────────────────────────────────┐

│ PLACE CONTAINER                       │ ← Full-screen overlay

│ In Location: 01-A.02.03.01 (locked)  │

├───────────────────────────────────────┤

│ SELECT CONTAINER                      │

│ [Find container] 🔍                   │ ← Search available containers

│ [Container 1] [Container 2] [Cont...] │ ← Available options

│                                       │

│ Selected: Container XYZ ✓             │

│ Type: Pallet Box, Size: 1.2×1.0      │

├───────────────────────────────────────┤

│                                       │

│ [ Cancel ]  [ Confirm & Place ]       │

└───────────────────────────────────────┘



On Confirm:

  → Task closes

  → Inspector updates to show Container XYZ

  → Navigator selection returns to original location

```



### Task: Move Container to Different Location



**Trigger:** Click [Move] in Inspector



**Workflow:**

```

┌──────────────────────────────────────┐

│ MOVE CONTAINER                       │ ← Full-screen overlay

│ Container: XYZ                       │

│ From: 01-A.02.03.01 (locked)        │

├──────────────────────────────────────┤

│ SELECT DESTINATION                   │

│                                      │

│ [Show Empty Locations]               │

│ Find: [___________] 🔍               │ ← Search destinations

│                                      │

│ LEVEL 1:                             │

│ 01-A.02.03.02  🟢  ← Click here     │

│ 01-A.02.03.04  🟢                    │

│ 01-A.02.03.06  🟢                    │

│                                      │

│ LEVEL 2:                             │

│ 01-A.03.01.01  🟢                    │

│ 01-A.03.01.03  🟢                    │

│                                      │

│ Selected Destination: 01-A.02.03.02 ✓

│                                      │

│ [ Cancel ] [ Confirm & Move ]        │

└──────────────────────────────────────┘



On Confirm:

  → Container moves

  → Task closes

  → Inspector shows NEW location details

  → Navigator list updates occupancy status

```



### Task: Edit Inventory in Container



**Trigger:** Click [Edit Inventory] in Inspector



**Workflow:**

```

┌──────────────────────────────────────┐

│ MANAGE INVENTORY                     │ ← Full-screen overlay

│ Container: XYZ (Location:...)        │

├──────────────────────────────────────┤

│ CURRENT ITEMS                        │

│ Product A      10 units   [–] [+]    │

│ Product B       5 units   [–] [+]    │

│                                      │

│ ADD ITEM                             │

│ [Select Product] [_qty_]             │

│ [+ Add Item]                         │

│                                      │

│ [ Cancel ] [ Save Changes ]          │

└──────────────────────────────────────┘



On Save:

  → Task closes

  → Inspector updates to show new inventory

```



---



## Part 5: Interaction Flows



### Flow 1: Find Empty Location & Place Container



**Goal:** Locate an empty slot and place a container there



**Steps:**

1. Navigator: Click [🟢 Empty Only] filter

   - List shows only empty locations

2. Navigator: Type "01-A.03" to search specific area

   - List narrows to match

3. Navigator: Click location "01-A.03.05"

   - Inspector updates to show empty location

4. Inspector: Click [Place]

   - Task mode opens: "Place Container"

5. Task: Select container from list

6. Task: Click [Confirm & Place]

   - Container placed

   - Task closes

   - Inspector shows new state (container now present)



**No canvas interaction required.** All navigation via Navigator + Task mode.



---



### Flow 2: Find Container & Move to Another Location



**Goal:** Locate a container and move it elsewhere



**Steps:**

1. Navigator: Search by container ID (if searchable)

   - OR: Type location ID where you last saw it

2. Navigator: List shows location with container (🔴)

3. Navigator: Click that location

   - Inspector shows container details

4. Inspector: Click [Move]

   - Task mode opens: "Move Container"

5. Task: Search destination by ID ("01-A.04")

   - List shows available slots

6. Task: Click destination location

7. Task: Click [Confirm & Move]

   - Container moved

   - Task closes

   - Inspector shows NEW location (previous now empty)



**No canvas required.** All done via Navigator + Task.



---



### Flow 3: Quick Navigation Between Nearby Locations



**Goal:** Work sequentially across nearby locations (e.g., filling a section)



**Steps:**

1. Navigator: Click location "01-A.02.01"

   - Inspector shows location detail

2. Inspector: Perform action (Place, Move, etc.)

3. Navigator: Click [Next ▶] button

   - Inspector updates to "01-A.02.02"

4. Navigator: Click [Next ▶] again

   - Inspector updates to "01-A.02.03"

5. Repeat for each location



**Sequential access.** No searching, no clicking through list. Just [Next] button.



---



### Flow 4: Return to Recently Used Location



**Goal:** Jump back to a location you were just working on



**Steps:**

1. Navigator: Scroll to [RECENT LOCATIONS] section

2. Navigator: Click "01-A.03.05" (previously visited)

   - Inspector updates instantly

3. Inspector: Continue working



**No search needed.** Recent list is always visible.



---



## Part 6: Key UX Rules (Non-Negotiable)



1. **Navigator is primary.** All navigation happens there. Canvas is optional.

2. **Inspector is read-only.** No forms, no configuration, no mutations.

3. **Task mode is focused.** One action at a time, full screen or large overlay.

4. **Search enables instant jump.** Type location ID, hit result, done.

5. **No scroll in Inspector.** Identity + State summary + Actions fit in ~300-400px.

6. **Status is color-coded.** 🟢 = Empty, 🔴 = Occupied, ⚪ = Full. Instant visual.

7. **Actions are in task mode.** Click [Place] → Task surface opens, not a modal popup.

8. **Canvas never required.** All operations work without it. It's visual support, not navigation.

9. **Recent locations are visible.** Quick return without search.

10. **Previous/Next buttons exist.** Sequential work is fast.



---



## Summary: Navigator-First System



| Component | Role | Primary? | Required? |

|-----------|------|----------|-----------|

| Navigator | Find & navigate locations | ✓ YES | ✓ YES |

| Inspector | Show location detail | No | ✓ YES |

| Canvas | Spatial context | No | ✗ NO |

| Task Mode | Perform mutations | ✓ YES (when acting) | ✓ YES |


## Mode-specific Left Surface

The left-side surface is mode-specific and must not be unified.

### Layout mode

* Left surface = Tool Palette
* Purpose: creation / placement of layout entities
* Owns: active tool selection (rack, zone, wall, etc.)
* Does not include storage navigation

### Storage mode

* Left surface = Navigator
* Purpose: navigation between storage locations
* Owns: search, occupancy filters, level switching, location list, recent locations
* Does not include creation tools

### Rule

Do not merge Tool Palette and Navigator into one shared left panel.
They serve different user intents and must remain separate by mode.


**The entire system works without a canvas. The canvas is a visual aid, not a requirement.**



