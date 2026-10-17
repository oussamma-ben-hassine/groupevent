export interface User {
  id: string;
  email?: string;
  display_name: string;
  avatar_url?: string;
  role: string;
}

export interface CurrentActor {
  authenticated: boolean;
  type: 'user' | 'guest';
  id: string;
  email?: string;
  display_name: string;
  avatar_url?: string;
  role: string;
  event_id?: string;
}

export interface EventMember {
  id: string;
  event_id: string;
  user_id?: string;
  guest_name?: string;
  display_title: string;
  role: 'organizer' | 'member' | 'guest';
  status: 'active' | 'pending_approval';
  joined_at: string;
  avatar_url?: string;
}

export interface EventItem {
  id: string;
  title: string;
  description?: string;
  date?: string;
  location?: string;
  currency: string;
  icon: string;
  organizer_id: string;
  status: 'active' | 'completed' | 'archived';
  access_mode: 'private' | 'link_sso' | 'guest';
  require_approval: boolean;
  created_at: string;
  updated_at: string;
  member_count: number;
  grocery_count: number;
  total_expenses: number;
  members?: EventMember[];
  is_organizer?: boolean;
  current_member_id?: string;
}

export interface GroceryItem {
  id: string;
  event_id: string;
  name: string;
  quantity: number;
  unit: string;
  category: string;
  estimated_price?: number;
  is_bought: boolean;
  bought_by_id?: string;
  bought_by_name?: string;
  assigned_to_id?: string;
  assigned_to_name?: string;
  notes?: string;
  created_at: string;
}

export interface ExpenseSplit {
  id: string;
  member_id: string;
  member_name: string;
  amount: number;
  shares: number;
}

export interface Expense {
  id: string;
  event_id: string;
  title: string;
  amount: number;
  currency: string;
  payer_id: string;
  payer_name: string;
  category: string;
  date: string;
  split_mode: 'equal' | 'exact' | 'shares';
  receipt_url?: string;
  receipt_drive_id?: string;
  notes?: string;
  created_at: string;
  splits: ExpenseSplit[];
}

export interface MemberBalance {
  member_id: string;
  display_name: string;
  role: string;
  paid_total: number;
  owes_total: number;
  net_balance: number;
}

export interface DebtTransaction {
  from_member_id: string;
  from_member_name: string;
  to_member_id: string;
  to_member_name: string;
  amount: number;
  currency: string;
}

export interface BalancesData {
  currency: string;
  total_spent: number;
  members: MemberBalance[];
  suggested_settlements: DebtTransaction[];
}

export interface Settlement {
  id: string;
  event_id: string;
  from_member_id: string;
  from_member_name: string;
  to_member_id: string;
  to_member_name: string;
  amount: number;
  currency: string;
  settled_at: string;
  notes?: string;
}

export interface PublicInviteInfo {
  valid: boolean;
  event_id?: string;
  event_title?: string;
  event_description?: string;
  event_date?: string;
  event_location?: string;
  event_icon?: string;
  organizer_name?: string;
  mode: 'link_sso' | 'guest';
  require_approval: boolean;
  message?: string;
}
