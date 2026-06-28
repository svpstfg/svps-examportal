import Papa from "papaparse";

/** Trigger a browser download of a CSV file built from rows. */
export function downloadCSV(filename: string, rows: Record<string, unknown>[]) {
  if (!rows.length) {
    const blob = new Blob([""], { type: "text/csv;charset=utf-8;" });
    triggerDownload(blob, filename);
    return;
  }
  const csv = Papa.unparse(rows, { quotes: true });
  // Prepend BOM so Excel opens UTF-8 (incl. Bengali) correctly
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
  triggerDownload(blob, filename);
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Parse CSV text into rows of {name, email}. Accepts headers in any order/case. */
export function parseStudentCSV(text: string): { rows: { name: string; email: string }[]; errors: string[] } {
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase(),
  });
  const errors: string[] = parsed.errors.map((e) => `Row ${e.row}: ${e.message}`);
  const rows: { name: string; email: string }[] = [];

  for (const r of parsed.data) {
    const name = (r.name || r["full name"] || r.fullname || "").trim();
    const email = (r.email || r["e-mail"] || "").trim().toLowerCase();
    if (!email) continue;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.push(`Skipped invalid email: ${email}`);
      continue;
    }
    rows.push({ name: name || email.split("@")[0], email });
  }
  return { rows, errors };
}
