import { useContactStore } from '../store/contactStore';
import { Upload, ShieldX, ScanSearch, Square, Search, CheckSquare, KeyRound, StopCircle } from 'lucide-react';

interface Props {
  onImport: () => void;
  onExclude: () => void;
  onTokens: () => void;
}

export default function Header({ onImport, onExclude, onTokens }: Props) {
  const {
    isValidating, validationProgress,
    startValidation, stopValidation,
    selectAll, deselectAll, selectedIds,
    getFilteredContacts, searchQuery, setSearch,
    botTokens,
  } = useContactStore();

  const filtered    = getFilteredContacts();
  const allSelected = filtered.length > 0 && filtered.every((c) => selectedIds.has(c.id));
  const pct         = validationProgress.total > 0
    ? Math.round((validationProgress.done / validationProgress.total) * 100)
    : 0;

  // Checks per second
  const elapsed = validationProgress.startedAt > 0 ? (Date.now() - validationProgress.startedAt) / 1000 : 0;
  const cps     = elapsed > 2 && validationProgress.done > 0 ? Math.round(validationProgress.done / elapsed) : null;

  return (
    <header className="relative border-b border-white/5 bg-[#0a0a0a]/80 backdrop-blur-md px-4 py-2.5">
      <div className="flex items-center gap-2">

        {/* Select All */}
        <button
          onClick={() => (allSelected ? deselectAll() : selectAll())}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-gray-400 hover:text-white hover:bg-white/5 transition-colors border border-white/5"
          title="Выделить все"
        >
          {allSelected
            ? <CheckSquare size={14} className="text-cyan-400" />
            : <Square size={14} />
          }
          <span className="hidden sm:inline">Все</span>
        </button>

        {/* Search */}
        <div className="flex-1 max-w-xs relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-600" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск..."
            className="w-full bg-white/[0.03] border border-white/5 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-gray-600 outline-none focus:border-cyan-500/30 transition-colors"
          />
        </div>

        <div className="flex-1" />

        {/* Import */}
        <button
          onClick={onImport}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-cyan-400 hover:bg-cyan-400/10 border border-cyan-400/20 transition-colors"
        >
          <Upload size={13} />
          Импорт
        </button>

        {/* Exclude */}
        <button
          onClick={onExclude}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-gray-400 hover:text-red-400 hover:bg-red-400/10 border border-white/5 transition-colors"
        >
          <ShieldX size={13} />
          <span className="hidden sm:inline">Блок-лист</span>
        </button>

        {/* Tokens */}
        <button
          onClick={onTokens}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition-colors ${
            botTokens.length > 0
              ? 'text-violet-400 border-violet-500/25 bg-violet-500/10 hover:bg-violet-500/20'
              : 'text-gray-500 border-white/5 hover:text-violet-400 hover:bg-violet-400/10'
          }`}
        >
          <KeyRound size={13} />
          <span className="hidden sm:inline">
            {botTokens.length > 0 ? `${botTokens.length} токен${botTokens.length > 1 ? 'ов' : ''}` : 'Токены'}
          </span>
        </button>

        {/* Validate / Stop */}
        {isValidating ? (
          <button
            onClick={stopValidation}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition-colors min-w-[120px] justify-center"
          >
            <StopCircle size={13} />
            <span>{pct}%</span>
            <span className="text-[10px] text-amber-500/70">
              {validationProgress.done}/{validationProgress.total}
              {cps !== null && ` · ${cps}/с`}
            </span>
          </button>
        ) : (
          <button
            onClick={startValidation}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors"
          >
            <ScanSearch size={13} />
            Проверить
          </button>
        )}
      </div>

      {/* Progress bar */}
      {isValidating && (
        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-white/5">
          <div
            className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500 transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </header>
  );
}
