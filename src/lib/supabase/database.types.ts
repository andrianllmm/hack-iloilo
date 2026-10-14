
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "bookings": {
                  Row: {
                    "booked_by_phone": string,"channel": Database["public"]['Enums']["booking_channel"],"client_id": string,"created_at": string,"est_kg": number,"facility_id": string,"flex_days": number,"id": string,"preferred_date": string,"ref": string,"scheduled_date": string,"service": Database["public"]['Enums']["service"],"status": Database["public"]['Enums']["booking_status"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "booked_by_phone": string,"channel": Database["public"]['Enums']["booking_channel"],"client_id": string,"created_at"?: string,"est_kg": number,"facility_id": string,"flex_days"?: number,"id"?: string,"preferred_date": string,"ref": string,"scheduled_date": string,"service": Database["public"]['Enums']["service"],"status"?: Database["public"]['Enums']["booking_status"],"updated_at"?: string
                  }
                  Update: {
                    "booked_by_phone"?: string,"channel"?: Database["public"]['Enums']["booking_channel"],"client_id"?: string,"created_at"?: string,"est_kg"?: number,"facility_id"?: string,"flex_days"?: number,"id"?: string,"preferred_date"?: string,"ref"?: string,"scheduled_date"?: string,"service"?: Database["public"]['Enums']["service"],"status"?: Database["public"]['Enums']["booking_status"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "bookings_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bookings_facility_id_fkey"
      columns: ["facility_id"]
isOneToOne: false
      referencedRelation: "facilities"
      referencedColumns: ["id"]
    }
                  ]
                },"clients": {
                  Row: {
                    "coop_id": string | null,"created_at": string,"id": string,"kind": Database["public"]['Enums']["client_kind"],"municipality_id": string | null,"name": string,"phone": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "coop_id"?: string | null,"created_at"?: string,"id"?: string,"kind": Database["public"]['Enums']["client_kind"],"municipality_id"?: string | null,"name": string,"phone": string,"updated_at"?: string
                  }
                  Update: {
                    "coop_id"?: string | null,"created_at"?: string,"id"?: string,"kind"?: Database["public"]['Enums']["client_kind"],"municipality_id"?: string | null,"name"?: string,"phone"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "clients_coop_id_fkey"
      columns: ["coop_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "clients_municipality_id_fkey"
      columns: ["municipality_id"]
isOneToOne: false
      referencedRelation: "municipalities"
      referencedColumns: ["id"]
    }
                  ]
                },"facilities": {
                  Row: {
                    "base_load_kw": number,"created_at": string,"dry_yield_pct": number,"id": string,"idle_threshold_pct": number,"labor_minor_per_hour": number,"name": string,"notify_ahead_n": number,"operating_hours_per_day": number,"storage_capacity_kg": number,"tariff_minor_per_kwh": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "base_load_kw"?: number,"created_at"?: string,"dry_yield_pct"?: number,"id"?: string,"idle_threshold_pct"?: number,"labor_minor_per_hour"?: number,"name": string,"notify_ahead_n"?: number,"operating_hours_per_day": number,"storage_capacity_kg": number,"tariff_minor_per_kwh"?: number,"updated_at"?: string
                  }
                  Update: {
                    "base_load_kw"?: number,"created_at"?: string,"dry_yield_pct"?: number,"id"?: string,"idle_threshold_pct"?: number,"labor_minor_per_hour"?: number,"name"?: string,"notify_ahead_n"?: number,"operating_hours_per_day"?: number,"storage_capacity_kg"?: number,"tariff_minor_per_kwh"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"machines": {
                  Row: {
                    "active": boolean,"capacity_kg": number | null,"code": string,"created_at": string,"cycle_hours": number | null,"facility_id": string,"id": string,"kg_per_hour": number | null,"rated_kw": number,"type": Database["public"]['Enums']["machine_type"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"capacity_kg"?: number | null,"code": string,"created_at"?: string,"cycle_hours"?: number | null,"facility_id": string,"id"?: string,"kg_per_hour"?: number | null,"rated_kw"?: number,"type": Database["public"]['Enums']["machine_type"],"updated_at"?: string
                  }
                  Update: {
                    "active"?: boolean,"capacity_kg"?: number | null,"code"?: string,"created_at"?: string,"cycle_hours"?: number | null,"facility_id"?: string,"id"?: string,"kg_per_hour"?: number | null,"rated_kw"?: number,"type"?: Database["public"]['Enums']["machine_type"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "machines_facility_id_fkey"
      columns: ["facility_id"]
isOneToOne: false
      referencedRelation: "facilities"
      referencedColumns: ["id"]
    }
                  ]
                },"municipalities": {
                  Row: {
                    "created_at": string,"id": string,"lat": number | null,"lng": number | null,"name": string,"psgc_code": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"lat"?: number | null,"lng"?: number | null,"name": string,"psgc_code": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"lat"?: number | null,"lng"?: number | null,"name"?: string,"psgc_code"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"sell_offers": {
                  Row: {
                    "booked_by_phone": string,"client_id": string,"created_at": string,"est_kg": number,"facility_id": string,"harvest_date": string,"id": string,"ref": string,"status": Database["public"]['Enums']["sell_offer_status"],"updated_at": string,"variety_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "booked_by_phone": string,"client_id": string,"created_at"?: string,"est_kg": number,"facility_id": string,"harvest_date": string,"id"?: string,"ref": string,"status"?: Database["public"]['Enums']["sell_offer_status"],"updated_at"?: string,"variety_id"?: string | null
                  }
                  Update: {
                    "booked_by_phone"?: string,"client_id"?: string,"created_at"?: string,"est_kg"?: number,"facility_id"?: string,"harvest_date"?: string,"id"?: string,"ref"?: string,"status"?: Database["public"]['Enums']["sell_offer_status"],"updated_at"?: string,"variety_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "sell_offers_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sell_offers_facility_id_fkey"
      columns: ["facility_id"]
isOneToOne: false
      referencedRelation: "facilities"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sell_offers_variety_id_fkey"
      columns: ["variety_id"]
isOneToOne: false
      referencedRelation: "varieties"
      referencedColumns: ["id"]
    }
                  ]
                },"sms_messages": {
                  Row: {
                    "body": string,"created_at": string,"direction": Database["public"]['Enums']["sms_direction"],"gateway_id": string | null,"id": string,"parsed": Json | null,"phone": string,"status": Database["public"]['Enums']["sms_status"],"updated_at": string,"via_ai": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "body": string,"created_at"?: string,"direction": Database["public"]['Enums']["sms_direction"],"gateway_id"?: string | null,"id"?: string,"parsed"?: Json | null,"phone": string,"status": Database["public"]['Enums']["sms_status"],"updated_at"?: string,"via_ai"?: boolean
                  }
                  Update: {
                    "body"?: string,"created_at"?: string,"direction"?: Database["public"]['Enums']["sms_direction"],"gateway_id"?: string | null,"id"?: string,"parsed"?: Json | null,"phone"?: string,"status"?: Database["public"]['Enums']["sms_status"],"updated_at"?: string,"via_ai"?: boolean
                  }
                  Relationships: [
                    
                  ]
                },"sms_prompts": {
                  Row: {
                    "created_at": string,"expires_at": string,"id": string,"kind": Database["public"]['Enums']["sms_prompt_kind"],"payload": NonNullable<Json>,"phone": string,"ref": string,"status": Database["public"]['Enums']["sms_prompt_status"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"expires_at"?: string,"id"?: string,"kind": Database["public"]['Enums']["sms_prompt_kind"],"payload"?: NonNullable<Json>,"phone": string,"ref": string,"status"?: Database["public"]['Enums']["sms_prompt_status"],"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"expires_at"?: string,"id"?: string,"kind"?: Database["public"]['Enums']["sms_prompt_kind"],"payload"?: NonNullable<Json>,"phone"?: string,"ref"?: string,"status"?: Database["public"]['Enums']["sms_prompt_status"],"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"staff": {
                  Row: {
                    "auth_user_id": string,"created_at": string,"id": string,"name": string,"role": Database["public"]['Enums']["staff_role"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "auth_user_id": string,"created_at"?: string,"id"?: string,"name": string,"role": Database["public"]['Enums']["staff_role"],"updated_at"?: string
                  }
                  Update: {
                    "auth_user_id"?: string,"created_at"?: string,"id"?: string,"name"?: string,"role"?: Database["public"]['Enums']["staff_role"],"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"varieties": {
                  Row: {
                    "code": string,"created_at": string,"id": string,"name": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"created_at"?: string,"id"?: string,"name": string,"updated_at"?: string
                  }
                  Update: {
                    "code"?: string,"created_at"?: string,"id"?: string,"name"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            [_ in never]: never
          }
          Enums: {
            "booking_channel": "sms"|"staff","booking_status": "confirmed"|"reschedule_proposed"|"arrived"|"cancelled"|"no_show","client_kind": "farmer"|"coop"|"trader"|"buyer","machine_type": "dryer"|"mill","sell_offer_status": "offered"|"accepted"|"declined"|"arrived"|"withdrawn","service": "drying"|"milling","sms_direction": "inbound"|"outbound","sms_prompt_kind": "ai_confirm"|"reschedule","sms_prompt_status": "open"|"accepted"|"declined"|"expired","sms_status": "received"|"processed"|"queued"|"sent"|"failed","staff_role": "encoder"|"manager"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "booking_channel": ["sms", "staff"],"booking_status": ["confirmed", "reschedule_proposed", "arrived", "cancelled", "no_show"],"client_kind": ["farmer", "coop", "trader", "buyer"],"machine_type": ["dryer", "mill"],"sell_offer_status": ["offered", "accepted", "declined", "arrived", "withdrawn"],"service": ["drying", "milling"],"sms_direction": ["inbound", "outbound"],"sms_prompt_kind": ["ai_confirm", "reschedule"],"sms_prompt_status": ["open", "accepted", "declined", "expired"],"sms_status": ["received", "processed", "queued", "sent", "failed"],"staff_role": ["encoder", "manager"]
          }
        }
} as const
