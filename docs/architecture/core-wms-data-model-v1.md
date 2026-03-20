# Core WMS Data Model v1

## Status

Canonical target model for the storage core.

Snapshot date: `2026-03-15`

This document defines the minimal execution model the system should converge to.
It is not a claim that every table, endpoint, and workflow below already exists in the repo.

Current implementation note:

- the repo already has strong spatial truth and a draft/publish lifecycle
- the repo already has container placement and inventory content concepts
- Stage 1 has introduced first-class `locations` and backfilled published rack slots into executable location rows
- Stage 2 now routes storage reads through location-backed compatibility views while placement writes still remain cell-centric
- Stage 3 now introduces canonical `inventory_unit` stock rows while `inventory_items` remains a compatibility surface for legacy reads and migration safety
- Stage 4 now adds canonical split/merge semantics on `inventory_unit` plus `stock_movements` for new execution flows, while physical placement persistence still bridges through geometry-backed placement rows
- Stage 5 now makes `containers.current_location_id` the canonical current-state truth, rebases current-state reads onto location-native state, and demotes `container_placements` to a geometry compatibility projection
- Stage 6 now exposes public location-native execution contracts, including explicit container current-location reads, while old cell-centric routes remain deprecated compatibility facades
- this document defines the target v1 storage core that must become the stable reference for future schema, API, and UX work

## Goal

Build a minimal but stable WMS core that:

- separates geometry from operational storage
- uses a container-first execution model
- stores inventory inside containers
- supports addressing, moves, putaway, pick, and ship
- does not break when the layout changes

## v1 Boundary

Included in v1:

- `Location`
- `ContainerType`
- `Container`
- `Product`
- `InventoryUnit`
- `Movement`

Out of scope for this document:

- advanced wave logic
- replenishment optimization rules
- exception-control submodules
- full analytics/event sourcing layer

## Core Principle

The system must distinguish two different truths:

### Spatial truth

Answers:

- what storage geometry exists
- which executable slots can exist

Core concepts:

- `Site`
- `Floor`
- `LayoutVersion`
- `Rack`
- `Cell` or `GeometrySlot`

### Execution truth

Answers:

- what physically exists in storage now
- what is located where now
- what moved from where to where

Core concepts:

- `Location`
- `ContainerType`
- `Container`
- `InventoryUnit`
- `Movement`

Rule:

- slot is not execution truth
- location is not geometry
- inventory does not live directly in a slot

## Domain Model

### 1. `Location`

Operationally addressable storage point.

Meaning:

- `Location` is not geometry
- `Location` is the executable storage unit used by inventory and movement workflows

```ts
type Location = {
  id: string
  warehouseId: string
  code: string
  locationType: 'rack_slot' | 'floor' | 'staging' | 'dock' | 'buffer'
  geometrySlotId: string | null
  capacityMode: 'single_container' | 'multi_container'
  status: 'active' | 'disabled' | 'draft'
  widthMm: number | null
  heightMm: number | null
  depthMm: number | null
  maxWeightG: number | null
  sortOrder: number | null
  createdAt: string
  updatedAt: string
}
```

Rules:

- `code` is unique within a warehouse
- `geometrySlotId` may be `null` for non-rack locations
- `rack_slot` is usually `single_container`
- `floor`, `staging`, and `buffer` are usually `multi_container`

### 2. `ContainerType`

Reference catalog of physical handling-unit formats.

```ts
type ContainerType = {
  id: string
  code: string
  name: string
  widthMm: number | null
  heightMm: number | null
  depthMm: number | null
  tareWeightG: number | null
  maxLoadG: number | null
  stackable: boolean
  createdAt: string
  updatedAt: string
}
```

Examples:

- `pallet_eur`
- `tote_l`
- `carton_m`
- `roll_cage`

### 3. `Container`

Concrete physical handling unit.

Meaning:

- the container moves
- inventory is its content

```ts
type Container = {
  id: string
  containerTypeId: string
  code: string
  currentLocationId: string | null
  parentContainerId: string | null
  status: 'active' | 'empty' | 'in_transit' | 'archived'
  createdAt: string
  updatedAt: string
}
```

Rules:

- `code` is globally unique
- `parentContainerId` supports nesting, such as a carton on a pallet
- `currentLocationId` is the current physical location and the canonical answer to current-state execution

### 4. `Product`

Canonical SKU master.

```ts
type Product = {
  id: string
  sku: string
  name: string
  barcode: string | null
  unitWeightG: number | null
  widthMm: number | null
  heightMm: number | null
  depthMm: number | null
  trackingMode: 'none' | 'lot' | 'serial' | 'expiry'
  createdAt: string
  updatedAt: string
}
```

Rules:

