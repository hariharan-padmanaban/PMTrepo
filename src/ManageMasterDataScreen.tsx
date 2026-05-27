import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { EnjazMasterDataService, type EnjazMasterDataRow } from './services/EnjazMasterDataService';
import { NotificationToast, type ToastType } from './NotificationToast';
import { New_enjazmasterdatasService } from './generated/services/New_enjazmasterdatasService';
import { PagerBar } from './PagerBar';
import { enj } from './ui/enjForm';

const CATEGORIES = [
  'Program Code',
  'KPI',
  'Benefits',
  'Project Category',
  'Sector',
  'Milestone',
  'Project Code',
  'Stage',
  'Report Type',
  'Specialization',
  'Meeting Category',
  'Deliverables',
  'Industry',
  'Country',
  'Region',
  'Currency',
  'Time',
  'Shift',
  'Holiday',
  'Methodology',
] as const;

type FormState = {
  name: string;
  code: string;
  codeNumeric: string;
  status: 'Active' | 'Inactive';
};

const EMPTY_FORM: FormState = {
  name: '',
  code: '',
  codeNumeric: '',
  status: 'Active',
};

function codeNumber(row: EnjazMasterDataRow): number {
  const raw = String(row.new_code ?? '').trim();
  const prefixed = raw.match(/^[A-Za-z](\d+)$/);
  if (prefixed) {
    const parsed = Number(prefixed[1]);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  const v = Number(raw || 0);
  return Number.isNaN(v) ? 0 : v;
}

const CATEGORY_BY_VALUE = new Map<number, string>(
  CATEGORIES.map((label, idx) => [100000000 + idx, label]),
);
const CATEGORY_BY_LABEL = new Map<string, number>(
  CATEGORIES.map((label, idx) => [label, 100000000 + idx]),
);

function categoryText(row: EnjazMasterDataRow): string {
  const named = String(row.new_categoryname ?? '').trim();
  if (named) return named;
  const raw = row.new_category;
  const num = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isNaN(num) && CATEGORY_BY_VALUE.has(num)) return CATEGORY_BY_VALUE.get(num)!;
  return String(raw ?? '');
}

function statusText(row: EnjazMasterDataRow): 'Active' | 'Inactive' {
  const raw = String(row.new_statusname ?? row.new_status ?? '').toLowerCase();
  if (raw.includes('inactive') || raw === '100000001' || raw === '1') return 'Inactive';
  return 'Active';
}

