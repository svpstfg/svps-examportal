/**
 * DATE columns represent a calendar date, not an instant in time. Keep them
 * local so parsing `YYYY-MM-DD` never moves the selected day across midnight.
 */
export const parseDateOnly = (value: string | null | undefined): Date | undefined => {
  if (!value) return undefined;

  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  if (!year || !month || !day) return undefined;

  return new Date(year, month - 1, day);
};

export const formatDateOnly = (value: Date | undefined): string | null => {
  if (!value) return null;

  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};