- `sku` is unique
- `trackingMode` defines future lot, serial, or expiry constraints

### 5. `InventoryUnit`

Accounted stock unit inside a container.

Meaning:

- not the abstract product itself
- not `SKU -> Location`
- concrete stock content belonging to a container

```ts
type InventoryUnit = {
  id: string
  productId: string
  containerId: string
  quantity: number
  uom: string
  lotCode: string | null
  serialNo: string | null
  expiryDate: string | null
  status: 'available' | 'reserved' | 'damaged' | 'hold'
  createdAt: string
  updatedAt: string
  sourceInventoryUnitId: string | null
}
```

Rules:

- inventory always belongs to a container
- location is derived through `container.currentLocationId`
- one container may hold many inventory units
- split never reduces the source row to zero; full-row relocation is not modeled as split in Stage 4
- merge is allowed only for exact tracking identity in the same container
- serial-tracked units cannot be split and are not merge candidates

### 6. `Movement`

Operational movement journal.

```ts
type Movement = {
  id: string
  movementType: 'receive' | 'putaway' | 'pick' | 'replenishment' | 'transfer' | 'ship' | 'adjust'
  containerId: string | null
  productId: string | null
  fromLocationId: string | null
  toLocationId: string | null
  quantity: number | null
  uom: string | null
  status: 'pending' | 'done' | 'cancelled'
  createdAt: string
  completedAt: string | null
}
```

Meaning:

- supports whole-container movement
- supports partial product movement

Current implementation note:

- Stage 4 writes canonical execution history to `stock_movements`
- current canonical rows distinguish `move_container`, `split_stock`, `transfer_stock`, and `pick_partial`
- the current Stage 4 table intentionally does not duplicate `productId`; product identity is derived through referenced `inventory_unit` rows
- Stage 5 now updates `containers.current_location_id` directly during canonical moves and uses `container_placements` only as a rack/canvas compatibility projection
- Stage 6 now exposes public location-native execution endpoints and treats older cell-centric execution APIs as compatibility-only surfaces

## ERD Logic

Canonical relationships:

- `Location 1 -> N Container`
- `ContainerType 1 -> N Container`
- `Container 1 -> N InventoryUnit`
- `Product 1 -> N InventoryUnit`
- `Location 1 -> N Movement (from)`
- `Location 1 -> N Movement (to)`
- `Container 1 -> N Movement`
- `Product 1 -> N Movement`
- `Container 1 -> N Container (parent-child)`

Geometry linkage:

- `GeometrySlot 1 -> 0..1 Location`

For v1, `1:1` is the recommended default for executable rack slots.

## Domain Invariants

These invariants are the hard line. If they are not documented, the model will drift.

### I1. Inventory does not exist without a container

- `inventory_unit.container_id` is mandatory

### I2. Container lives in a location

- active container must have `current_location_id`
- the only normal exception is short-lived `in_transit`
- current-state reads must derive from `current_location_id`, not from placement history

### I3. Slot and location are not the same thing

- slot is a layout object
- location is an execution object

### I4. Single-container location

- if `capacity_mode = 'single_container'`, it cannot hold more than one active container

### I5. Disabled location

- new containers cannot be placed into `disabled` locations

### I5a. Non-active locations are never canonical write targets

- `draft` and `disabled` locations are rejected by canonical execution writes

### I6. Weight fit

- combined container and content weight must not exceed the location limit

### I7. Container fit

- container dimensions must fit inside the target location

### I7a. Unknown required fit data is treated as a hard failure

- if a location enforces a dimension or weight limit and required data is missing, canonical move rejects

### I8. Archived container

- archived containers cannot move

### I9. Split and merge semantics are explicit

- partial-stock transfer is modeled through controlled split semantics
- exact-match merge is deterministic, not accidental duplicate-row cleanup
- whole-container move and partial-stock move are separate execution operations

## v1 Behavioral Scenarios

### 1. Receive container

Scenario:

- inbound pallet or tote arrives

Actions:

- create `Container`
- create `InventoryUnit`
- place the container into an inbound location such as `RECV-01`
- write `Movement(type='receive')`

### 2. Putaway

Scenario:

- move the container from receiving to a storage location

Actions:

- validate fit
- update `container.current_location_id`
- write `Movement(type='putaway')`

### 3. Move container

Scenario:

- transfer a pallet or tote between locations

Actions:

- validate destination
- change `current_location_id`
- sync rack placement projection only when the target location is geometry-backed
- write `Movement(type='transfer')`

### 4. Partial pick

Scenario:

- pick part of the stock from a source container

Actions:

- find the relevant `InventoryUnit`
- reduce quantity in the source container
- create a destination container such as a pick tote if needed
- create a new `InventoryUnit` in the destination container
- write `Movement(type='pick')`