function fallbackGuid() {
  const template = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx';
  return template.replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function codePrefixForCategory(category: string): 'P' | 'S' | null {
  if (category === 'Project Category') return 'P';
  if (category === 'Sector') return 'S';
  return null;
}

function isSpecialCategory(category: string): boolean {
  return codePrefixForCategory(category) !== null;
}

function optionsFromMetadataAttribute(attrs: Array<Record<string, unknown>>, logicalName: string): Array<{ label: string; value: number }> {
  const target = logicalName.toLowerCase();
  const attr = attrs.find((a) => {
    const attrName = String(a.LogicalName ?? a.logicalName ?? '').toLowerCase();
    return attrName === target;
  });

  if (!attr) return [];

  // Extract OptionSet/options from attribute
  const optionSet = (
    (attr?.OptionSet as { Options?: Array<Record<string, unknown>>; options?: Array<Record<string, unknown>> } | undefined)
    ?? (attr?.optionSet as { Options?: Array<Record<string, unknown>>; options?: Array<Record<string, unknown>> } | undefined)
    ?? {}
  ) as Record<string, unknown>;

  const options = (
    optionSet.Options
    ?? optionSet.options
    ?? (attr?.Options as Array<Record<string, unknown>> | undefined)
    ?? (attr?.options as Array<Record<string, unknown>> | undefined)
    ?? []
  ) as Array<Record<string, unknown>>;

  return options
    .map((opt) => {
      const value = Number(opt.Value ?? opt.value ?? NaN);
      // Extract label from Label object or as direct string
      const label =
        String(
          (opt.Label as { UserLocalizedLabel?: { Label?: string } } | undefined)?.UserLocalizedLabel?.Label
          ?? (opt.Label as { LocalizedLabels?: Array<{ Label?: string }> } | undefined)?.LocalizedLabels?.[0]?.Label
          ?? (opt.label as string | undefined)
          ?? (opt.DisplayName as string | undefined)
          ?? (opt.displayName as string | undefined)
          ?? (opt.Text as string | undefined)
          ?? (opt.text as string | undefined)
          ?? '',
        ).trim();
      if (!label || Number.isNaN(value)) return null;
      return { label, value };
    })
    .filter((x): x is { label: string; value: number } => Boolean(x));
}

type ManageMasterDataScreenProps = {
  /** When true, no outer “Manage Master Data” title or card border — used inside **Manage Data**. */
  embeddedInManageData?: boolean;
};

export default function ManageMasterDataScreen({ embeddedInManageData = false }: ManageMasterDataScreenProps) {
  const [rows, setRows] = useState<EnjazMasterDataRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>(CATEGORIES[0]);
  const [searchText, setSearchText] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingCategoryValue, setEditingCategoryValue] = useState<string | number | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [pendingDelete, setPendingDelete] = useState<EnjazMasterDataRow | null>(null);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 6;
  const [categoryOptions, setCategoryOptions] = useState<Array<{ label: string; value: number }>>([]);
  const categoryValueByLabel = useMemo(() => new Map(categoryOptions.map((o) => [o.label, o.value] as const)), [categoryOptions]);
  const categoryLabelByValue = useMemo(() => new Map(categoryOptions.map((o) => [o.value, o.label] as const)), [categoryOptions]);

  const categoryTextForRow = useCallback((row: EnjazMasterDataRow): string => {
    const named = String(row.new_categoryname ?? '').trim();
    if (named) return named;
    const typed = String(row.new_categorytype ?? '').trim();
    if (typed) return typed;
    const raw = row.new_category;
    const num = typeof raw === 'number' ? raw : Number(raw);
    if (!Number.isNaN(num) && categoryLabelByValue.has(num)) return categoryLabelByValue.get(num)!;
    return String(raw ?? '');
  }, [categoryLabelByValue]);

  const sortedCategories = useMemo(() => {
    // Combine categories from multiple sources, with metadata as primary
    const categories = new Set<string>();

    // Add categories from Dataverse metadata (primary - includes new/custom values)
    categoryOptions.forEach((o) => categories.add(o.label));

    // Add categories from existing data in the table (ensures we show categories that are already in use)
    rows
      .map((r) => categoryTextForRow(r))
      .filter((v) => Boolean(v) && !/^\d+$/.test(v))
      .forEach((cat) => categories.add(cat));

    // Add hardcoded categories as fallback (only if metadata load failed)
    if (categories.size === 0) {
      CATEGORIES.forEach((cat) => categories.add(cat));
    }

    return Array.from(categories).sort((a, b) => a.localeCompare(b));
  }, [rows, categoryOptions, categoryTextForRow]);
  const [toast, setToast] = useState<{ type: ToastType; message: string } | null>(null);

  const loadRows = useCallback(async () => {
    setLoading(true);
    setMessage('');
    try {
      const res = await EnjazMasterDataService.getAll({
        top: 1000,
        orderBy: ['new_code asc'],
      });
      if (!res.success) throw new Error(res.error?.message ?? 'Failed to load master data');
      setRows(res.data ?? []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to load master data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  useEffect(() => {
    const loadCategoryOptions = async () => {
      try {
        const metaRes = await New_enjazmasterdatasService.getMetadata();
        let attrs: Array<Record<string, unknown>> = [];

        // Try multiple possible metadata response structures following the pattern from App.tsx
        if (metaRes && typeof metaRes === 'object') {
          // Extract attributes from various possible response structures
          const meta = (metaRes as { data?: unknown })?.data as { Attributes?: Array<Record<string, unknown>> } | undefined;
          attrs = meta?.Attributes ?? (metaRes as any)?.Attributes ?? (metaRes as any)?.MetadataEntityMetadata?.Attributes ?? [];
        }

        // Extract category options from metadata
        const categoryChoices = optionsFromMetadataAttribute(attrs, 'new_category');

        // Always update categoryOptions, even if empty, to ensure state is fresh
        setCategoryOptions(categoryChoices);
      } catch (error) {
        // Keep empty array when metadata is unavailable - fallback will handle it
        setCategoryOptions([]);
      }
    };
    void loadCategoryOptions();
  }, []);

  useEffect(() => {
    if (sortedCategories.length === 0) return;
    if (!sortedCategories.includes(selectedCategory)) setSelectedCategory(sortedCategories[0]);
  }, [selectedCategory, sortedCategories]);

  const filtered = useMemo(() => {
    return rows
      .filter((r) => categoryTextForRow(r).toLowerCase() === selectedCategory.toLowerCase())
      .filter((r) => (r.new_enjazmasterdata1 ?? '').toString().toLowerCase().includes(searchText.trim().toLowerCase()))
      .sort((a, b) => codeNumber(a) - codeNumber(b));
  }, [rows, selectedCategory, searchText, categoryTextForRow]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageSafe = Math.min(Math.max(1, page), totalPages);
  const pagedRows = useMemo(() => {
    const start = (pageSafe - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, pageSafe]);

  useEffect(() => {
    setPage(1);
  }, [selectedCategory, searchText]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const nextAutoCodeForCategory = useCallback(
    (category: string) => {
      const prefix = codePrefixForCategory(category);
      if (prefix) {
        const used = rows
          .filter((r) => categoryText(r) === category)
          .map((r) => String(r.new_code ?? '').trim())
          .map((code) => {
            const match = code.match(new RegExp(`^${prefix}(\\d+)$`, 'i'));
            return match ? Number(match[1]) : NaN;
          })
          .filter((n) => Number.isFinite(n) && n >= 0);
        const next = used.length === 0 ? 1 : Math.max(...used) + 1;
        return `${prefix}${next}`;
      }

      // For all non-special categories, maintain one global numeric sequence.
      const used = rows
        .filter((r) => !isSpecialCategory(categoryTextForRow(r)))
        .map((r) => Number(r.new_code ?? NaN))
        .filter((n) => Number.isFinite(n) && n >= 0);
      const next = used.length === 0 ? 1 : Math.max(...used) + 1;
      return String(next);
    },
    [rows, categoryTextForRow],
  );

  const nextCodeFromRows = useCallback((allRows: EnjazMasterDataRow[], category: string) => {
    const prefix = codePrefixForCategory(category);
    if (prefix) {
      const used = allRows
        .filter((r) => categoryTextForRow(r) === category)
        .map((r) => String(r.new_uniqueid ?? '').trim() || `${prefix}${String(r.new_code ?? '').trim()}`)
        .map((code) => {
          const match = code.match(new RegExp(`^${prefix}(\\d+)$`, 'i'));
          return match ? Number(match[1]) : NaN;
        })
        .filter((n) => Number.isFinite(n) && n >= 0);
      return `${prefix}${(used.length === 0 ? 1 : Math.max(...used) + 1)}`;
    }
    const used = allRows
      .filter((r) => !isSpecialCategory(categoryTextForRow(r)))
      .map((r) => Number(r.new_code ?? NaN))
      .filter((n) => Number.isFinite(n) && n >= 0);
    return String(used.length === 0 ? 1 : Math.max(...used) + 1);
  }, [categoryTextForRow]);

  const getAllRowsLatest = useCallback(async () => {
    const res = await EnjazMasterDataService.getAll({
      top: 1000,
      orderBy: ['new_code asc'],
    });
    if (!res.success) throw new Error(res.error?.message ?? 'Failed to load master data');
    return res.data ?? [];
  }, []);

  const displayCodeForRow = useCallback((row: EnjazMasterDataRow) => {
    const cat = categoryTextForRow(row);
    if (isSpecialCategory(cat)) {
      const explicit = String(row.new_uniqueid ?? '').trim();
      if (explicit) return explicit;
      const prefix = codePrefixForCategory(cat);
      const n = Number(row.new_code ?? NaN);
      if (prefix && Number.isFinite(n)) return `${prefix}${n}`;
    }
    return String(row.new_code ?? '-');
  }, [categoryTextForRow]);

  const openAdd = () => {
    setEditingId(null);
    setEditingCategoryValue(null);
    const generatedCode = nextAutoCodeForCategory(selectedCategory);
    setForm({
      ...EMPTY_FORM,
      code: String(generatedCode),
      codeNumeric: String(generatedCode).replace(/^\D+/, ''),
    });
    setErrors({});
    setShowForm(true);
  };

  const openEdit = (row: EnjazMasterDataRow) => {
    setEditingId(String(row.new_enjazmasterdataid ?? ''));
    setEditingCategoryValue((row.new_category as string | number | undefined) ?? null);
    setForm({
      name: String(row.new_enjazmasterdata1 ?? ''),
      code: displayCodeForRow(row),
      codeNumeric: String(row.new_code ?? '').trim(),
      status: statusText(row),
    });
    setErrors({});
    setShowForm(true);
  };

  const validate = () => {
    const next: Partial<Record<keyof FormState, string>> = {};
    if (!form.name.trim()) next.name = 'Field Name is required';
    // Edit: Code (ID) is read-only — invalid or duplicate IDs are fixed at save (regenerated).
    if (editingId) {
      setErrors(next);
      return Object.keys(next).length === 0;
    }

    const codeRaw = form.code.trim();
    const codeNumRaw = form.codeNumeric.trim();
    const prefix = codePrefixForCategory(selectedCategory);
    if (!codeRaw) {
      next.code = prefix ? `ID must follow ${prefix} format` : 'ID must be a number';
    } else if (!prefix) {
      const code = Number(codeRaw);
      if (Number.isNaN(code)) {
        next.code = 'ID must be a number';
      } else if (code < 0) {
        next.code = 'ID cannot be negative';
      }
    } else {
      const ok = new RegExp(`^${prefix}\\d+$`, 'i').test(codeRaw);
      if (!ok) next.code = `ID must follow ${prefix} format`;
      if (!codeNumRaw || Number.isNaN(Number(codeNumRaw))) next.code = `ID must follow ${prefix} format`;
    }

    const duplicate = rows.some((r) => {
      const rowCategory = categoryTextForRow(r);
      const sameCategory = rowCategory === selectedCategory;
      const selectedIsSpecial = isSpecialCategory(selectedCategory);
      const rowIsSpecial = isSpecialCategory(rowCategory);
      const sameCode = selectedIsSpecial
        ? displayCodeForRow(r).trim().toLowerCase() === codeRaw.toLowerCase()
        : Number(r.new_code ?? NaN) === Number(codeRaw);
      const sameRecord = editingId && String(r.new_enjazmasterdataid ?? '') === editingId;
      if (sameRecord) return false;
      if (selectedIsSpecial) return sameCategory && sameCode;
      // Non-special categories must be globally unique across all non-special categories.
      return !rowIsSpecial && sameCode;
    });
    if (!next.code && duplicate) next.code = 'ID already exists in this category';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setBusy(true);
    setMessage('');
    try {
      const recordName = form.name.trim();
      const latestRows = await getAllRowsLatest();
      const existingCategoryValue = latestRows.find((r) => categoryTextForRow(r) === selectedCategory)?.new_category;
      const mappedCategoryValue = categoryValueByLabel.get(selectedCategory);
      const resolvedCategoryValue = editingCategoryValue ?? existingCategoryValue ?? mappedCategoryValue ?? CATEGORY_BY_LABEL.get(selectedCategory) ?? selectedCategory;
      // Recompute at submit time to reduce race conditions across multiple users.
      let finalCode: string;
      /** Edit: Code field is read-only — regenerate when empty/invalid or when another row already uses this ID (global for non-special). */
      let idRegenerated = false;
      if (editingId) {
        const rowsWithoutSelf = latestRows.filter((r) => String(r.new_enjazmasterdataid ?? '') !== editingId);

        const codeConflictsOther = (code: string) =>
          latestRows.some((r) => {
            if (String(r.new_enjazmasterdataid ?? '') === editingId) return false;
            const rowCategory = categoryTextForRow(r);
            const selectedIsSpecial = isSpecialCategory(selectedCategory);
            const rowIsSpecial = isSpecialCategory(rowCategory);
            if (selectedIsSpecial) {
              return rowCategory === selectedCategory && displayCodeForRow(r).trim().toLowerCase() === code.trim().toLowerCase();
            }
            return !rowIsSpecial && Number(r.new_code ?? NaN) === Number(code);
          });

        const proposed = form.code.trim();
        const codeNumRaw = form.codeNumeric.trim();
        const prefix = codePrefixForCategory(selectedCategory);
        const proposedInvalid =
          !proposed ||
          (!prefix
            ? (() => {
                const n = Number(proposed);
                return Number.isNaN(n) || n < 0;
              })()
            : !new RegExp(`^${prefix}\\d+$`, 'i').test(proposed) || !codeNumRaw || Number.isNaN(Number(codeNumRaw)));

        finalCode = proposed;
        if (proposedInvalid || codeConflictsOther(finalCode)) {
          finalCode = nextCodeFromRows(rowsWithoutSelf, selectedCategory);
          idRegenerated = true;
        }
      } else {
        finalCode = nextCodeFromRows(latestRows, selectedCategory);
      }
      const finalCodeNumeric = Number(finalCode.replace(/^\D+/, ''));
      const hasDuplicate = latestRows.some((r) => {
        if (editingId && String(r.new_enjazmasterdataid ?? '') === editingId) return false;
        const rowCategory = categoryTextForRow(r);
        const selectedIsSpecial = isSpecialCategory(selectedCategory);
        const rowIsSpecial = isSpecialCategory(rowCategory);
        if (selectedIsSpecial) {
          return rowCategory === selectedCategory && displayCodeForRow(r).trim().toLowerCase() === finalCode.toLowerCase();
        }
        return !rowIsSpecial && Number(r.new_code ?? NaN) === Number(finalCode);
      });
      if (hasDuplicate) {
        throw new Error('ID already exists. Please try again.');
      }
      if (categoryOptions.length > 0 && mappedCategoryValue === undefined) {
        throw new Error(`Category '${selectedCategory}' is not valid in Dataverse choices.`);
      }
      const payload = {
        new_enjazmasterdata1: recordName,
        new_category: resolvedCategoryValue,
        new_categorytype: selectedCategory,
        new_code: finalCodeNumeric,
        ...(isSpecialCategory(selectedCategory) ? { new_uniqueid: finalCode.toUpperCase() } : {}),
      };
      if (editingId) {
        let res = await EnjazMasterDataService.update(editingId, {
          ...payload,
          // Dataverse PicklistType in this schema expects label text.
          new_status: form.status,
        });
        if (!res.success) {
          res = await EnjazMasterDataService.update(editingId, {
            ...payload,
            new_category: mappedCategoryValue ?? resolvedCategoryValue,
            new_status: form.status === 'Active' ? 100000000 : 100000001,
          });
        }
        if (!res.success) throw new Error(res.error?.message ?? 'Update failed');
        setToast({
          type: 'success',
          message: idRegenerated
            ? `${selectedCategory} updated. Reference ID was set to ${finalCode}.`
            : `${selectedCategory} updated successfully.`,
        });
      } else {
        let createSucceeded = false;
        let lastErr = 'Create failed';
        for (let attempt = 0; attempt < 3 && !createSucceeded; attempt += 1) {
          const attemptRows = attempt === 0 ? latestRows : await getAllRowsLatest();
          const attemptCode = nextCodeFromRows(attemptRows, selectedCategory);
          const attemptPayload = {
            ...payload,
            new_code: Number(attemptCode.replace(/^\D+/, '')),
            ...(isSpecialCategory(selectedCategory) ? { new_uniqueid: attemptCode.toUpperCase() } : {}),
          };
          let res = await EnjazMasterDataService.create({
            ...attemptPayload,
            new_status: 'Active',
          });
          if (!res.success) {
            res = await EnjazMasterDataService.create({
              ...attemptPayload,
              new_category: mappedCategoryValue ?? resolvedCategoryValue,
              new_status: 100000000,
              new_enjazmasterdataid: globalThis.crypto?.randomUUID?.() ?? fallbackGuid(),
            });
          }
          if (res.success) {
            createSucceeded = true;
            break;
          }
          lastErr = res.error?.message ?? lastErr;
        }
        if (!createSucceeded) throw new Error(lastErr);
        setToast({ type: 'success', message: `${selectedCategory} created successfully.` });
      }
      setShowForm(false);
      setForm(EMPTY_FORM);
      await loadRows();
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Save failed';
      setMessage(msg);
      setToast({ type: 'error', message: msg });
    } finally {
      setBusy(false);
    }
  };

  const removeRow = async (row: EnjazMasterDataRow) => {
    const id = String(row.new_enjazmasterdataid ?? '');
    if (!id) return;
    setBusy(true);
    setMessage('');
    try {
      await EnjazMasterDataService.delete(id);
      await loadRows();
      setToast({ type: 'info', message: 'Record deleted successfully.' });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Delete failed');
      setToast({ type: 'error', message: error instanceof Error ? error.message : 'Delete failed' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      className={
        embeddedInManageData
          ? 'flex h-full min-h-0 w-full min-w-0 flex-1 flex-col p-0 border-0 bg-transparent shadow-none'
          : 'rounded-xl border border-gray-100 bg-white p-4 shadow-sm'
      }
    >
      {toast && <NotificationToast type={toast.type} message={toast.message} onClose={() => setToast(null)} />}
      {!embeddedInManageData && <h2 className="enj-screen-header mb-3">Manage Master Data</h2>}
      <p className={embeddedInManageData ? 'mb-3 shrink-0 text-xs leading-relaxed text-gray-600' : 'mb-3 text-sm text-gray-600'}>{`Manage '${selectedCategory}'`}</p>
      <div
        className={
          embeddedInManageData
            ? 'grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-hidden lg:grid-cols-[220px_1fr]'
            : 'grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4'
        }
      >
        <aside
          className={
            embeddedInManageData
              ? 'flex max-h-40 flex-col gap-1.5 overflow-auto rounded-lg border border-gray-100 bg-gray-50 p-2 lg:max-h-none'
              : 'flex max-h-[70vh] flex-col gap-1.5 overflow-auto rounded-lg border border-gray-100 bg-gray-50 p-2'
          }
        >
          {sortedCategories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`w-full rounded-md px-3 py-2 text-left text-sm ${
                selectedCategory === cat ? 'bg-primary text-white' : 'text-gray-700 hover:bg-white'
              }`}
            >
              {cat}
            </button>
          ))}
        </aside>

        <div className={embeddedInManageData ? 'flex min-h-0 min-w-0 flex-1 flex-col gap-2 overflow-hidden' : 'space-y-3'}>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
            <div className="relative w-full sm:w-[200px]">
              <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Search"
                className={`${enj.control} pl-8 text-xs`}
              />
            </div>
            <button type="button" onClick={openAdd} className={`${enj.btnPrimary} shrink-0 px-3`}>
              <Plus size={14} />
              Add New
            </button>
          </div>

          {message && <p className="text-sm text-gray-700">{message}</p>}

          {loading ? (
            <div className="rounded-lg border border-gray-100 p-6 text-sm text-gray-500">Loading records...</div>
          ) : filtered.length === 0 ? (
            <div className="rounded-lg border border-gray-100 p-6 text-sm text-gray-500">No records found.</div>
          ) : (
            <>
            <div
              className={
                embeddedInManageData
                  ? 'grid min-h-0 min-w-0 flex-1 grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3 md:grid-rows-2 md:gap-3'
                  : 'grid content-start items-start grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3'
              }
            >
              {pagedRows.map((row) => (
                <article
                  key={String(row.new_enjazmasterdataid ?? `${row.new_enjazmasterdata1}-${row.new_code}`)}
                  className={`w-full max-w-full rounded-xl border border-gray-100 bg-white p-3 shadow-sm ${
                    embeddedInManageData ? 'flex h-full min-h-0 flex-col self-stretch overflow-hidden' : 'self-start'
                  }`}
                >
                  <div className="flex items-start justify-between gap-1">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold leading-snug text-primary">{String(row.new_enjazmasterdata1 ?? '-')}</p>
                      <p className="mt-0.5 text-[10px] leading-relaxed text-gray-500">ID: {displayCodeForRow(row)}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <span className={`${enj.badge} ${statusText(row) === 'Active' ? enj.badgeSuccess : enj.badgeNeutral}`}>
                        {statusText(row)}
                      </span>
                      <button
                        type="button"
                        onClick={() => openEdit(row)}
                        className="h-6 w-6 rounded-md border border-gray-200 inline-flex items-center justify-center text-gray-600 hover:bg-gray-50"
                        aria-label="Edit record"
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setPendingDelete(row)}
                        className="h-6 w-6 rounded-md border border-rose-200 inline-flex items-center justify-center text-rose-600 hover:bg-rose-50"
                        aria-label="Delete record"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                  <div className="mt-1.5 border-t border-gray-100 pt-1.5">
                    <p className="text-[10px] leading-relaxed text-gray-600">
                      <span className="font-semibold text-gray-800">Category Type :</span>{' '}
                      <span className="text-gray-700">{categoryTextForRow(row)}</span>
                    </p>
                  </div>
                </article>
              ))}
            </div>
            <PagerBar
              className="shrink-0 border-t border-gray-100 pt-3"
              page={pageSafe}
              pageSize={PAGE_SIZE}
              total={filtered.length}
              onPrev={() => setPage((p) => Math.max(1, p - 1))}
              onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={loading}
            />
            </>
          )}
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-[240] flex items-center justify-center bg-black/40 p-4" role="presentation" onClick={() => setShowForm(false)}>
          <div className="w-full max-w-xl rounded-xl border border-gray-100 bg-white p-5 shadow-xl" role="dialog" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="enj-screen-subheader">
                {editingId ? `Edit '${selectedCategory}'` : `Add '${selectedCategory}'`}
              </h3>
              <button type="button" onClick={() => setShowForm(false)} className="h-8 w-8 rounded-md hover:bg-gray-100 inline-flex items-center justify-center">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label>
                <span className="text-xs text-gray-600">Name *</span>
                <input className={`mt-1 ${enj.control}`} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
                {errors.name && <p className="text-[11px] text-red-600 mt-1">{errors.name}</p>}
              </label>
              <label>
                <span className="text-xs text-gray-600">Code (ID) *</span>
                <input
                  type="text"
                  readOnly
                  className={`mt-1 ${enj.control}`}
                  value={form.code}
                />
                {errors.code && <p className="text-[11px] text-red-600 mt-1">{errors.code}</p>}
              </label>
              {editingId && (
                <label>
                  <span className="text-xs text-gray-600">Status</span>
                  <select className={`mt-1 ${enj.control}`} value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as FormState['status'] }))}>
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </label>
              )}
              <div className="md:col-span-2 flex justify-end gap-2">
                <button type="button" onClick={() => setShowForm(false)} className={enj.btnOutline}>Cancel</button>
                <button type="submit" disabled={busy} className={enj.btnPrimary}>
                  {busy ? 'Saving...' : editingId ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {pendingDelete && (
        <div
          className="fixed inset-0 z-[250] flex items-center justify-center bg-black/40 p-4"
          role="presentation"
          onClick={() => setPendingDelete(null)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-gray-100 bg-white p-5 shadow-xl"
            role="dialog"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="enj-screen-subheader">Confirm Delete</h3>
            <p className="mt-2 text-sm text-gray-600">Do you want to delete this item?</p>
            <p className="mt-1 text-sm text-gray-500">{String(pendingDelete.new_enjazmasterdata1 ?? 'Record')}</p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingDelete(null)}
                className={enj.btnDefault}
              >
                No
              </button>
              <button
                type="button"
                onClick={async () => {
                  const row = pendingDelete;
                  setPendingDelete(null);
                  if (row) await removeRow(row);
                }}
                className={enj.btnDanger}
              >
                Yes
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
