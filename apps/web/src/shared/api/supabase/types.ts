export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      cells: {
        Row: {
          address: string
          address_sort_key: string
          cell_code: string
          created_at: string
          id: string
          layout_version_id: string
          rack_face_id: string
          rack_id: string
          rack_level_id: string
          rack_section_id: string
          slot_no: number
          status: string
          updated_at: string
          x: number | null
          y: number | null
        }
        Insert: {
          address: string
          address_sort_key: string
          cell_code: string
          created_at?: string
          id?: string
          layout_version_id: string
          rack_face_id: string
          rack_id: string
          rack_level_id: string
          rack_section_id: string
          slot_no: number
          status?: string
          updated_at?: string
          x?: number | null
          y?: number | null
        }
        Update: {
          address?: string
          address_sort_key?: string
          cell_code?: string
          created_at?: string
          id?: string
          layout_version_id?: string
          rack_face_id?: string
          rack_id?: string
          rack_level_id?: string
          rack_section_id?: string
          slot_no?: number
          status?: string
          updated_at?: string
          x?: number | null
          y?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cells_layout_version_id_fkey"
            columns: ["layout_version_id"]
            isOneToOne: false
            referencedRelation: "layout_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cells_rack_face_id_fkey"
            columns: ["rack_face_id"]
            isOneToOne: false
            referencedRelation: "rack_faces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cells_rack_id_fkey"
            columns: ["rack_id"]
            isOneToOne: false
            referencedRelation: "racks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cells_rack_level_id_fkey"
            columns: ["rack_level_id"]
            isOneToOne: false
            referencedRelation: "rack_levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cells_rack_section_id_fkey"
            columns: ["rack_section_id"]
            isOneToOne: false
            referencedRelation: "rack_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      container_placements: {
        Row: {
          cell_id: string
          container_id: string
          id: string
          placed_at: string
          placed_by: string | null
          removed_at: string | null
          removed_by: string | null
          tenant_id: string
        }
        Insert: {
          cell_id: string
          container_id: string
          id?: string
          placed_at?: string
          placed_by?: string | null
          removed_at?: string | null
          removed_by?: string | null
          tenant_id: string
        }
        Update: {
          cell_id?: string
          container_id?: string
          id?: string
          placed_at?: string
          placed_by?: string | null
          removed_at?: string | null
          removed_by?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "container_placements_cell_id_fkey"
            columns: ["cell_id"]
            isOneToOne: false
            referencedRelation: "cells"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "container_placements_container_id_fkey"
            columns: ["container_id"]
            isOneToOne: false
            referencedRelation: "active_container_locations_v"
            referencedColumns: ["container_id"]
          },
          {
            foreignKeyName: "container_placements_container_id_fkey"
            columns: ["container_id"]
            isOneToOne: false
            referencedRelation: "cell_occupancy_v"
            referencedColumns: ["container_id"]
          },
          {
            foreignKeyName: "container_placements_container_id_fkey"
            columns: ["container_id"]
            isOneToOne: false
            referencedRelation: "cell_storage_snapshot_v"
            referencedColumns: ["container_id"]
          },
          {
            foreignKeyName: "container_placements_container_id_fkey"
            columns: ["container_id"]
            isOneToOne: false
            referencedRelation: "container_storage_canonical_v"
            referencedColumns: ["container_id"]
          },
          {
            foreignKeyName: "container_placements_container_id_fkey"
            columns: ["container_id"]
            isOneToOne: false
            referencedRelation: "container_storage_snapshot_v"
            referencedColumns: ["container_id"]
          },
          {
            foreignKeyName: "container_placements_container_id_fkey"
            columns: ["container_id"]
            isOneToOne: false
            referencedRelation: "containers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "container_placements_container_id_fkey"
            columns: ["container_id"]
            isOneToOne: false
            referencedRelation: "location_occupancy_v"
            referencedColumns: ["container_id"]
          },
          {
            foreignKeyName: "container_placements_container_id_fkey"
            columns: ["container_id"]
            isOneToOne: false
            referencedRelation: "location_storage_canonical_v"
            referencedColumns: ["container_id"]
          },
          {
            foreignKeyName: "container_placements_container_id_fkey"
            columns: ["container_id"]
            isOneToOne: false
            referencedRelation: "location_storage_snapshot_v"
            referencedColumns: ["container_id"]
          },
          {
            foreignKeyName: "container_placements_placed_by_fkey"
            columns: ["placed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "container_placements_removed_by_fkey"
            columns: ["removed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "container_placements_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      container_types: {
        Row: {
          code: string
          depth_mm: number | null
          description: string
          height_mm: number | null
          id: string
          max_load_g: number | null
          tare_weight_g: number | null
          width_mm: number | null
        }
        Insert: {
          code: string
          depth_mm?: number | null
          description: string
          height_mm?: number | null
          id?: string
          max_load_g?: number | null
          tare_weight_g?: number | null
          width_mm?: number | null
        }
        Update: {
          code?: string
          depth_mm?: number | null
          description?: string
          height_mm?: number | null
          id?: string
          max_load_g?: number | null
          tare_weight_g?: number | null
          width_mm?: number | null
        }
        Relationships: []
      }
      containers: {
        Row: {
          container_type_id: string
          created_at: string
          created_by: string | null
          current_location_entered_at: string | null
          current_location_id: string | null
          external_code: string | null
          id: string
          status: string
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          container_type_id: string
          created_at?: string
          created_by?: string | null
          current_location_entered_at?: string | null
          current_location_id?: string | null
          external_code?: string | null
          id?: string
          status?: string
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          container_type_id?: string
          created_at?: string
          created_by?: string | null
          current_location_entered_at?: string | null
          current_location_id?: string | null
          external_code?: string | null
          id?: string
          status?: string
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "containers_container_type_id_fkey"
            columns: ["container_type_id"]
            isOneToOne: false
            referencedRelation: "container_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "containers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "containers_current_location_id_fkey"
            columns: ["current_location_id"]
            isOneToOne: false
            referencedRelation: "active_container_locations_v"
            referencedColumns: ["location_id"]
          },
          {
            foreignKeyName: "containers_current_location_id_fkey"
            columns: ["current_location_id"]
            isOneToOne: false
            referencedRelation: "location_occupancy_v"
            referencedColumns: ["location_id"]
          },
          {
            foreignKeyName: "containers_current_location_id_fkey"
            columns: ["current_location_id"]
            isOneToOne: false
            referencedRelation: "location_storage_canonical_v"
            referencedColumns: ["location_id"]
          },
          {
            foreignKeyName: "containers_current_location_id_fkey"
            columns: ["current_location_id"]
            isOneToOne: false
            referencedRelation: "location_storage_snapshot_v"
            referencedColumns: ["location_id"]
          },
          {
            foreignKeyName: "containers_current_location_id_fkey"
            columns: ["current_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "containers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "containers_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      floors: {
        Row: {
          code: string
          created_at: string
          id: string
          name: string
          site_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          name: string
          site_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          name?: string
          site_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "floors_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_items: {
        Row: {
          container_id: string
          created_at: string
          created_by: string | null
          id: string
          item_ref: string
          product_id: string | null
          quantity: number
          tenant_id: string
          uom: string
        }
        Insert: {
          container_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          item_ref: string
          product_id?: string | null
          quantity: number
          tenant_id: string
          uom: string
        }
        Update: {
          container_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          item_ref?: string
          product_id?: string | null
          quantity?: number
          tenant_id?: string
          uom?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_items_container_id_fkey"
            columns: ["container_id"]
            isOneToOne: false
            referencedRelation: "active_container_locations_v"
            referencedColumns: ["container_id"]
          },
          {
            foreignKeyName: "inventory_items_container_id_fkey"
            columns: ["container_id"]
            isOneToOne: false
            referencedRelation: "cell_occupancy_v"
            referencedColumns: ["container_id"]
          },
          {
            foreignKeyName: "inventory_items_container_id_fkey"
            columns: ["container_id"]
            isOneToOne: false
            referencedRelation: "cell_storage_snapshot_v"
            referencedColumns: ["container_id"]
          },
          {
            foreignKeyName: "inventory_items_container_id_fkey"
            columns: ["container_id"]
            isOneToOne: false
            referencedRelation: "container_storage_canonical_v"
            referencedColumns: ["container_id"]
          },
          {
            foreignKeyName: "inventory_items_container_id_fkey"
            columns: ["container_id"]
            isOneToOne: false
            referencedRelation: "container_storage_snapshot_v"
            referencedColumns: ["container_id"]
          },
          {
            foreignKeyName: "inventory_items_container_id_fkey"
            columns: ["container_id"]
            isOneToOne: false
            referencedRelation: "containers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_items_container_id_fkey"
            columns: ["container_id"]
            isOneToOne: false
            referencedRelation: "location_occupancy_v"
            referencedColumns: ["container_id"]
          },
          {
            foreignKeyName: "inventory_items_container_id_fkey"
            columns: ["container_id"]
            isOneToOne: false
            referencedRelation: "location_storage_canonical_v"
            referencedColumns: ["container_id"]
          },
          {
            foreignKeyName: "inventory_items_container_id_fkey"
            columns: ["container_id"]
            isOneToOne: false
            referencedRelation: "location_storage_snapshot_v"
            referencedColumns: ["container_id"]
          },
          {
            foreignKeyName: "inventory_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_unit: {
        Row: {
          container_id: string
          created_at: string
          created_by: string | null
          expiry_date: string | null
          id: string
          legacy_inventory_item_id: string | null
          lot_code: string | null
          product_id: string
          quantity: number
          serial_no: string | null
          source_inventory_unit_id: string | null
          status: string
          tenant_id: string
          uom: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          container_id: string
          created_at?: string
          created_by?: string | null
          expiry_date?: string | null
          id?: string
          legacy_inventory_item_id?: string | null
          lot_code?: string | null
          product_id: string
          quantity: number
          serial_no?: string | null
          source_inventory_unit_id?: string | null
          status?: string
          tenant_id: string
          uom: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          container_id?: string
          created_at?: string
          created_by?: string | null
          expiry_date?: string | null
          id?: string
          legacy_inventory_item_id?: string | null
          lot_code?: string | null
          product_id?: string
          quantity?: number
          serial_no?: string | null
          source_inventory_unit_id?: string | null
          status?: string
          tenant_id?: string
          uom?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_unit_container_id_fkey"
            columns: ["container_id"]
            isOneToOne: false
            referencedRelation: "active_container_locations_v"
            referencedColumns: ["container_id"]
          },
          {
            foreignKeyName: "inventory_unit_container_id_fkey"
            columns: ["container_id"]
            isOneToOne: false
            referencedRelation: "cell_occupancy_v"
            referencedColumns: ["container_id"]
          },
          {
            foreignKeyName: "inventory_unit_container_id_fkey"
            columns: ["container_id"]
            isOneToOne: false
            referencedRelation: "cell_storage_snapshot_v"
            referencedColumns: ["container_id"]
          },
          {
            foreignKeyName: "inventory_unit_container_id_fkey"
            columns: ["container_id"]
            isOneToOne: false
            referencedRelation: "container_storage_canonical_v"
            referencedColumns: ["container_id"]
          },
          {
            foreignKeyName: "inventory_unit_container_id_fkey"
            columns: ["container_id"]
            isOneToOne: false
            referencedRelation: "container_storage_snapshot_v"
            referencedColumns: ["container_id"]
          },
          {
            foreignKeyName: "inventory_unit_container_id_fkey"
            columns: ["container_id"]
            isOneToOne: false
            referencedRelation: "containers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_unit_container_id_fkey"
            columns: ["container_id"]
            isOneToOne: false
            referencedRelation: "location_occupancy_v"
            referencedColumns: ["container_id"]
          },
          {
            foreignKeyName: "inventory_unit_container_id_fkey"
            columns: ["container_id"]
            isOneToOne: false
            referencedRelation: "location_storage_canonical_v"
            referencedColumns: ["container_id"]
          },
          {
            foreignKeyName: "inventory_unit_container_id_fkey"
            columns: ["container_id"]
            isOneToOne: false
            referencedRelation: "location_storage_snapshot_v"
            referencedColumns: ["container_id"]
          },
          {
            foreignKeyName: "inventory_unit_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_unit_legacy_inventory_item_id_fkey"
            columns: ["legacy_inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_unit_legacy_inventory_item_id_fkey"
            columns: ["legacy_inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items_legacy_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_unit_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_unit_source_inventory_unit_id_fkey"
            columns: ["source_inventory_unit_id"]
            isOneToOne: false
            referencedRelation: "inventory_unit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_unit_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_unit_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      layout_versions: {
        Row: {
          archived_at: string | null
          created_at: string
          created_by: string | null
          draft_version: number
          floor_id: string
          id: string
          parent_published_version_id: string | null
          published_at: string | null
          published_by: string | null
          state: string
          updated_at: string
          version_no: number
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          draft_version?: number
          floor_id: string
          id?: string
          parent_published_version_id?: string | null
          published_at?: string | null
          published_by?: string | null
          state: string
          updated_at?: string
          version_no: number
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          draft_version?: number
          floor_id?: string
          id?: string
          parent_published_version_id?: string | null
          published_at?: string | null
          published_by?: string | null
          state?: string
          updated_at?: string
          version_no?: number
        }
        Relationships: [
          {
            foreignKeyName: "layout_versions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "layout_versions_floor_id_fkey"
            columns: ["floor_id"]
            isOneToOne: false
            referencedRelation: "floors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "layout_versions_parent_published_version_id_fkey"
            columns: ["parent_published_version_id"]
            isOneToOne: false
            referencedRelation: "layout_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "layout_versions_published_by_fkey"
            columns: ["published_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          capacity_mode: string
          code: string
          created_at: string
          depth_mm: number | null
          floor_id: string
          geometry_slot_id: string | null
          height_mm: number | null
          id: string
          location_type: string
          max_weight_g: number | null
          sort_order: number | null
          status: string
          tenant_id: string
          updated_at: string
          width_mm: number | null
        }
        Insert: {
          capacity_mode: string
          code: string
          created_at?: string
          depth_mm?: number | null
          floor_id: string
          geometry_slot_id?: string | null
          height_mm?: number | null
          id?: string
          location_type: string
          max_weight_g?: number | null
          sort_order?: number | null
          status?: string
          tenant_id: string
          updated_at?: string
          width_mm?: number | null
        }
        Update: {
          capacity_mode?: string
          code?: string
          created_at?: string
          depth_mm?: number | null
          floor_id?: string
          geometry_slot_id?: string | null
          height_mm?: number | null
          id?: string
          location_type?: string
          max_weight_g?: number | null
          sort_order?: number | null
          status?: string
          tenant_id?: string
          updated_at?: string
          width_mm?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "locations_floor_id_fkey"
            columns: ["floor_id"]
            isOneToOne: false
            referencedRelation: "floors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "locations_geometry_slot_id_fkey"
            columns: ["geometry_slot_id"]
            isOneToOne: false
            referencedRelation: "cells"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "locations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      movement_events: {
        Row: {
          actor_id: string | null
          container_id: string
          created_at: string
          event_type: string
          floor_id: string
          from_cell_id: string | null
          id: string
          tenant_id: string
          to_cell_id: string | null
        }
        Insert: {
          actor_id?: string | null
          container_id: string
          created_at?: string
          event_type: string
          floor_id: string
          from_cell_id?: string | null
          id?: string
          tenant_id: string
          to_cell_id?: string | null
        }
        Update: {
          actor_id?: string | null
          container_id?: string
          created_at?: string
          event_type?: string
          floor_id?: string
          from_cell_id?: string | null
          id?: string
          tenant_id?: string
          to_cell_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "movement_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movement_events_container_id_fkey"
            columns: ["container_id"]
            isOneToOne: false
            referencedRelation: "active_container_locations_v"
            referencedColumns: ["container_id"]
          },
          {
            foreignKeyName: "movement_events_container_id_fkey"
            columns: ["container_id"]
            isOneToOne: false
            referencedRelation: "cell_occupancy_v"
            referencedColumns: ["container_id"]
          },
          {
            foreignKeyName: "movement_events_container_id_fkey"
            columns: ["container_id"]
            isOneToOne: false
            referencedRelation: "cell_storage_snapshot_v"
            referencedColumns: ["container_id"]
          },
          {
            foreignKeyName: "movement_events_container_id_fkey"
            columns: ["container_id"]
            isOneToOne: false
            referencedRelation: "container_storage_canonical_v"
            referencedColumns: ["container_id"]
          },
          {
            foreignKeyName: "movement_events_container_id_fkey"
            columns: ["container_id"]
            isOneToOne: false
            referencedRelation: "container_storage_snapshot_v"
            referencedColumns: ["container_id"]
          },
          {
            foreignKeyName: "movement_events_container_id_fkey"
            columns: ["container_id"]
            isOneToOne: false
            referencedRelation: "containers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movement_events_container_id_fkey"
            columns: ["container_id"]
            isOneToOne: false
            referencedRelation: "location_occupancy_v"
            referencedColumns: ["container_id"]
          },
          {
            foreignKeyName: "movement_events_container_id_fkey"
            columns: ["container_id"]
            isOneToOne: false
            referencedRelation: "location_storage_canonical_v"
            referencedColumns: ["container_id"]
          },
          {
            foreignKeyName: "movement_events_container_id_fkey"
            columns: ["container_id"]
            isOneToOne: false
            referencedRelation: "location_storage_snapshot_v"
            referencedColumns: ["container_id"]
          },
          {
            foreignKeyName: "movement_events_floor_id_fkey"
            columns: ["floor_id"]
            isOneToOne: false
            referencedRelation: "floors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movement_events_from_cell_id_fkey"
            columns: ["from_cell_id"]
            isOneToOne: false
            referencedRelation: "cells"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movement_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movement_events_to_cell_id_fkey"
            columns: ["to_cell_id"]
            isOneToOne: false
            referencedRelation: "cells"
            referencedColumns: ["id"]
          },
        ]
      }
      operation_events: {
        Row: {
          actor_profile_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          event_type: string
          floor_id: string | null
          id: string
          layout_version_id: string | null
          metadata: Json
          site_id: string | null
          status: string
        }
        Insert: {
          actor_profile_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          event_type: string
          floor_id?: string | null
          id?: string
          layout_version_id?: string | null
          metadata?: Json
          site_id?: string | null
          status: string
        }
        Update: {
          actor_profile_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          event_type?: string
          floor_id?: string | null
          id?: string
          layout_version_id?: string | null
          metadata?: Json
          site_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "operation_events_actor_profile_id_fkey"
            columns: ["actor_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operation_events_floor_id_fkey"
            columns: ["floor_id"]
            isOneToOne: false
            referencedRelation: "floors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operation_events_layout_version_id_fkey"
            columns: ["layout_version_id"]
            isOneToOne: false
            referencedRelation: "layout_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operation_events_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      order_lines: {
        Row: {
          id: string
          name: string
          order_id: string
          product_id: string | null
          qty_picked: number
          qty_required: number
          sku: string
          status: string
          tenant_id: string
        }
        Insert: {
          id?: string
          name: string
          order_id: string
          product_id?: string | null
          qty_picked?: number
          qty_required: number
          sku: string
          status?: string
          tenant_id: string
        }
        Update: {
          id?: string
          name?: string
          order_id?: string
          product_id?: string | null
          qty_picked?: number
          qty_required?: number
          sku?: string
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_lines_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_lines_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          closed_at: string | null
          created_at: string
          external_number: string
          id: string
          priority: number
          released_at: string | null
          status: string
          tenant_id: string
          wave_id: string | null
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          external_number: string
          id?: string
          priority?: number
          released_at?: string | null
          status?: string
          tenant_id: string
          wave_id?: string | null
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          external_number?: string
          id?: string
          priority?: number
          released_at?: string | null
          status?: string
          tenant_id?: string
          wave_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_wave_id_fkey"
            columns: ["wave_id"]
            isOneToOne: false
            referencedRelation: "waves"
            referencedColumns: ["id"]
          },
        ]
      }
      pick_steps: {
        Row: {
          created_at: string
          id: string
          item_name: string
          order_id: string | null
          order_line_id: string | null
          qty_picked: number
          qty_required: number
          sequence_no: number
          sku: string
          source_cell_id: string | null
          source_container_id: string | null
          status: string
          task_id: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_name: string
          order_id?: string | null
          order_line_id?: string | null
          qty_picked?: number
          qty_required: number
          sequence_no: number
          sku: string
          source_cell_id?: string | null
          source_container_id?: string | null
          status?: string
          task_id: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          item_name?: string
          order_id?: string | null
          order_line_id?: string | null
          qty_picked?: number
          qty_required?: number
          sequence_no?: number
          sku?: string
          source_cell_id?: string | null
          source_container_id?: string | null
          status?: string
          task_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pick_steps_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pick_steps_order_line_id_fkey"
            columns: ["order_line_id"]
            isOneToOne: false
            referencedRelation: "order_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pick_steps_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "pick_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pick_steps_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      pick_tasks: {
        Row: {
          assigned_to: string | null
          completed_at: string | null
          created_at: string
          id: string
          source_id: string
          source_type: string
          started_at: string | null
          status: string
          tenant_id: string
        }
        Insert: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          source_id: string
          source_type: string
          started_at?: string | null
          status?: string
          tenant_id: string
        }
        Update: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          source_id?: string
          source_type?: string
          started_at?: string | null
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pick_tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pick_tasks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          created_at: string
          external_product_id: string
          id: string
          image_files: Json
          image_urls: Json
          is_active: boolean
          name: string
          permalink: string | null
          sku: string | null
          source: string
          unit_weight_g: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          external_product_id: string
          id?: string
          image_files?: Json
          image_urls?: Json
          is_active?: boolean
          name: string
          permalink?: string | null
          sku?: string | null
          source: string
          unit_weight_g?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          external_product_id?: string
          id?: string
          image_files?: Json
          image_urls?: Json
          is_active?: boolean
          name?: string
          permalink?: string | null
          sku?: string | null
          source?: string
          unit_weight_g?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          role: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
          role?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
      rack_faces: {
        Row: {
          created_at: string
          enabled: boolean
          face_length: number | null
          id: string
          is_mirrored: boolean
          mirror_source_face_id: string | null
          rack_id: string
          side: string
          slot_numbering_direction: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          face_length?: number | null
          id?: string
          is_mirrored?: boolean
          mirror_source_face_id?: string | null
          rack_id: string
          side: string
          slot_numbering_direction: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          face_length?: number | null
          id?: string
          is_mirrored?: boolean
          mirror_source_face_id?: string | null
          rack_id?: string
          side?: string
          slot_numbering_direction?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rack_faces_mirror_source_face_id_fkey"
            columns: ["mirror_source_face_id"]
            isOneToOne: false
            referencedRelation: "rack_faces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rack_faces_rack_id_fkey"
            columns: ["rack_id"]
            isOneToOne: false
            referencedRelation: "racks"
            referencedColumns: ["id"]
          },
        ]
      }
      rack_levels: {
        Row: {
          created_at: string
          id: string
          ordinal: number
          rack_section_id: string
          slot_count: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          ordinal: number
          rack_section_id: string
          slot_count: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          ordinal?: number
          rack_section_id?: string
          slot_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rack_levels_rack_section_id_fkey"
            columns: ["rack_section_id"]
            isOneToOne: false
            referencedRelation: "rack_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      rack_sections: {
        Row: {
          created_at: string
          id: string
          length: number
          ordinal: number
          rack_face_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          length: number
          ordinal: number
          rack_face_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          length?: number
          ordinal?: number
          rack_face_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rack_sections_rack_face_id_fkey"
            columns: ["rack_face_id"]
            isOneToOne: false
            referencedRelation: "rack_faces"
            referencedColumns: ["id"]
          },
        ]
      }
      racks: {
        Row: {
          axis: string
          created_at: string
          depth: number
          display_code: string
          id: string
          kind: string
          layout_version_id: string
          rotation_deg: number
          state: string
          total_length: number
          updated_at: string
          x: number
          y: number
        }
        Insert: {
          axis: string
          created_at?: string
          depth: number
          display_code: string
          id?: string
          kind: string
          layout_version_id: string
          rotation_deg: number
          state?: string
          total_length: number
          updated_at?: string
          x: number
          y: number
        }
        Update: {
          axis?: string
          created_at?: string
          depth?: number
          display_code?: string
          id?: string
          kind?: string
          layout_version_id?: string
          rotation_deg?: number
          state?: string
          total_length?: number
          updated_at?: string
          x?: number
          y?: number
        }
        Relationships: [
          {
            foreignKeyName: "racks_layout_version_id_fkey"
            columns: ["layout_version_id"]
            isOneToOne: false
            referencedRelation: "layout_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      sites: {
        Row: {
          code: string
          created_at: string
          id: string
          name: string
          tenant_id: string
          timezone: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          name: string
          tenant_id: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          name?: string
          tenant_id?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sites_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string | null
          id: string
          movement_type: string
          quantity: number | null
          source_container_id: string | null
          source_inventory_unit_id: string | null
          source_location_id: string | null
          status: string
          target_container_id: string | null
          target_inventory_unit_id: string | null
          target_location_id: string | null
          tenant_id: string
          uom: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          movement_type: string
          quantity?: number | null
          source_container_id?: string | null
          source_inventory_unit_id?: string | null
          source_location_id?: string | null
          status?: string
          target_container_id?: string | null
          target_inventory_unit_id?: string | null
          target_location_id?: string | null
          tenant_id: string
          uom?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          movement_type?: string
          quantity?: number | null
          source_container_id?: string | null
          source_inventory_unit_id?: string | null
          source_location_id?: string | null
          status?: string
          target_container_id?: string | null
          target_inventory_unit_id?: string | null
          target_location_id?: string | null
          tenant_id?: string
          uom?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_source_container_id_fkey"
            columns: ["source_container_id"]
            isOneToOne: false
            referencedRelation: "active_container_locations_v"
            referencedColumns: ["container_id"]
          },
          {
            foreignKeyName: "stock_movements_source_container_id_fkey"
            columns: ["source_container_id"]
            isOneToOne: false
            referencedRelation: "cell_occupancy_v"
            referencedColumns: ["container_id"]
          },
          {
            foreignKeyName: "stock_movements_source_container_id_fkey"
            columns: ["source_container_id"]
            isOneToOne: false
            referencedRelation: "cell_storage_snapshot_v"
            referencedColumns: ["container_id"]
          },
          {
            foreignKeyName: "stock_movements_source_container_id_fkey"
            columns: ["source_container_id"]
            isOneToOne: false
            referencedRelation: "container_storage_canonical_v"
            referencedColumns: ["container_id"]
          },
          {
            foreignKeyName: "stock_movements_source_container_id_fkey"
            columns: ["source_container_id"]
            isOneToOne: false
            referencedRelation: "container_storage_snapshot_v"
            referencedColumns: ["container_id"]
          },
          {
            foreignKeyName: "stock_movements_source_container_id_fkey"
            columns: ["source_container_id"]
            isOneToOne: false
            referencedRelation: "containers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_source_container_id_fkey"
            columns: ["source_container_id"]
            isOneToOne: false
            referencedRelation: "location_occupancy_v"
            referencedColumns: ["container_id"]
          },
          {
            foreignKeyName: "stock_movements_source_container_id_fkey"
            columns: ["source_container_id"]
            isOneToOne: false
            referencedRelation: "location_storage_canonical_v"
            referencedColumns: ["container_id"]
          },
          {
            foreignKeyName: "stock_movements_source_container_id_fkey"
            columns: ["source_container_id"]
            isOneToOne: false
            referencedRelation: "location_storage_snapshot_v"
            referencedColumns: ["container_id"]
          },
          {
            foreignKeyName: "stock_movements_source_inventory_unit_id_fkey"
            columns: ["source_inventory_unit_id"]
            isOneToOne: false
            referencedRelation: "inventory_unit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_source_location_id_fkey"
            columns: ["source_location_id"]
            isOneToOne: false
            referencedRelation: "active_container_locations_v"
            referencedColumns: ["location_id"]
          },
          {
            foreignKeyName: "stock_movements_source_location_id_fkey"
            columns: ["source_location_id"]
            isOneToOne: false
            referencedRelation: "location_occupancy_v"
            referencedColumns: ["location_id"]
          },
          {
            foreignKeyName: "stock_movements_source_location_id_fkey"
            columns: ["source_location_id"]
            isOneToOne: false
            referencedRelation: "location_storage_canonical_v"
            referencedColumns: ["location_id"]
          },
          {
            foreignKeyName: "stock_movements_source_location_id_fkey"
            columns: ["source_location_id"]
            isOneToOne: false
            referencedRelation: "location_storage_snapshot_v"
            referencedColumns: ["location_id"]
          },
          {
            foreignKeyName: "stock_movements_source_location_id_fkey"
            columns: ["source_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_target_container_id_fkey"
            columns: ["target_container_id"]
            isOneToOne: false
            referencedRelation: "active_container_locations_v"
            referencedColumns: ["container_id"]
          },
          {
            foreignKeyName: "stock_movements_target_container_id_fkey"
            columns: ["target_container_id"]
            isOneToOne: false
            referencedRelation: "cell_occupancy_v"
            referencedColumns: ["container_id"]
          },
          {
            foreignKeyName: "stock_movements_target_container_id_fkey"
            columns: ["target_container_id"]
            isOneToOne: false
            referencedRelation: "cell_storage_snapshot_v"
            referencedColumns: ["container_id"]
          },
          {
            foreignKeyName: "stock_movements_target_container_id_fkey"
            columns: ["target_container_id"]
            isOneToOne: false
            referencedRelation: "container_storage_canonical_v"
            referencedColumns: ["container_id"]
          },
          {
            foreignKeyName: "stock_movements_target_container_id_fkey"
            columns: ["target_container_id"]
            isOneToOne: false
            referencedRelation: "container_storage_snapshot_v"
            referencedColumns: ["container_id"]
          },
          {
            foreignKeyName: "stock_movements_target_container_id_fkey"
            columns: ["target_container_id"]
            isOneToOne: false
            referencedRelation: "containers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_target_container_id_fkey"
            columns: ["target_container_id"]
            isOneToOne: false
            referencedRelation: "location_occupancy_v"
            referencedColumns: ["container_id"]
          },
          {
            foreignKeyName: "stock_movements_target_container_id_fkey"
            columns: ["target_container_id"]
            isOneToOne: false
            referencedRelation: "location_storage_canonical_v"
            referencedColumns: ["container_id"]
          },
          {
            foreignKeyName: "stock_movements_target_container_id_fkey"
            columns: ["target_container_id"]
            isOneToOne: false
            referencedRelation: "location_storage_snapshot_v"
            referencedColumns: ["container_id"]
          },
          {
            foreignKeyName: "stock_movements_target_inventory_unit_id_fkey"
            columns: ["target_inventory_unit_id"]
            isOneToOne: false
            referencedRelation: "inventory_unit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_target_location_id_fkey"
            columns: ["target_location_id"]
            isOneToOne: false
            referencedRelation: "active_container_locations_v"
            referencedColumns: ["location_id"]
          },
          {
            foreignKeyName: "stock_movements_target_location_id_fkey"
            columns: ["target_location_id"]
            isOneToOne: false
            referencedRelation: "location_occupancy_v"
            referencedColumns: ["location_id"]
          },
          {
            foreignKeyName: "stock_movements_target_location_id_fkey"
            columns: ["target_location_id"]
            isOneToOne: false
            referencedRelation: "location_storage_canonical_v"
            referencedColumns: ["location_id"]
          },
          {
            foreignKeyName: "stock_movements_target_location_id_fkey"
            columns: ["target_location_id"]
            isOneToOne: false
            referencedRelation: "location_storage_snapshot_v"
            referencedColumns: ["location_id"]
          },
          {
            foreignKeyName: "stock_movements_target_location_id_fkey"
            columns: ["target_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_members: {
        Row: {
          created_at: string
          profile_id: string
          role: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          profile_id: string
          role: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          profile_id?: string
          role?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_members_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_members_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          code: string
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      waves: {
        Row: {
          closed_at: string | null
          created_at: string
          id: string
          name: string
          released_at: string | null
          status: string
          tenant_id: string
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          id?: string
          name: string
          released_at?: string | null
          status?: string
          tenant_id: string
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          id?: string
          name?: string
          released_at?: string | null
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "waves_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      active_container_locations_v: {
        Row: {
          capacity_mode: string | null
          cell_id: string | null
          container_id: string | null
          container_status: string | null
          container_type: string | null
          external_code: string | null
          floor_id: string | null
          location_code: string | null
          location_id: string | null
          location_status: string | null
          location_type: string | null
          placed_at: string | null
          tenant_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "containers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "locations_floor_id_fkey"
            columns: ["floor_id"]
            isOneToOne: false
            referencedRelation: "floors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "locations_geometry_slot_id_fkey"
            columns: ["cell_id"]
            isOneToOne: false
            referencedRelation: "cells"
            referencedColumns: ["id"]
          },
        ]
      }
      cell_occupancy_v: {
        Row: {
          cell_id: string | null
          container_id: string | null
          container_status: string | null
          container_type: string | null
          external_code: string | null
          placed_at: string | null
          tenant_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "containers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "locations_geometry_slot_id_fkey"
            columns: ["cell_id"]
            isOneToOne: false
            referencedRelation: "cells"
            referencedColumns: ["id"]
          },
        ]
      }
      cell_storage_snapshot_v: {
        Row: {
          cell_id: string | null
          container_id: string | null
          container_status: string | null
          container_type: string | null
          external_code: string | null
          item_ref: string | null
          placed_at: string | null
          product_id: string | null
          quantity: number | null
          tenant_id: string | null
          uom: string | null
        }
        Relationships: [
          {
            foreignKeyName: "containers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "locations_geometry_slot_id_fkey"
            columns: ["cell_id"]
            isOneToOne: false
            referencedRelation: "cells"
            referencedColumns: ["id"]
          },
        ]
      }
      container_storage_canonical_v: {
        Row: {
          container_id: string | null
          container_status: string | null
          container_type: string | null
          expiry_date: string | null
          external_code: string | null
          inventory_status: string | null
          item_ref: string | null
          lot_code: string | null
          product_id: string | null
          quantity: number | null
          serial_no: string | null
          tenant_id: string | null
          uom: string | null
        }
        Relationships: [
          {
            foreignKeyName: "containers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_unit_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      container_storage_snapshot_v: {
        Row: {
          container_id: string | null
          container_status: string | null
          container_type: string | null
          external_code: string | null
          item_ref: string | null
          product_id: string | null
          quantity: number | null
          tenant_id: string | null
          uom: string | null
        }
        Relationships: [
          {
            foreignKeyName: "containers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_item_compat_v: {
        Row: {
          container_id: string | null
          created_at: string | null
          created_by: string | null
          id: string | null
          item_ref: string | null
          product_id: string | null
          quantity: number | null
          tenant_id: string | null
          uom: string | null
        }
        Relationships: []
      }
      inventory_items_legacy_v: {
        Row: {
          container_id: string | null
          created_at: string | null
          created_by: string | null
          id: string | null
          item_ref: string | null
          product_id: string | null
          quantity: number | null
          tenant_id: string | null
          uom: string | null
        }
        Insert: {
          container_id?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string | null
          item_ref?: string | null
          product_id?: string | null
          quantity?: number | null
          tenant_id?: string | null
          uom?: string | null
        }
        Update: {
          container_id?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string | null
          item_ref?: string | null
          product_id?: string | null
          quantity?: number | null
          tenant_id?: string | null
          uom?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_items_container_id_fkey"
            columns: ["container_id"]
            isOneToOne: false
            referencedRelation: "active_container_locations_v"
            referencedColumns: ["container_id"]
          },
          {
            foreignKeyName: "inventory_items_container_id_fkey"
            columns: ["container_id"]
            isOneToOne: false
            referencedRelation: "cell_occupancy_v"
            referencedColumns: ["container_id"]
          },
          {
            foreignKeyName: "inventory_items_container_id_fkey"
            columns: ["container_id"]
            isOneToOne: false
            referencedRelation: "cell_storage_snapshot_v"
            referencedColumns: ["container_id"]
          },
          {
            foreignKeyName: "inventory_items_container_id_fkey"
            columns: ["container_id"]
            isOneToOne: false
            referencedRelation: "container_storage_canonical_v"
            referencedColumns: ["container_id"]
          },
          {
            foreignKeyName: "inventory_items_container_id_fkey"
            columns: ["container_id"]
            isOneToOne: false
            referencedRelation: "container_storage_snapshot_v"
            referencedColumns: ["container_id"]
          },
          {
            foreignKeyName: "inventory_items_container_id_fkey"
            columns: ["container_id"]
            isOneToOne: false
            referencedRelation: "containers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_items_container_id_fkey"
            columns: ["container_id"]
            isOneToOne: false
            referencedRelation: "location_occupancy_v"
            referencedColumns: ["container_id"]
          },
          {
            foreignKeyName: "inventory_items_container_id_fkey"
            columns: ["container_id"]
            isOneToOne: false
            referencedRelation: "location_storage_canonical_v"
            referencedColumns: ["container_id"]
          },
          {
            foreignKeyName: "inventory_items_container_id_fkey"
            columns: ["container_id"]
            isOneToOne: false
            referencedRelation: "location_storage_snapshot_v"
            referencedColumns: ["container_id"]
          },
          {
            foreignKeyName: "inventory_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      location_occupancy_v: {
        Row: {
          capacity_mode: string | null
          cell_id: string | null
          container_id: string | null
          container_status: string | null
          container_type: string | null
          external_code: string | null
          floor_id: string | null
          location_code: string | null
          location_id: string | null
          location_status: string | null
          location_type: string | null
          placed_at: string | null
          tenant_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "containers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "locations_floor_id_fkey"
            columns: ["floor_id"]
            isOneToOne: false
            referencedRelation: "floors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "locations_geometry_slot_id_fkey"
            columns: ["cell_id"]
            isOneToOne: false
            referencedRelation: "cells"
            referencedColumns: ["id"]
          },
        ]
      }
      location_storage_canonical_v: {
        Row: {
          capacity_mode: string | null
          cell_id: string | null
          container_id: string | null
          container_status: string | null
          container_type: string | null
          expiry_date: string | null
          external_code: string | null
          floor_id: string | null
          inventory_status: string | null
          item_ref: string | null
          location_code: string | null
          location_id: string | null
          location_status: string | null
          location_type: string | null
          lot_code: string | null
          placed_at: string | null
          product_id: string | null
          quantity: number | null
          serial_no: string | null
          tenant_id: string | null
          uom: string | null
        }
        Relationships: [
          {
            foreignKeyName: "containers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_unit_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "locations_floor_id_fkey"
            columns: ["floor_id"]
            isOneToOne: false
            referencedRelation: "floors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "locations_geometry_slot_id_fkey"
            columns: ["cell_id"]
            isOneToOne: false
            referencedRelation: "cells"
            referencedColumns: ["id"]
          },
        ]
      }
      location_storage_snapshot_v: {
        Row: {
          capacity_mode: string | null
          cell_id: string | null
          container_id: string | null
          container_status: string | null
          container_type: string | null
          external_code: string | null
          floor_id: string | null
          item_ref: string | null
          location_code: string | null
          location_id: string | null
          location_status: string | null
          location_type: string | null
          placed_at: string | null
          product_id: string | null
          quantity: number | null
          tenant_id: string | null
          uom: string | null
        }
        Relationships: [
          {
            foreignKeyName: "containers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "locations_floor_id_fkey"
            columns: ["floor_id"]
            isOneToOne: false
            referencedRelation: "floors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "locations_geometry_slot_id_fkey"
            columns: ["cell_id"]
            isOneToOne: false
            referencedRelation: "cells"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      backfill_container_current_locations: { Args: never; Returns: number }
      backfill_inventory_unit_from_inventory_items: {
        Args: never
        Returns: number
      }
      backfill_locations_from_published_cells: { Args: never; Returns: number }
      build_cell_address: {
        Args: {
          face_side: string
          level_ordinal: number
          rack_display_code: string
          section_ordinal: number
          slot_no: number
        }
        Returns: string
      }
      build_cell_code: {
        Args: {
          face_side: string
          level_ordinal: number
          rack_uuid: string
          section_ordinal: number
          slot_no: number
        }
        Returns: string
      }
      can_access_cell: { Args: { cell_uuid: string }; Returns: boolean }
      can_access_container: {
        Args: { container_uuid: string }
        Returns: boolean
      }
      can_access_container_placement: {
        Args: { container_placement_uuid: string }
        Returns: boolean
      }
      can_access_floor: { Args: { floor_uuid: string }; Returns: boolean }
      can_access_inventory_item: {
        Args: { inventory_item_uuid: string }
        Returns: boolean
      }
      can_access_inventory_unit: {
        Args: { inventory_unit_uuid: string }
        Returns: boolean
      }
      can_access_layout_version: {
        Args: { layout_version_uuid: string }
        Returns: boolean
      }
      can_access_location: { Args: { location_uuid: string }; Returns: boolean }
      can_access_order: { Args: { order_uuid: string }; Returns: boolean }
      can_access_pick_task: {
        Args: { pick_task_uuid: string }
        Returns: boolean
      }
      can_access_rack: { Args: { rack_uuid: string }; Returns: boolean }
      can_access_site: { Args: { site_uuid: string }; Returns: boolean }
      can_access_stock_movement: {
        Args: { stock_movement_uuid: string }
        Returns: boolean
      }
      can_access_tenant: { Args: { tenant_uuid: string }; Returns: boolean }
      can_access_wave: { Args: { wave_uuid: string }; Returns: boolean }
      can_manage_container: {
        Args: { container_uuid: string }
        Returns: boolean
      }
      can_manage_container_placement: {
        Args: { container_placement_uuid: string }
        Returns: boolean
      }
      can_manage_floor: { Args: { floor_uuid: string }; Returns: boolean }
      can_manage_inventory_item: {
        Args: { inventory_item_uuid: string }
        Returns: boolean
      }
      can_manage_inventory_unit: {
        Args: { inventory_unit_uuid: string }
        Returns: boolean
      }
      can_manage_layout_version: {
        Args: { layout_version_uuid: string }
        Returns: boolean
      }
      can_manage_location: { Args: { location_uuid: string }; Returns: boolean }
      can_manage_order: { Args: { order_uuid: string }; Returns: boolean }
      can_manage_pick_task: {
        Args: { pick_task_uuid: string }
        Returns: boolean
      }
      can_manage_rack: { Args: { rack_uuid: string }; Returns: boolean }
      can_manage_site: { Args: { site_uuid: string }; Returns: boolean }
      can_manage_stock_movement: {
        Args: { stock_movement_uuid: string }
        Returns: boolean
      }
      can_manage_tenant: { Args: { tenant_uuid: string }; Returns: boolean }
      can_manage_wave: { Args: { wave_uuid: string }; Returns: boolean }
      can_publish_floor: { Args: { floor_uuid: string }; Returns: boolean }
      create_layout_draft: {
        Args: { actor_uuid?: string; floor_uuid: string }
        Returns: string
      }
      current_profile_id: { Args: never; Returns: string }
      get_container_gross_weight: {
        Args: { container_uuid: string }
        Returns: number
      }
      get_layout_bundle: {
        Args: { layout_version_uuid: string }
        Returns: Json
      }
      insert_movement_event: {
        Args: {
          actor_uuid: string
          container_uuid: string
          created_at_utc?: string
          floor_uuid: string
          from_cell_uuid: string
          movement_event_type: string
          tenant_uuid: string
          to_cell_uuid: string
        }
        Returns: string
      }
      insert_stock_movement: {
        Args: {
          actor_uuid?: string
          completed_at_utc?: string
          created_at_utc?: string
          movement_status?: string
          movement_type_text: string
          quantity_value?: number
          source_container_uuid?: string
          source_inventory_unit_uuid?: string
          source_location_uuid?: string
          target_container_uuid?: string
          target_inventory_unit_uuid?: string
          target_location_uuid?: string
          tenant_uuid: string
          uom_value?: string
        }
        Returns: string
      }
      inventory_item_ref_product_uuid: {
        Args: { item_ref: string }
        Returns: string
      }
      is_platform_admin: { Args: never; Returns: boolean }
      layout_version_cell_counts: {
        Args: { layout_version_uuid: string }
        Returns: {
          cell_count: number
          rack_count: number
        }[]
      }
      location_can_accept_container: {
        Args: { container_uuid: string; target_location_uuid: string }
        Returns: Json
      }
      move_container_canonical: {
        Args: {
          actor_uuid?: string
          container_uuid: string
          target_location_uuid: string
        }
        Returns: Json
      }
      pad_2: { Args: { input_value: string }; Returns: string }
      pad_4: { Args: { input_value: string }; Returns: string }
      pick_partial_inventory_unit: {
        Args: {
          actor_uuid?: string
          pick_container_uuid: string
          quantity: number
          source_inventory_unit_uuid: string
        }
        Returns: Json
      }
      place_container: {
        Args: { actor_uuid?: string; cell_uuid: string; container_uuid: string }
        Returns: Json
      }
      place_container_at_location: {
        Args: {
          actor_uuid?: string
          container_uuid: string
          location_uuid: string
        }
        Returns: Json
      }
      publish_layout_version: {
        Args: { actor_uuid?: string; layout_version_uuid: string }
        Returns: Json
      }
      regenerate_layout_cells: {
        Args: { layout_version_uuid: string }
        Returns: number
      }
      release_order: { Args: { order_uuid: string }; Returns: string }
      release_wave: { Args: { wave_uuid: string }; Returns: number }
      remove_container: {
        Args: { actor_uuid?: string; container_uuid: string }
        Returns: Json
      }
      resolve_active_location_for_container: {
        Args: { container_uuid: string }
        Returns: {
          cell_id: string
          floor_id: string
          location_id: string
          tenant_id: string
        }[]
      }
      save_layout_draft: {
        Args: { actor_uuid?: string; layout_payload: Json }
        Returns: Json
      }
      split_inventory_unit: {
        Args: {
          actor_uuid?: string
          source_inventory_unit_uuid: string
          split_quantity: number
          target_container_uuid: string
        }
        Returns: Json
      }
      sync_container_placement_projection: {
        Args: { actor_uuid?: string; container_uuid: string }
        Returns: undefined
      }
      transfer_inventory_unit: {
        Args: {
          actor_uuid?: string
          quantity: number
          source_inventory_unit_uuid: string
          target_container_uuid: string
        }
        Returns: Json
      }
      validate_layout_payload: {
        Args: { layout_payload: Json }
        Returns: undefined
      }
      validate_layout_version: {
        Args: { layout_version_uuid: string }
        Returns: Json
      }
      write_layout_event: {
        Args: {
          p_actor_profile_id?: string
          p_entity_id: string
          p_entity_type: string
          p_event_type: string
          p_layout_version_id: string
          p_metadata?: Json
          p_status: string
        }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const

