export type ContactStatus = 'new' | 'verified' | 'not_exist' | 'in_progress' | 'checking' | 'network_error';
export type ContactType = 'user' | 'bot' | 'group' | 'channel';

export interface Contact {
  id: string;
  username: string; // without @
  displayName: string;
  bio: string;
  avatar: string;
  status: ContactStatus;
  type: ContactType;
  folder: string; // 'default' or custom folder id
  addedAt: number;
  checkedAt: number | null;
  viewed: boolean;
}

export interface Folder {
  id: string;
  name: string;
  color: string;
}

export type SidebarFilter = 'all' | 'new' | 'users' | 'in_progress' | 'verified' | 'groups' | 'bots' | 'not_exist' | string;
