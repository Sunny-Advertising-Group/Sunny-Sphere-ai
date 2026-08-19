// Sections that require an explicit grant in `section_access` beyond just having an account.
// Add more entries here as new restricted sections come online — no migration needed.
export const RESTRICTED_SECTIONS = [
  { key: "atl", label: "ATL" },
  { key: "digital_opti", label: "Digital Opti Tracking" },
] as const;
