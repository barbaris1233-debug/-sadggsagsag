import { useContactStore } from '../store/contactStore';
import type { Contact, ContactStatus } from '../types';
import { ExternalLink, User, Bot, Globe, Users as UsersIcon } from 'lucide-react';
import { useRef, useState, useEffect, useMemo } from 'react';

const STATUS_CONFIG: Record<ContactStatus, { label: string; class: string; dot: string }> = {
  new: { label: 'Новый', class: 'text-blue-400', dot: 'bg-blue-400' },
  checking: { label: 'Проверка...', class: 'text-amber-400', dot: 'bg-amber-400 animate-pulse' },
  verified: { label: 'Проверен', class: 'text-emerald-400', dot: 'bg-emerald-400' },
  in_progress: { label: 'В работе', class: 'text-yellow-400', dot: 'bg-yellow-400' },
  not_exist: { label: 'Не существует', class: 'text-red-400', dot: 'bg-red-400' },
  network_error: { label: 'Ошибка сети', class: 'text-orange-400', dot: 'bg-orange-400' },
};

const TYPE_ICON: Record<string, React.ReactNode> = {
  user: <User size={13} />,
  bot: <Bot size={13} />,
  group: <UsersIcon size={13} />,
  channel: <Globe size={13} />,
};

function ContactRow({ contact }: { contact: Contact }) {
  const { selectedIds, toggleSelect, markViewed, folders } = useContactStore();
  const isSelected = selectedIds.has(contact.id);
  const statusCfg = STATUS_CONFIG[contact.status];
  const folder = folders.find((f) => f.id === contact.folder);

  const handleTgClick = () => {
    markViewed(contact.id);
    window.open(`tg://resolve?domain=${contact.username}`, '_blank');
  };

  return (
    <tr
      className={`group border-b border-white/[0.03] transition-colors ${
        isSelected ? 'bg-cyan-500/[0.07]' : contact.viewed ? 'bg-white/[0.02]' : 'hover:bg-white/[0.04]'
      }`}
    >
      {/* Checkbox */}
      <td className="w-10 px-3 py-2.5">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => toggleSelect(contact.id)}
          className="w-3.5 h-3.5 rounded border-white/20 bg-white/5 text-cyan-500 focus:ring-cyan-500/30 focus:ring-offset-0 cursor-pointer accent-cyan-500"
        />
      </td>

      {/* Avatar + Username */}
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center overflow-hidden shrink-0 border border-white/5">
            {contact.avatar ? (
              <img
                src={contact.avatar}
                alt=""
                className="w-full h-full object-cover"
                onError={(e) => {
                  // If the CDN URL fails to load, fall back to the type icon
                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                  (e.currentTarget.nextElementSibling as HTMLElement | null)?.style.removeProperty('display');
                }}
              />
            ) : null}
            <span
              className="text-gray-500"
              style={contact.avatar ? { display: 'none' } : undefined}
            >
              {TYPE_ICON[contact.type]}
            </span>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleTgClick}
                className="text-xs font-medium text-cyan-400 hover:text-cyan-300 hover:underline transition-colors flex items-center gap-1"
              >
                @{contact.username}
                <ExternalLink size={10} className="opacity-0 group-hover:opacity-60" />
              </button>
              {contact.viewed && (
                <span className="text-[9px] px-1 py-0.5 bg-yellow-500/10 text-yellow-500 rounded">👁</span>
              )}
            </div>
            {contact.displayName && (
              <p className="text-[11px] text-gray-400 truncate max-w-[200px]">{contact.displayName}</p>
            )}
          </div>
        </div>
      </td>

      {/* Type */}
      <td className="px-3 py-2.5">
        <span className="inline-flex items-center gap-1 text-[11px] text-gray-400 bg-white/5 px-1.5 py-0.5 rounded">
          {TYPE_ICON[contact.type]}
          {contact.type}
        </span>
      </td>

      {/* Status */}
      <td className="px-3 py-2.5">
        <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium ${statusCfg.class}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot}`} />
          {statusCfg.label}
        </span>
      </td>

      {/* Folder */}
      <td className="px-3 py-2.5">
        {folder ? (
          <span className="text-[11px] px-1.5 py-0.5 rounded" style={{ backgroundColor: folder.color + '20', color: folder.color }}>
            {folder.name}
          </span>
        ) : (
          <span className="text-[11px] text-gray-600">—</span>
        )}
      </td>

      {/* Bio */}
      <td className="px-3 py-2.5 max-w-[200px]">
        <p className="text-[11px] text-gray-500 truncate">{contact.bio || '—'}</p>
      </td>
    </tr>
  );
}

export default function ContactTable() {
  const { getFilteredContacts, selectedIds, selectAll, deselectAll } = useContactStore();
  const contacts = getFilteredContacts();
  const allSelected = contacts.length > 0 && contacts.every((c) => selectedIds.has(c.id));

  // Virtual scrolling
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(600);
  const ROW_HEIGHT = 52;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver((entries) => {
      setContainerHeight(entries[0].contentRect.height);
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const visibleRange = useMemo(() => {
    const start = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - 5);
    const end = Math.min(contacts.length, Math.ceil((scrollTop + containerHeight) / ROW_HEIGHT) + 5);
    return { start, end };
  }, [scrollTop, containerHeight, contacts.length]);

  const visibleContacts = contacts.slice(visibleRange.start, visibleRange.end);

  return (
    <div ref={containerRef} className="flex-1 overflow-auto" onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}>
      <table className="w-full min-w-[700px]">
        <thead className="sticky top-0 z-10 bg-[#0a0a0a]/95 backdrop-blur-md border-b border-white/5">
          <tr>
            <th className="w-10 px-3 py-2.5 text-left">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={() => (allSelected ? deselectAll() : selectAll())}
                className="w-3.5 h-3.5 rounded border-white/20 bg-white/5 accent-cyan-500 cursor-pointer"
              />
            </th>
            <th className="px-3 py-2.5 text-left text-[10px] uppercase tracking-wider text-gray-500 font-medium">
              Контакт
            </th>
            <th className="px-3 py-2.5 text-left text-[10px] uppercase tracking-wider text-gray-500 font-medium">
              Тип
            </th>
            <th className="px-3 py-2.5 text-left text-[10px] uppercase tracking-wider text-gray-500 font-medium">
              Статус
            </th>
            <th className="px-3 py-2.5 text-left text-[10px] uppercase tracking-wider text-gray-500 font-medium">
              Папка
            </th>
            <th className="px-3 py-2.5 text-left text-[10px] uppercase tracking-wider text-gray-500 font-medium">
              Описание
            </th>
          </tr>
        </thead>
        <tbody>
          {contacts.length === 0 ? (
            <tr>
              <td colSpan={6} className="py-20 text-center">
                <div className="text-gray-600">
                  <div className="text-3xl mb-3">📭</div>
                  <p className="text-sm font-medium">Нет контактов</p>
                  <p className="text-xs mt-1 text-gray-700">Импортируйте данные для начала работы</p>
                </div>
              </td>
            </tr>
          ) : (
            <>
              {visibleRange.start > 0 && (
                <tr>
                  <td colSpan={6} style={{ height: visibleRange.start * ROW_HEIGHT }} />
                </tr>
              )}
              {visibleContacts.map((c) => (
                <ContactRow key={c.id} contact={c} />
              ))}
              {visibleRange.end < contacts.length && (
                <tr>
                  <td colSpan={6} style={{ height: (contacts.length - visibleRange.end) * ROW_HEIGHT }} />
                </tr>
              )}
            </>
          )}
        </tbody>
      </table>
    </div>
  );
}