Critical note:

- this scenario is exactly why the model must use `InventoryUnit`, not a flat `Product -> Location` shortcut

### 5. Ship

Scenario:

- a whole container or pick container leaves the warehouse

Actions:

- move the container to `SHIP-01`
- write `Movement(type='ship')`
- archive or mark the container as shipped if needed

## Minimal API v1

Only the minimum useful surface should exist.

### Locations

- `GET /locations`
- `GET /locations/:id`

### Containers

- `POST /containers`
- `GET /containers/:id`
- `POST /containers/:id/move`

### Inventory

- `POST /inventory/receive`
- `POST /inventory/pick`
- `GET /inventory/by-location/:locationId`
- `GET /inventory/by-container/:containerId`

### Movements

- `GET /movements`
- `GET /movements/:id`

## SQL Skeleton v1

This is the minimum DDL skeleton for the target model.

```sql
create table location (
  id uuid primary key,
  warehouse_id uuid not null,
  code text not null,
  location_type text not null check (location_type in ('rack_slot', 'floor', 'staging', 'dock', 'buffer')),
  geometry_slot_id uuid null,
  capacity_mode text not null check (capacity_mode in ('single_container', 'multi_container')),
  status text not null default 'active' check (status in ('active', 'disabled', 'draft')),
  width_mm int null,
  height_mm int null,
  depth_mm int null,
  max_weight_g bigint null,
  sort_order int null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (warehouse_id, code)
);

create table container_type (
  id uuid primary key,
  code text not null unique,
  name text not null,
  width_mm int null,
  height_mm int null,
  depth_mm int null,
  tare_weight_g bigint null,
  max_load_g bigint null,
  stackable boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table container (
  id uuid primary key,
  container_type_id uuid not null references container_type(id),
  code text not null unique,
  current_location_id uuid null references location(id),
  parent_container_id uuid null references container(id),
  status text not null default 'active' check (status in ('active', 'empty', 'in_transit', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table product (
  id uuid primary key,
  sku text not null unique,
  name text not null,
  barcode text null,
  unit_weight_g bigint null,
  width_mm int null,
  height_mm int null,
  depth_mm int null,
  tracking_mode text not null default 'none' check (tracking_mode in ('none', 'lot', 'serial', 'expiry')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table inventory_unit (
  id uuid primary key,
  product_id uuid not null references product(id),
  container_id uuid not null references container(id),
  quantity numeric not null check (quantity >= 0),
  uom text not null,
  lot_code text null,
  serial_no text null,
  expiry_date date null,
  status text not null default 'available' check (status in ('available', 'reserved', 'damaged', 'hold')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table movement (
  id uuid primary key,
  movement_type text not null check (movement_type in ('receive', 'putaway', 'pick', 'replenishment', 'transfer', 'ship', 'adjust')),
  container_id uuid null references container(id),
  product_id uuid null references product(id),
  from_location_id uuid null references location(id),
  to_location_id uuid null references location(id),
  quantity numeric null check (quantity is null or quantity >= 0),
  uom text null,
  status text not null default 'pending' check (status in ('pending', 'done', 'cancelled')),
  created_at timestamptz not null default now(),
  completed_at timestamptz null
);
```

## Recommended Optional Read Models

### Inventory by location

```sql
create view inventory_by_location_v as
select
  c.current_location_id as location_id,
  iu.product_id,
  iu.container_id,
  iu.quantity,
  iu.uom,
  iu.status
from inventory_unit iu
join container c on c.id = iu.container_id
where c.current_location_id is not null;
```

### Container gross weight

Recommended as an early derived read for fit validation.

## Alignment with Existing Repo Documents

This document refines and tightens several existing ideas already present in the repo:

- spatial truth remains owned by published layout
- storage truth remains container-first
- `SKU -> Cell` remains rejected
- placement UI must eventually operate on executable `Location`, not directly on raw geometry

The practical shift is:

- from `Cell -> ContainerPlacement -> Container -> InventoryItem`
- to `GeometrySlot -> Location -> Container -> InventoryUnit`

Where:

- `GeometrySlot` answers spatial existence
- `Location` answers operational executability
- `Container` answers handling-unit state
- `InventoryUnit` answers stock content
- `Movement` answers operational transition history

Current public API note:

- new public execution contracts should now start from `location`
- explicit current container location is readable through a container-location contract
- `cell` remains geometry vocabulary and compatibility input only

## Documentation Rule

Any future schema, API, or UX decision that touches storage semantics must be checked against this document.

If a decision violates this model, it should be treated as one of the following:

- the design is wrong
- the v1 boundary changed and needs a new ADR
- the document itself must be explicitly superseded
