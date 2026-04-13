import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Contact, ContactStatus, ContactType, Folder, SidebarFilter } from '../types';
import { extractUsernames, guessType } from '../utils/parser';
import { validateBatch, type ValidationResult } from '../utils/validator';

interface ContactState {
  contacts: Contact[];
  folders: Folder[];
  excludeList: string[];
  selectedIds: Set<string>;
  activeFilter: SidebarFilter;
  searchQuery: string;
  isValidating: boolean;
  validationProgress: { done: number; total: number; startedAt: number };
  abortController: AbortController | null;

  importRaw: (raw: string) => number;
  addContacts: (usernames: string[]) => number;
  removeContacts: (ids: string[]) => void;
  updateContact: (id: string, data: Partial<Contact>) => void;
  setStatus: (ids: string[], status: ContactStatus) => void;
  setFolder: (ids: string[], folderId: string) => void;
  markViewed: (id: string) => void;
  toggleSelect: (id: string) => void;
  selectAll: () => void;
  deselectAll: () => void;
  setFilter: (f: SidebarFilter) => void;
  setSearch: (q: string) => void;
  addFolder: (name: string, color: string) => void;
  removeFolder: (id: string) => void;
  setExcludeList: (raw: string) => void;
  applyExcludeList: () => void;
  startValidation: () => void;
  stopValidation: () => void;
  exportSelected: () => string;
  getFilteredContacts: () => Contact[];
  getCounts: () => Record<string, number>;
}

const generateId = () => Math.random().toString(36).slice(2, 11) + Date.now().toString(36);

