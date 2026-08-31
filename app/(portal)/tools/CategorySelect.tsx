"use client";

import { useState, useTransition } from "react";
import { Input, Select } from "@/components/ui";
import { addToolCategory } from "./actions";

const ADD_NEW = "__add_new__";

export function CategorySelect({
  categories: initialCategories,
  defaultValue = "",
}: {
  categories: { id: number; name: string }[];
  defaultValue?: string;
}) {
  const [categories, setCategories] = useState(initialCategories);
  const [value, setValue] = useState(defaultValue);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function confirmNew() {
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
      setCategories((prev) => (prev.some((c) => c.id === category.id) ? prev : [...prev, category].sort((a, b) => a.name.localeCompare(b.name))));
      setValue(category.name);
      setAdding(false);
      setNewName("");
    });
  }

  if (adding) {
    return (
      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5">
          <Input
            autoFocus
            placeholder="New category name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), confirmNew())}
          />
          <button
            type="button"
            onClick={confirmNew}
            disabled={pending || !newName.trim()}
            className="flex-none rounded-lg bg-gold px-3 py-2.5 text-xs font-bold text-ink disabled:opacity-50"
          >
            {pending ? "…" : "Add"}
          </button>
          <button
            type="button"
            onClick={() => {
              setAdding(false);
              setNewName("");
              setError(null);
            }}
            className="flex-none text-xs text-charcoal hover:text-ink"
          >
            Cancel
          </button>
        </div>
        {error && <p className="text-xs font-medium text-red-600">{error}</p>}
        {/* Keeps the surrounding form submittable while composing a new category. */}
        <input type="hidden" name="category" value={value} />
      </div>
    );
  }

  return (
    <Select
      name="category"
      required
      value={value}
      onChange={(e) => {
        if (e.target.value === ADD_NEW) {
          setAdding(true);
          return;
        }
        setValue(e.target.value);
      }}
    >
      <option value="" disabled>
        Select category
      </option>
      {categories.map((c) => (
        <option key={c.id} value={c.name}>
          {c.name}
        </option>
      ))}
      <option value={ADD_NEW}>+ Add new category…</option>
    </Select>
  );
}
