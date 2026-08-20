export type WhatsAppSessionStatus = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED';

export type ChargeStatus = 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED';

export type NotificationTriggerType = 'BEFORE_2_DAYS' | 'ON_DUE_DATE' | 'AFTER_3_DAYS';

export type NotificationStatus = 'SUCCESS' | 'FAILED';

export interface Profile {
  id: string;
  company_name: string | null;
  whatsapp_session_status: WhatsAppSessionStatus;
  whatsapp_instance_id: string | null;
  created_at: string;
}

export interface Customer {
  id: string;
  user_id: string;
  name: string;
  phone: string;
  email: string | null;
  created_at: string;
}

export interface Charge {
  id: string;
  user_id: string;
  customer_id: string;
  amount: number;
  due_date: string;
  status: ChargeStatus;
  is_recurrent: boolean;
  recurrent_day: number | null;
  payment_link_or_pix: string | null;
  notes: string | null;
  created_at: string;
  customers?: Customer;
}

export interface NotificationLog {
  id: string;
  charge_id: string;
  trigger_type: NotificationTriggerType;
  sent_at: string;
  status: NotificationStatus;
  message_body: string;
}

export interface DashboardMetrics {
  totalToReceive: number;
  totalToReceiveCount: number;
  totalRecovered: number;
  totalRecoveredCount: number;
  overdueAmount: number;
  overdueCount: number;
  whatsappStatus: WhatsAppSessionStatus;
}
