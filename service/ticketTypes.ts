export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';

export type Ticket = {
  id: string;
  created_at: string;
  user_id: string;
  title: string;
  description: string;
  status: TicketStatus;
  upload_url: string | null;
};

export type TicketUserRole = 'USER' | 'ADMIN';

export type TicketChat = {
  id: string;
  ticket_id: string;
  user_id: string;
  user_role: TicketUserRole;
  created_at: string;
  chat: string;
};

export type FileInput = {
  uri: string;
  name: string;
  type?: string;
};
