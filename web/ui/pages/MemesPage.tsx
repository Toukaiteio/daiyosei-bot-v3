import { Copy, Save, Sparkles, ToggleLeft, ToggleRight } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { EmptyState } from '../components/EmptyState';
import { SectionHeader } from '../components/SectionHeader';
import { StatCard } from '../components/StatCard';
import { Tag } from '../components/Tag';
import type { ConfigPatch, MemeAsset, MemeLibraryResponse, RuntimeStatus } from '../types';

type MemesPageProps = {
  status?: RuntimeStatus;
  library?: MemeLibraryResponse;
  isSaving: boolean;
  onSave: (patch: ConfigPatch) => Promise<void>;
};

export function MemesPage({ status, library, isSaving, onSave }: MemesPageProps) {
  const availableCategories = useMemo(
    () => library?.categories.map((category) => category.category) ?? [],
    [library],
  );
  const [enabled, setEnabled] = useState(true);
  const [restrictCategories, setRestrictCategories] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [disabledMemes, setDisabledMemes] = useState<string[]>([]);

  useEffect(() => {
    if (!library) {
      return;
    }

    setEnabled(library.config.enabled);
    setRestrictCategories(library.config.allowedCategories.length > 0);
    setSelectedCategories(
      library.config.allowedCategories.length > 0 ? library.config.allowedCategories : availableCategories,
    );
    setDisabledMemes(library.config.disabledMemes);
  }, [availableCategories, library]);

  const groupedMemes = useMemo(() => {
    const groups = new Map<string, MemeAsset[]>();
    for (const meme of library?.memes ?? []) {
      const list = groups.get(meme.category) ?? [];
      list.push(meme);
      groups.set(meme.category, list);
    }
    return [...groups.entries()].sort(([left], [right]) => left.localeCompare(right));
  }, [library]);

  const activeCount = selectedCategories.length > 0 ? selectedCategories.length : availableCategories.length;
  const totalMemes = library?.memes.length ?? 0;
  const animatedMemes = library?.memes.filter((meme) => meme.animated).length ?? 0;
  const disabledCount = disabledMemes.length;
  const activeCategories = restrictCategories ? selectedCategories : availableCategories;
  const disabledSet = useMemo(() => new Set(disabledMemes.map((value) => value.trim().toLowerCase())), [disabledMemes]);

  const toggleCategory = (category: string) => {
    if (!restrictCategories) {
      setRestrictCategories(true);
      setSelectedCategories([category]);
      return;
    }

    setSelectedCategories((current) => {
      if (current.includes(category)) {
        const next = current.filter((item) => item !== category);
        return next.length > 0 ? next : current;
      }

      return [...current, category];
    });
  };

  const selectAllCategories = () => {
    setRestrictCategories(false);
    setSelectedCategories(availableCategories);
  };

  const toggleMeme = (memeId: string) => {
    setDisabledMemes((current) => {
      const normalized = memeId.trim().toLowerCase();
      if (current.map((value) => value.trim().toLowerCase()).includes(normalized)) {
        return current.filter((value) => value.trim().toLowerCase() !== normalized);
      }
      return [...current, memeId];
    });
  };

  const copyDirective = async (directive: string) => {
    try {
      await navigator.clipboard.writeText(directive);
    } catch {
      window.alert('Clipboard access was denied.');
    }
  };

  const save = async () => {
    if (restrictCategories && selectedCategories.length === 0) {
      window.alert('Select at least one category or turn off category restriction.');
      return;
    }

    const allowedCategories = restrictCategories
      ? selectedCategories.length === availableCategories.length
        ? []
        : selectedCategories
      : [];

    await onSave({
      memes: {
        enabled,
        allowedCategories,
        disabledMemes,
      },
    });
  };

  if (!status || !library) {
    return <EmptyState title="Loading meme library" description="Waiting for the meme scanner and runtime status." />;
  }

  return (
    <div className="memes-v3">
      <SectionHeader
        title="Meme Library"
        description="Manage the local meme gallery, supported GIFs, and category filtering for replies."
        action={
          <button className="btn-v3-primary" onClick={() => void save()} disabled={isSaving} type="button">
            <Save size={18} />
            {isSaving ? 'Saving...' : 'Save Memes'}
          </button>
        }
      />

      <div className="stats-row">
        <StatCard
          icon={<Sparkles size={18} />}
          label="Library"
          value={totalMemes}
          status={enabled ? 'success' : 'warning'}
        />
        <StatCard icon={<Sparkles size={18} />} label="GIFs" value={animatedMemes} />
        <StatCard
          icon={restrictCategories ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
          label="Categories"
          value={restrictCategories ? activeCount : 'All'}
          status={restrictCategories ? 'warning' : 'success'}
        />
        <StatCard icon={<Sparkles size={18} />} label="Disabled" value={disabledCount} status={disabledCount > 0 ? 'warning' : 'success'} />
      </div>

      <div className="dashboard-grid-v3">
        <div className="card-v3">
          <div className="card-header-v3">
            <Sparkles size={20} />
            <h3>Library Settings</h3>
          </div>
          <div className="form-v3">
            <label className="check-v3">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(event) => setEnabled(event.target.checked)}
              />
              Enable meme replies
            </label>

            <div className="field-v3">
              <div className="field-row-between">
                <label>Category Restriction</label>
                <button className="btn-v3-outline btn-inline-v3" onClick={selectAllCategories} type="button">
                  Use all categories
                </button>
              </div>
              <p className="field-help">
                Leave restriction off to allow every category. Turn it on to limit replies to selected folders only.
              </p>
            </div>

            <div className="chip-grid-v3">
              {availableCategories.map((category) => {
                const active = activeCategories.includes(category);
                return (
                  <button
                    key={category}
                    type="button"
                    className={`chip-v3 ${active ? 'active' : ''}`}
                    onClick={() => toggleCategory(category)}
                    title={`Allow ${category}`}
                  >
                    {category}
                  </button>
                );
              })}
              {availableCategories.length === 0 ? (
                <EmptyState title="No memes found" description="Place images under assets/memes/<category>/ and rebuild." />
              ) : null}
            </div>
          </div>
        </div>

        <div className="card-v3">
          <div className="card-header-v3">
            <Sparkles size={20} />
            <h3>Usage Hints</h3>
          </div>
          <div className="info-list-v3">
            <InfoRow label="Reply format" value="[[meme:any]] or [[meme:happy]]" />
            <InfoRow label="Other formats" value="[[image:...]] / [[reply]]" />
            <InfoRow label="Enabled" value={status.memes.enabled ? 'Yes' : 'No'} />
            <InfoRow label="Active images" value={status.memes.active} />
            <InfoRow
              label="Allowed categories"
              value={status.memes.allowedCategories.length > 0 ? status.memes.allowedCategories.join(', ') : 'All'}
            />
            <InfoRow
              label="Available categories"
              value={status.memes.availableCategories.length > 0 ? status.memes.availableCategories.join(', ') : 'None'}
            />
            <InfoRow label="Disabled images" value={status.memes.disabled} />
          </div>
        </div>
      </div>

      <div className="card-v3">
        <div className="card-header-v3">
          <Sparkles size={20} />
          <h3>Preview Gallery</h3>
        </div>

        <div className="gallery-v3">
          {groupedMemes.map(([category, memes]) => {
            const categoryActive = activeCategories.includes(category);
            const enabledInCategory = memes.filter((meme) => !disabledSet.has(meme.id.trim().toLowerCase())).length;
            return (
              <section key={category} className={`gallery-section-v3 ${categoryActive ? 'active' : 'muted'}`}>
                <div className="gallery-section-header-v3">
                  <div>
                    <strong>{category}</strong>
                    <p>
                      {enabledInCategory}/{memes.length} enabled
                    </p>
                  </div>
                  <div className="gallery-section-actions-v3">
                    <Tag tone={categoryActive ? 'success' : 'warning'}>
                      {categoryActive ? 'Allowed' : 'Filtered'}
                    </Tag>
                    <button
                      className="btn-v3-outline btn-inline-v3"
                      onClick={() => void copyDirective(`[[meme:${category}]]`)}
                      type="button"
                    >
                      <Copy size={14} />
                      Copy directive
                    </button>
                  </div>
                </div>

                <div className="meme-grid-v3">
                  {memes.map((meme) => (
                    <MemeCard
                      key={meme.id}
                      meme={meme}
                      disabled={disabledSet.has(meme.id.trim().toLowerCase())}
                      onToggle={() => toggleMeme(meme.id)}
                      onCopy={() => void copyDirective(`[[meme:${meme.category}]]`)}
                    />
                  ))}
                </div>
              </section>
            );
          })}

          {groupedMemes.length === 0 ? (
            <EmptyState
              title="No meme assets"
              description="Drop GIF, PNG, or JPG files into assets/memes/<category>/ and restart the app."
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function MemeCard({
  meme,
  disabled,
  onToggle,
  onCopy,
}: {
  meme: MemeAsset;
  disabled: boolean;
  onToggle: () => void;
  onCopy: () => void;
}) {
  return (
    <article className={`meme-card-v3 ${disabled ? 'disabled' : ''}`}>
      <div className="meme-preview-v3">
        <img src={meme.url} alt={`${meme.category} ${meme.name}`} loading="lazy" />
      </div>
      <div className="meme-meta-v3">
        <div>
          <strong>{meme.name}</strong>
          <p>{meme.relativePath}</p>
        </div>
        <Tag tone={meme.animated ? 'warning' : 'neutral'}>{meme.animated ? 'GIF' : 'Image'}</Tag>
      </div>
      <div className="card-actions-v3">
        <button
          className="btn-v3-outline btn-inline-v3"
          onClick={onCopy}
          type="button"
        >
          <Copy size={14} />
          Copy
        </button>
        <button
          className="btn-v3-outline btn-inline-v3"
          onClick={onToggle}
          type="button"
        >
          {disabled ? 'Enable' : 'Disable'}
        </button>
      </div>
    </article>
  );
}

function InfoRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="info-row">
      <span className="i-label">{label}</span>
      <span className="i-val">{value}</span>
    </div>
  );
}
