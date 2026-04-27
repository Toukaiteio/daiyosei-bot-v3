import { Database, Sparkles } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { fetchRecentImages } from '../api';
import { EmptyState } from '../components/EmptyState';
import { SectionHeader } from '../components/SectionHeader';
import { StatCard } from '../components/StatCard';
import { Tag } from '../components/Tag';
import type { RuntimeStatus, RecentImage } from '../types';

type MemoryPageProps = {
  status?: RuntimeStatus;
};

export function MemoryPage({ status }: MemoryPageProps) {
  const [userId, setUserId] = useState('');
  const [groupId, setGroupId] = useState('');
  const [since, setSince] = useState('');
  const [limit, setLimit] = useState(12);

  const [images, setImages] = useState<RecentImage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetchRecentImages({
        userId: userId.trim() || undefined,
        groupId: groupId.trim() || undefined,
        since: since || undefined,
        limit,
      });
      setImages(response.images);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Failed to load recent images');
      setImages([]);
    } finally {
      setIsLoading(false);
    }
  }, [groupId, limit, since, userId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refresh();
    }, 250);

    return () => window.clearTimeout(timer);
  }, [refresh]);

  return (
    <div className="memory-v3">
      <SectionHeader
        title="Memory"
        description="OpenMemory status plus locally cached recent image records."
        action={
          <button className="btn-v3-outline" onClick={() => void refresh()} type="button">
            <Sparkles size={16} />
            Refresh
          </button>
        }
      />

      <div className="stats-row">
        <StatCard
          icon={<Database size={18} />}
          label="OpenMemory"
          value={status?.openMemory.mode === 'remote' ? 'Remote' : 'Local'}
          status="success"
        />
        <StatCard icon={<Sparkles size={18} />} label="Images" value={status?.storage.images ?? 0} />
        <StatCard icon={<Database size={18} />} label="Messages" value={status?.storage.messages ?? 0} />
      </div>

      <div className="card-v3">
        <div className="card-header-v3">
          <Database size={20} />
          <h3>Cached Records</h3>
        </div>
        <div className="field-row filters-v3">
          <div className="field-v3">
            <label>User ID</label>
            <input value={userId} onChange={(event) => setUserId(event.target.value)} placeholder="Optional" />
          </div>
          <div className="field-v3">
            <label>Group ID</label>
            <input value={groupId} onChange={(event) => setGroupId(event.target.value)} placeholder="Optional" />
          </div>
          <div className="field-v3">
            <label>Since</label>
            <input type="date" value={since} onChange={(event) => setSince(event.target.value)} />
          </div>
          <div className="field-v3">
            <label>Limit</label>
            <input
              type="number"
              min={1}
              max={100}
              value={limit}
              onChange={(event) => setLimit(Number(event.target.value) || 12)}
            />
          </div>
        </div>

        {error ? <div className="error-banner-v3">{error}</div> : null}

        {status?.openMemory.mode === 'remote' ? (
          <div className="provider-meta-v3">
            <Tag tone="success">{status.openMemory.baseUrl ?? 'OpenMemory configured'}</Tag>
            <Tag tone={status.openMemory.apiKeyConfigured ? 'success' : 'warning'}>
              {status.openMemory.apiKeyConfigured ? 'API key configured' : 'API key missing'}
            </Tag>
          </div>
        ) : (
          <div className="field-help">
            OpenMemory is running in <strong>Local Mode</strong> (SQLite). Long-term memory is active.
          </div>
        )}

        {isLoading ? <div className="field-help">Loading recent records...</div> : null}

        <div className="image-grid-v3">
          {images.map((image) => (
            <article key={image.id} className="image-card-v3">
              <div className="image-card-header-v3">
                <strong>{image.imageHash.slice(0, 12)}</strong>
                <span>{new Date(image.createdAt).toLocaleString()}</span>
              </div>
              <div className="image-card-meta-v3">
                <span>{image.groupId ?? image.userId ?? 'unknown source'}</span>
                <span>{image.messageId ?? 'no message id'}</span>
              </div>
              {image.summary ? <p>{image.summary}</p> : null}
              {image.ocrText ? <p className="image-ocr-v3">{image.ocrText}</p> : null}
              <div className="p-tags">
                {image.tags.map((tag) => (
                  <Tag key={tag} tone="accent">
                    {tag}
                  </Tag>
                ))}
              </div>
            </article>
          ))}
          {images.length === 0 && !isLoading ? (
            <EmptyState
              title="No cached images"
              description="Trigger a conversation with images, then refresh this view to inspect local cache records."
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
