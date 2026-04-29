/**
 * Resolves a project's program display name from the Program table (`new_name`)
 * using the project→program lookup, with fallbacks to legacy `new_programname` fields.
 */

export function normalizeDataverseId(id: string): string {
  return String(id).replace(/[{}]/g, '').toLowerCase();
}

export function buildProgramIdToNameMap(programRows: ReadonlyArray<Record<string, unknown>>): Map<string, string> {
  const m = new Map<string, string>();
  for (const p of programRows) {
    const id = p.new_programid;
    if (id === undefined || id === null) continue;
    const name = String(p.new_name ?? '').trim();
    if (!name) continue;
    m.set(normalizeDataverseId(String(id)), name);
  }
  return m;
}

/**
 * Program name for charts, filters, and joins: prefer Program.new_name via `_new_program_value` / `new_programid`.
 */
export function resolveProjectProgramName(
  row: Record<string, unknown>,
  programIdToName?: ReadonlyMap<string, string> | null,
): string {
  if (programIdToName && programIdToName.size > 0) {
    const idRaw = row._new_program_value ?? row.new_programid;
    if (idRaw !== undefined && idRaw !== null && String(idRaw).trim() !== '') {
      const n = programIdToName.get(normalizeDataverseId(String(idRaw)));
      if (n !== undefined && String(n).trim() !== '') return String(n).trim();
    }
  }
  const legacy = String(row.new_programname ?? row.crcf8_programname ?? '').trim();
  if (legacy) return legacy;
  return 'Unassigned';
}
