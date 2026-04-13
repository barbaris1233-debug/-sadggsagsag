import { useState } from 'react';
import { useContactStore } from '../store/contactStore';
import type { SidebarFilter } from '../types';
import {
  Users, UserPlus, User, Briefcase, Globe, Bot, XCircle,
  FolderPlus, Trash2, ChevronDown, ChevronRight, Zap,
} from 'lucide-react';

const SYSTEM_FILTERS: { key: SidebarFilter; label: string; icon: React.ReactNode; color: string }[] = [
  { key: 'all', label: 'Все', icon: <Users size={16} />, color: 'text-cyan-400' },
  { key: 'new', label: 'Новые', icon: <UserPlus size={16} />, color: 'text-blue-400' },
  { key: 'users', label: 'Пользователи', icon: <User size={16} />, color: 'text-sky-400' },
  { key: 'in_progress', label: 'В работе', icon: <Briefcase size={16} />, color: 'text-yellow-400' },
  { key: 'verified', label: 'Проверенные', icon: <Zap size={16} />, color: 'text-green-400' },
  { key: 'groups', label: 'Группы', icon: <Globe size={16} />, color: 'text-purple-400' },
  { key: 'bots', label: 'Боты', icon: <Bot size={16} />, color: 'text-orange-400' },
  { key: 'not_exist', label: 'Не существуют', icon: <XCircle size={16} />, color: 'text-red-400' },
];

export default function Sidebar() {
  const { activeFilter, setFilter, folders, addFolder, removeFolder, getCounts } = useContactStore();
  const counts = getCounts();
  const [showFolderInput, setShowFolderInput] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [foldersOpen, setFoldersOpen] = useState(true);

  const handleAddFolder = () => {
    if (folderName.trim()) {
      const colors = ['#06b6d4', '#a855f7', '#f59e0b', '#10b981', '#ef4444', '#3b82f6'];
      addFolder(folderName.trim(), colors[folders.length % colors.length]);
      setFolderName('');
      setShowFolderInput(false);
    }
  };

  return (
    <aside className="w-56 shrink-0 flex flex-col h-full border-r border-white/5">
      {/* Logo */}
      <div className="px-4 py-4 border-b border-white/5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
            <Zap size={16} className="text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white leading-tight">TG-ULTRA</h1>
            <p className="text-[10px] text-gray-500 leading-tight">COMBINE 2.0</p>
          </div>
        </div>
      </div>

      {/* System Filters */}
      <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
        {SYSTEM_FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
              activeFilter === f.key
                ? 'bg-white/10 text-white'
                : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
            }`}
          >
            <span className={f.color}>{f.icon}</span>
            <span className="flex-1 text-left">{f.label}</span>
            <span
              className={`min-w-[20px] text-center text-[10px] px-1.5 py-0.5 rounded-full ${
                activeFilter === f.key ? 'bg-white/15 text-white' : 'bg-white/5 text-gray-500'
              }`}
            >
              {counts[f.key] ?? 0}
            </span>
          </button>
        ))}

        {/* Custom Folders */}
        <div className="pt-3">
          <div
            role="button"
            tabIndex={0}
            onClick={() => setFoldersOpen(!foldersOpen)}
            onKeyDown={(e) => e.key === 'Enter' && setFoldersOpen(!foldersOpen)}
            className="w-full flex items-center gap-1.5 px-3 py-1.5 text-[10px] uppercase tracking-wider text-gray-500 hover:text-gray-300 transition-colors cursor-pointer"
          >
            {foldersOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            Папки
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowFolderInput(true);
              }}
              className="ml-auto p-0.5 hover:text-cyan-400 transition-colors"
            >
              <FolderPlus size={12} />
            </button>
          </div>

          {foldersOpen && (
            <div className="space-y-0.5 mt-1">
              {folders.map((folder) => (
                <div key={folder.id} className="group flex items-center">
                  <button
                    onClick={() => setFilter(folder.id)}
                    className={`flex-1 flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                      activeFilter === folder.id
                        ? 'bg-white/10 text-white'
                        : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
                    }`}
                  >
                    <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: folder.color }} />
                    <span className="flex-1 text-left truncate">{folder.name}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/5 text-gray-500">
                      {counts[folder.id] ?? 0}
                    </span>
                  </button>
                  <button
                    onClick={() => removeFolder(folder.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 text-gray-600 hover:text-red-400 transition-all"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}

              {showFolderInput && (
                <div className="px-3 py-1.5 flex gap-1.5">
                  <input
                    autoFocus
                    value={folderName}
                    onChange={(e) => setFolderName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddFolder()}
                    placeholder="Имя папки..."
                    className="flex-1 bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white placeholder:text-gray-600 outline-none focus:border-cyan-500/50"
                  />
                  <button onClick={handleAddFolder} className="text-cyan-400 text-xs font-medium hover:text-cyan-300">
                    ✓
                  </button>
                  <button onClick={() => setShowFolderInput(false)} className="text-gray-500 text-xs hover:text-gray-300">
                    ✕
                  </button>
                </div>
              )}

              {folders.length === 0 && !showFolderInput && (
                <p className="px-3 py-2 text-[10px] text-gray-600 italic">Нет папок</p>
              )}
            </div>
          )}
        </div>
      </nav>
    </aside>
  );
}
