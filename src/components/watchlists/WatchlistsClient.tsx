"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { cn, scoreColor } from "@/lib/utils";
import {
  createWatchlist,
  deleteWatchlist,
  addMunicipalityToWatchlist,
  removeWatchlistItem,
} from "@/app/watchlists/actions";

interface Municipality {
  id: string; name: string; region: string; opportunity_score: number;
}

interface WatchlistItem {
  id: string;
  municipality_id: string | null;
  opportunity_id: string | null;
  created_at: string;
  municipalities: { id: string; name: string; region: string; opportunity_score: number } | null;
  opportunities: { id: string; title: string; opportunity_score: number; category: string; risk_level: string } | null;
}

interface Watchlist {
  id: string;
  name: string;
  created_at: string;
  watchlist_items: WatchlistItem[];
}

interface Props {
  initialWatchlists: Watchlist[];
  municipalities: Municipality[];
  preAddMunicipalityId?: string;
  isPro: boolean;
}

export function WatchlistsClient({ initialWatchlists, municipalities, preAddMunicipalityId, isPro }: Props) {
  const [watchlists, setWatchlists] = useState<Watchlist[]>(initialWatchlists);
  const [activeWatchlist, setActiveWatchlist] = useState<string | null>(initialWatchlists[0]?.id ?? null);
  const [newName, setNewName] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [showAddMuni, setShowAddMuni] = useState(false);
  const [muniSearch, setMuniSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Auto-open add dialog if ?add= param
  useState(() => {
    if (preAddMunicipalityId && watchlists.length > 0) {
      setShowAddMuni(true);
    }
  });

  const current = watchlists.find((w) => w.id === activeWatchlist);

  async function handleCreate() {
    if (!newName.trim()) return;
    startTransition(async () => {
      try {
        const wl = await createWatchlist(newName);
        setWatchlists((prev) => [...prev, { ...wl, watchlist_items: [] }]);
        setActiveWatchlist(wl.id);
        setNewName("");
        setShowCreate(false);
      } catch (e) { setError(e instanceof Error ? e.message : "Error"); }
    });
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this watchlist and all its items?")) return;
    startTransition(async () => {
      try {
        await deleteWatchlist(id);
        setWatchlists((prev) => prev.filter((w) => w.id !== id));
        if (activeWatchlist === id) setActiveWatchlist(watchlists.find((w) => w.id !== id)?.id ?? null);
      } catch (e) { setError(e instanceof Error ? e.message : "Error"); }
    });
  }

  async function handleAddMunicipality(municipalityId: string) {
    if (!activeWatchlist) return;
    startTransition(async () => {
      try {
        await addMunicipalityToWatchlist(activeWatchlist, municipalityId);
        const muni = municipalities.find((m) => m.id === municipalityId);
        if (muni) {
          setWatchlists((prev) => prev.map((w) =>
            w.id === activeWatchlist
              ? { ...w, watchlist_items: [...w.watchlist_items, {
                  id: `temp-${Date.now()}`, municipality_id: municipalityId,
                  opportunity_id: null, created_at: new Date().toISOString(),
                  municipalities: muni, opportunities: null,
                }] }
              : w
          ));
        }
        setShowAddMuni(false);
        setMuniSearch("");
      } catch (e) { setError(e instanceof Error ? e.message : "Error"); }
    });
  }

  async function handleRemoveItem(itemId: string) {
    startTransition(async () => {
      try {
        await removeWatchlistItem(itemId);
        setWatchlists((prev) => prev.map((w) => ({
          ...w, watchlist_items: w.watchlist_items.filter((i) => i.id !== itemId),
        })));
      } catch (e) { setError(e instanceof Error ? e.message : "Error"); }
    });
  }

  const filteredMunis = municipalities.filter((m) =>
    m.name.toLowerCase().includes(muniSearch.toLowerCase()) ||
    m.region.toLowerCase().includes(muniSearch.toLowerCase())
  );

  return (
    <div>
      {error && (
        <div className="mb-4 p-3 border border-pa-red/30 bg-pa-red/5 rounded-lg text-xs text-pa-red">
          {error} <button onClick={() => setError(null)} className="ml-2 underline">Dismiss</button>
        </div>
      )}

      {/* Watchlist tabs */}
      <div className="flex items-center gap-2 flex-wrap mb-4">
        {watchlists.map((w) => (
          <button key={w.id}
            onClick={() => setActiveWatchlist(w.id)}
            className={cn("text-sm px-4 py-1.5 rounded-full border transition-colors",
              activeWatchlist === w.id
                ? "border-pa-green/40 bg-pa-green/10 text-pa-green"
                : "border-border text-muted-foreground hover:text-foreground"
            )}
          >
            {w.name}
            <span className="ml-1.5 text-xs opacity-60">({w.watchlist_items.length})</span>
          </button>
        ))}
        <button onClick={() => setShowCreate(true)}
          className="text-sm px-3 py-1.5 rounded-full border border-dashed border-border text-muted-foreground hover:text-foreground transition-colors">
          + New
        </button>
      </div>

      {/* Create watchlist inline */}
      {showCreate && (
        <div className="mb-4 flex gap-2">
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); if (e.key === "Escape") setShowCreate(false); }}
            placeholder="Watchlist name…"
            className="flex-1 bg-secondary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-pa-green/50"
          />
          <button onClick={handleCreate} disabled={isPending}
            className="bg-pa-green text-pa-navy font-semibold text-sm px-4 py-2 rounded-lg hover:bg-pa-green/90 transition-colors disabled:opacity-60">
            Create
          </button>
          <button onClick={() => setShowCreate(false)}
            className="border border-border text-sm px-3 py-2 rounded-lg hover:bg-secondary transition-colors">
            Cancel
          </button>
        </div>
      )}

      {/* Current watchlist */}
      {current ? (
        <div className="border border-border rounded-xl bg-card overflow-hidden">
          {/* Watchlist header */}
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <div>
              <p className="font-semibold text-sm">{current.name}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{current.watchlist_items.length} item{current.watchlist_items.length !== 1 ? "s" : ""}</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowAddMuni(true)}
                className="text-xs bg-pa-green text-pa-navy font-semibold px-3 py-1.5 rounded-lg hover:bg-pa-green/90 transition-colors"
              >
                + Add municipality
              </button>
              <button onClick={() => handleDelete(current.id)}
                className="text-xs border border-border px-3 py-1.5 rounded-lg text-muted-foreground hover:text-pa-red hover:border-pa-red/30 transition-colors">
                Delete
              </button>
            </div>
          </div>

          {/* Items */}
          {current.watchlist_items.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <p className="text-sm text-muted-foreground mb-3">This watchlist is empty.</p>
              <button onClick={() => setShowAddMuni(true)}
                className="text-xs text-pa-green hover:underline">
                Add your first municipality →
              </button>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {current.watchlist_items.map((item) => {
                const m = item.municipalities;
                const o = item.opportunities;
                const slug = m?.name?.toLowerCase().replace(/[\s']/g, "-").replace(/[^a-z0-9-]/g, "") ?? "";

                return (
                  <div key={item.id} className="px-5 py-4 flex items-center justify-between gap-4 hover:bg-secondary/20 transition-colors">
                    <div className="flex-1 min-w-0">
                      {m ? (
                        <div>
                          <Link href={`/opportunities/${slug}`}
                            className="font-medium text-sm hover:text-pa-green transition-colors">
                            {m.name}
                          </Link>
                          <p className="text-xs text-muted-foreground mt-0.5">{m.region}</p>
                        </div>
                      ) : o ? (
                        <div>
                          <p className="font-medium text-sm">{o.title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{o.category} · {o.risk_level} risk</p>
                        </div>
                      ) : null}
                    </div>

                    <div className="flex items-center gap-4 flex-shrink-0">
                      {m && (
                        <div className="text-right">
                          <p className={cn("font-mono font-bold", scoreColor(m.opportunity_score))}>{m.opportunity_score}</p>
                          <p className="text-xs text-muted-foreground">score</p>
                        </div>
                      )}
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-muted-foreground">
                          {item.municipality_id ? "📍 Municipality" : "💡 Opportunity"}
                        </span>
                        <button
                          onClick={() => handleRemoveItem(item.id)}
                          disabled={isPending}
                          className="text-muted-foreground hover:text-pa-red transition-colors ml-2 text-xs"
                          aria-label="Remove"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-16 border border-dashed border-border rounded-xl">
          <p className="text-muted-foreground text-sm mb-3">No watchlists yet.</p>
          <button onClick={() => setShowCreate(true)}
            className="text-xs text-pa-green hover:underline">Create your first watchlist →</button>
        </div>
      )}

      {/* Add municipality modal */}
      {showAddMuni && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-xl w-full max-w-md shadow-2xl">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <h3 className="font-semibold text-sm">Add municipality to {current?.name}</h3>
              <button onClick={() => { setShowAddMuni(false); setMuniSearch(""); }}
                className="text-muted-foreground hover:text-foreground transition-colors">✕</button>
            </div>
            <div className="p-4">
              <input
                autoFocus
                type="text"
                placeholder="Search municipalities…"
                value={muniSearch}
                onChange={(e) => setMuniSearch(e.target.value)}
                className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-1 focus:ring-pa-green/50"
              />
              <div className="space-y-1 max-h-72 overflow-y-auto">
                {filteredMunis.map((m) => {
                  const alreadyAdded = current?.watchlist_items.some((i) => i.municipality_id === m.id);
                  return (
                    <button key={m.id}
                      disabled={alreadyAdded || isPending}
                      onClick={() => handleAddMunicipality(m.id)}
                      className={cn(
                        "w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-left transition-colors",
                        alreadyAdded
                          ? "opacity-40 cursor-not-allowed"
                          : "hover:bg-secondary"
                      )}
                    >
                      <div>
                        <p className="text-sm font-medium">{m.name}</p>
                        <p className="text-xs text-muted-foreground">{m.region}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={cn("font-mono font-semibold text-sm", scoreColor(m.opportunity_score))}>{m.opportunity_score}</span>
                        {alreadyAdded && <span className="text-xs text-muted-foreground">Added</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
