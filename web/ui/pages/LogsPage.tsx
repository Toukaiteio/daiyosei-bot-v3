import { Terminal } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { fetchLogs } from '../api';
import { SectionHeader } from '../components/SectionHeader';
import type { LogEntry } from '../types';

export function LogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filter, setFilter] = useState('');
  const [level, setLevel] = useState<'all' | string>('all');
  const [followTail, setFollowTail] = useState(true);
  const bodyRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let alive = true;

    const load = async () => {
      try {
        const response = await fetchLogs();
        if (alive) {
          setLogs(response.logs);
        }
      } catch {
        if (alive) {
          setLogs([]);
        }
      }
    };

    void load();
    const timer = window.setInterval(load, 2000);

    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (followTail) {
      bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [logs, followTail]);

  const visibleLogs = useMemo(() => {
    return logs.filter((entry) => {
      const matchesLevel = level === 'all' || String(entry.level) === level;
      const haystack = `${entry.msg} ${JSON.stringify(entry)}`.toLowerCase();
      const matchesFilter = filter.trim() === '' || haystack.includes(filter.trim().toLowerCase());
      return matchesLevel && matchesFilter;
    });
  }, [filter, level, logs]);

  return (
    <div className="logs-v3">
      <SectionHeader
        title="Runtime Logs"
        description="Live Fastify and application logs streamed from the server process."
        action={
          <label className="check-v3">
            <input type="checkbox" checked={followTail} onChange={(event) => setFollowTail(event.target.checked)} />
            Follow tail
          </label>
        }
      />

      <div className="field-row filters-v3">
        <div className="field-v3">
          <label>Search</label>
          <input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Filter message text" />
        </div>
        <div className="field-v3">
          <label>Level</label>
          <select value={level} onChange={(event) => setLevel(event.target.value)}>
            <option value="all">All</option>
            <option value="10">Debug</option>
            <option value="20">Info</option>
            <option value="30">Warn</option>
            <option value="40">Error</option>
            <option value="50">Fatal</option>
          </select>
        </div>
      </div>

      <div className="logs-header-v3">
        <Terminal size={18} />
        <span>Foundation Stream</span>
        <span className="logs-count-v3">{visibleLogs.length} entries</span>
      </div>
      <div className="logs-body" ref={bodyRef}>
        {visibleLogs.map((entry, index) => (
          <div key={`${entry.time}-${index}`} className={`log-entry l-${entry.level}`}>
            <span className="l-time">{new Date(entry.time).toLocaleTimeString()}</span>
            <span className="l-msg">{entry.msg}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

