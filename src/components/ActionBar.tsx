import { useContactStore } from '../store/contactStore';
import { CheckCircle, Trash2, Download, X, FolderOpen } from 'lucide-react';
import { useState } from 'react';

export default function ActionBar() {
  const {
    selectedIds,
    deselectAll,
    setStatus,
    removeContacts,
    exportSelected,
    folders,
    setFolder,
  } = useContactStore();

  const [showFolders, setShowFolders] = useState(false);
  const count = selectedIds.size;

  if (count < 1) return null;

  const ids = Array.from(selectedIds);

  const handleExport = () => {
    const text = exportSelected();
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tg-export-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleWritten = () => {
    setStatus(ids, 'in_progress');
    deselectAll();
  };

  const handleDelete = () => {
    removeContacts(ids);
  };

  const handleMoveToFolder = (folderId: string) => {
    setFolder(ids, folderId);
    setShowFolders(false);
    deselectAll();
  };

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 animate-slide-up">
      <div className="bg-[#111]/90 backdrop-blur-xl border border-white/10 rounded-2xl px-4 py-2.5 flex items-center gap-2 shadow-2xl shadow-black/50">
        {/* Count */}
        <div className="flex items-center gap-2 pr-3 border-r border-white/10">
          <span className="text-xs font-bold text-cyan-400">{count}</span>
          <span className="text-xs text-gray-400">выбрано</span>
        </div>

        {/* Actions */}
        <button
          onClick={handleWritten}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-yellow-400 hover:bg-yellow-400/10 transition-colors"
        >
          <CheckCircle size={14} />
          Написано
        </button>

        <div className="relative">
          <button
            onClick={() => setShowFolders(!showFolders)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-purple-400 hover:bg-purple-400/10 transition-colors"
          >
            <FolderOpen size={14} />
            В папку
          </button>
          {showFolders && (
            <div className="absolute bottom-full mb-2 left-0 bg-[#1a1a1a] border border-white/10 rounded-xl p-1.5 min-w-[140px] shadow-xl">
              {folders.length === 0 ? (
                <p className="text-[11px] text-gray-500 px-2 py-1.5">Создайте папку в sidebar</p>
              ) : (
                folders.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => handleMoveToFolder(f.id)}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-gray-300 hover:bg-white/5 transition-colors"
                  >
                    <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: f.color }} />
                    {f.name}
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        <button
          onClick={handleDelete}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-400 hover:bg-red-400/10 transition-colors"
        >
          <Trash2 size={14} />
          Удалить
        </button>

        <button
          onClick={handleExport}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-emerald-400 hover:bg-emerald-400/10 transition-colors"
        >
          <Download size={14} />
          Экспорт TXT
        </button>

        {/* Close */}
        <div className="pl-2 border-l border-white/10">
          <button onClick={deselectAll} className="p-1.5 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-white/5 transition-colors">
            <X size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