export const useContactStore = create<ContactState>()(
  persist(
    (set, get) => ({
      contacts: [],
      folders: [],
      excludeList: [],
      selectedIds: new Set<string>(),
      activeFilter: 'all',
      searchQuery: '',
      isValidating: false,
      validationProgress: { done: 0, total: 0, startedAt: 0 },
      abortController: null,

      importRaw: (raw: string) => {
        const usernames = extractUsernames(raw);
        return get().addContacts(usernames);
      },

      addContacts: (usernames: string[]) => {
        const existing = new Set(get().contacts.map((c) => c.username));
        const excludeSet = new Set(get().excludeList);
        const newContacts: Contact[] = usernames
          .filter((u) => !existing.has(u) && !excludeSet.has(u))
          .map((u) => ({
            id: generateId(),
            username: u,
            displayName: '',
            bio: '',
            avatar: '',
            status: 'new' as ContactStatus,
            type: guessType(u) as ContactType,
            folder: 'default',
            addedAt: Date.now(),
            checkedAt: null,
            viewed: false,
          }));
        if (newContacts.length > 0) {
          set((s) => ({ contacts: [...s.contacts, ...newContacts] }));
        }
        return newContacts.length;
      },

      removeContacts: (ids: string[]) => {
        const idSet = new Set(ids);
        set((s) => ({
          contacts: s.contacts.filter((c) => !idSet.has(c.id)),
          selectedIds: new Set([...s.selectedIds].filter((id) => !idSet.has(id))),
        }));
      },

      updateContact: (id, data) => {
        set((s) => ({
          contacts: s.contacts.map((c) => (c.id === id ? { ...c, ...data } : c)),
        }));
      },

      setStatus: (ids, status) => {
        const idSet = new Set(ids);
        set((s) => ({
          contacts: s.contacts.map((c) => (idSet.has(c.id) ? { ...c, status } : c)),
        }));
      },

      setFolder: (ids, folderId) => {
        const idSet = new Set(ids);
        set((s) => ({
          contacts: s.contacts.map((c) => (idSet.has(c.id) ? { ...c, folder: folderId } : c)),
        }));
      },

      markViewed: (id) => {
        set((s) => ({
          contacts: s.contacts.map((c) =>
            c.id === id
              ? { ...c, viewed: true, status: c.status === 'new' ? 'in_progress' : c.status }
              : c,
          ),
        }));
      },

      toggleSelect: (id) => {
        set((s) => {
          const next = new Set(s.selectedIds);
          if (next.has(id)) next.delete(id); else next.add(id);
          return { selectedIds: next };
        });
      },

      selectAll: () => {
        const filtered = get().getFilteredContacts();
        set({ selectedIds: new Set(filtered.map((c) => c.id)) });
      },

      deselectAll: () => set({ selectedIds: new Set() }),
      setFilter: (f) => set({ activeFilter: f, selectedIds: new Set() }),
      setSearch: (q) => set({ searchQuery: q }),

      addFolder: (name, color) => {
        set((s) => ({ folders: [...s.folders, { id: generateId(), name, color }] }));
      },

      removeFolder: (id) => {
        set((s) => ({
          folders: s.folders.filter((f) => f.id !== id),
          contacts: s.contacts.map((c) => (c.folder === id ? { ...c, folder: 'default' } : c)),
        }));
      },

      setExcludeList: (raw) => {
        const names = raw
          .split(/[\n,;\s]+/)
          .map((s) => s.replace(/^@/, '').toLowerCase().trim())
          .filter((s) => s.length >= 4);
        set({ excludeList: names });
        get().applyExcludeList();
      },

      applyExcludeList: () => {
        const excludeSet = new Set(get().excludeList);
        set((s) => ({ contacts: s.contacts.filter((c) => !excludeSet.has(c.username)) }));
      },

      startValidation: () => {
        const state = get();
        if (state.isValidating) return;

        const toCheck = state.contacts.filter(
          (c) => c.status === 'new' || c.status === 'checking' || c.status === 'network_error',
        );
        if (toCheck.length === 0) return;

        const controller = new AbortController();
        set({
          isValidating: true,
          abortController: controller,
          validationProgress: { done: 0, total: toCheck.length, startedAt: Date.now() },
          contacts: state.contacts.map((c) =>
            c.status === 'new' || c.status === 'network_error'
              ? { ...c, status: 'checking' as ContactStatus }
              : c,
          ),
        });

        const usernames = toCheck.map((c) => c.username);

        validateBatch(
          usernames,
          (result: ValidationResult | null, username: string) => {
            if (result !== null) {
              const contact = get().contacts.find((c) => c.username === result.username);
              if (contact) {
                get().updateContact(contact.id, {
                  status: result.status,
                  type: result.type,
                  displayName: result.displayName,
                  bio: result.bio,
                  avatar: result.avatar,
                  checkedAt: Date.now(),
                });
              }
            } else {
              const contact = get().contacts.find((c) => c.username === username);
              if (contact) get().updateContact(contact.id, { status: 'network_error' as ContactStatus });
            }
            set((s) => ({
              validationProgress: {
                ...s.validationProgress,
                done: s.validationProgress.done + 1,
              },
            }));
          },
          controller.signal,
        ).finally(() => {
          set({
            isValidating: false,
            abortController: null,
            contacts: get().contacts.map((c) =>
              c.status === 'checking' ? { ...c, status: 'new' as ContactStatus } : c,
            ),
          });
        });
      },

      stopValidation: () => {
        const { abortController } = get();
        if (abortController) abortController.abort();
        set({ isValidating: false, abortController: null });
      },

      exportSelected: () => {
        const { contacts, selectedIds } = get();
        return contacts
          .filter((c) => selectedIds.has(c.id))
          .map((c) => `@${c.username}`)
          .join('\n');
      },

      getFilteredContacts: () => {
        const { contacts, activeFilter, searchQuery, folders } = get();
        let filtered = contacts;
        switch (activeFilter) {
          case 'all': break;
          case 'new':
            filtered = filtered.filter((c) => c.status === 'new' || c.status === 'checking' || c.status === 'network_error');
            break;
          case 'in_progress': filtered = filtered.filter((c) => c.status === 'in_progress'); break;
          case 'verified':    filtered = filtered.filter((c) => c.status === 'verified');    break;
          case 'groups':      filtered = filtered.filter((c) => c.type === 'group' || c.type === 'channel'); break;
          case 'bots':        filtered = filtered.filter((c) => c.type === 'bot');           break;
          case 'users':       filtered = filtered.filter((c) => c.type === 'user');          break;
          case 'not_exist':   filtered = filtered.filter((c) => c.status === 'not_exist');   break;
          default: {
            const folder = folders.find((f) => f.id === activeFilter);
            if (folder) filtered = filtered.filter((c) => c.folder === activeFilter);
            break;
          }
        }
        if (searchQuery) {
          const q = searchQuery.toLowerCase();
          filtered = filtered.filter(
            (c) => c.username.includes(q) || c.displayName.toLowerCase().includes(q) || c.bio.toLowerCase().includes(q),
          );
        }
        return filtered;
      },

      getCounts: () => {
        const { contacts, folders } = get();
        const counts: Record<string, number> = {
          all: contacts.length, new: 0, users: 0, in_progress: 0,
          verified: 0, groups: 0, bots: 0, not_exist: 0,
        };
        for (const c of contacts) {
          if (c.status === 'new' || c.status === 'checking' || c.status === 'network_error') counts.new++;
          if (c.status === 'in_progress') counts.in_progress++;
          if (c.status === 'verified')    counts.verified++;
          if (c.status === 'not_exist')   counts.not_exist++;
          if (c.type === 'user')          counts.users++;
          if (c.type === 'bot')           counts.bots++;
          if (c.type === 'group' || c.type === 'channel') counts.groups++;
        }
        for (const f of folders) {
          counts[f.id] = contacts.filter((c) => c.folder === f.id).length;
        }
        return counts;
      },
    }),
    {
      name: 'tg-ultra-combine-v3',
      // contacts excluded — 100k records overflow localStorage (5 MB limit)
      // Re-import after page refresh; folders/tokens/blacklist persist.
      partialize: (state) => ({
        folders:      state.folders,
        excludeList:  state.excludeList,
        activeFilter: state.activeFilter,

      }),
      storage: {
        getItem:    (name) => { const s = localStorage.getItem(name); return s ? JSON.parse(s) : null; },
        setItem:    (name, value) => localStorage.setItem(name, JSON.stringify(value)),
        removeItem: (name) => localStorage.removeItem(name),
      },
    },
  ),
);
