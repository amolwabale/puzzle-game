import {
  closeSupportTicket,
  createSupportTicket,
  fetchSupportTicketById,
  fetchSupportTicketChat,
  fetchSupportTickets,
  sendSupportTicketMessage,
} from './MenuService';

export type {
  FileInput,
  Ticket,
  TicketChat,
  TicketStatus,
  TicketUserRole,
} from './ticketTypes';
import type { FileInput } from './ticketTypes';

export async function listTickets() {
  return await fetchSupportTickets();
}

export async function getTicket(ticketId: string) {
  return await fetchSupportTicketById(ticketId);
}

export async function createTicket(input: {
  title: string;
  description: string;
  file?: FileInput | null;
}) {
  return await createSupportTicket(input);
}

export async function listTicketChat(ticketId: string) {
  return await fetchSupportTicketChat(ticketId);
}

export async function sendTicketChat(input: {
  ticketId: string;
  chat: string;
}) {
  return await sendSupportTicketMessage(input);
}

export async function closeTicket(ticketId: string) {
  return await closeSupportTicket(ticketId);
}
