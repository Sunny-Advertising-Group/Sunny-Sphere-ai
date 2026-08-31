"use client";

import { useState, useTransition } from "react";
import { Pencil, Tag, Trash2, X } from "lucide-react";
import { deleteToolCategory, renameToolCategory } from "@/lib/actions/admin";
import { addToolCategory } from "../tools/actions";
import { Button, Card, EmptyState, Input } from "@/components/ui";

export type ToolCategory = { id: number; name: string };

export function ToolCategoriesManager({ categories }: { categories: ToolCategory[] }) {
  const [items, setItems] = useState(categories);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [, startTransition] = useTransition();

  function add() {
    const trimmed = newName.trim();
    if (!trimmed) return;
    setError(null);
    startTransition(async () => {
      const result = await addToolCategory(trimmed);
      if (result?.error) {
        setError(result.error);
        return;
      }
      const category = result.category!;
      setItems((prev) => (prev.some((c) => c.id === category.id) ? prev : [...prev, category].sort((a, b) => a.name.localeCompare(b.name))));
      setNewName("");
    });
  }

  function rename(id: number, name: string) {
    setItems((prev) => prev.map((c) => (c.id === id ? { ...c, name } : c)));
    startTransition(async () => {
      const result = await renameToolCategory(id, name);
      if (result?.error) setError(result.error);
    });
  }

  function remove(id: number) {
    if (!confirm("Delete this category? Tools already using it keep their label — it just won't be selectable for new tools.")) return;
    setItems((prev) => prev.filter((c) => c.id !== id));
    startTransition(async () => {
      const result = await deleteToolCategory(id);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="space-y-3">
      {error && <p className="text-sm font-medium text-red-600">{error}</p>}
      {items.length === 0 ? (
        <EmptyState icon={Tag} title="No categories yet" />
      ) : (
        <div className="space-y-2">
          {items.map((category) => (
            <CategoryRow key={category.id} category={category} onRename={rename} onDelete={remove} />
          ))}
        </div>
      )}
      <Card className="flex items-center gap-2 py-3">
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="New category name"
        />
        <Button type="button" onClick={add} disabled={!newName.trim()} className="flex-none px-3 py-2 text-xs">
          Add
        </Button>
      </Card>
    </div>
  );
}

function CategoryRow({
  category,
  onRename,
  onDelete,
}: {
  category: ToolCategory;
  onRename: (id: number, name: string) => void;
  onDelete: (id: number) => void;
}) {
  const [editing, setEditing] = useState(false);

  return (
    <Card className="flex items-center justify-between gap-3 py-2.5">
      {editing ? (
        <input
          autoFocus
          defaultValue={category.name}
          onBlur={(e) => {
            setEditing(false);
            if (e.target.value.trim() && e.target.value !== category.name) onRename(category.id, e.target.value.trim());
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            if (e.key === "Escape") setEditing(false);
          }}
          className="w-full rounded-lg border border-border-c px-2 py-1 text-sm text-ink outline-none focus:border-gold"
        />
      ) : (
        <span className="text-sm font-medium text-ink">{category.name}</span>
      )}
      <div className="flex flex-none items-center gap-2">
        {editing ? (
          <button onClick={() => setEditing(false)} aria-label="Cancel" className="text-charcoal hover:text-ink">
            <X className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
        ) : (
          <button onClick={() => setEditing(true)} aria-label="Rename category" className="text-charcoal hover:text-gold">
            <Pencil className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
        )}
        <button onClick={() => onDelete(category.id)} aria-label="Delete category" className="text-charcoal hover:text-red-600">
          <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
        </button>
      </div>
    </Card>
  );
}
