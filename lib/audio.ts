export type AudioStatus =
  | "briefed"
  | "pointers"
  | "station"
  | "approval"
  | "ready"
  | "live"
  | "notlive";

// The production pipeline a radio/audio spot moves through, left to right.
// Colours are deliberately raw hex (not Tailwind tokens) since a couple of
// these (the greens, the mid-greys) aren't part of the app's palette.
export const AUDIO_STAGES: { key: AudioStatus; label: string; color: string }[] = [
  { key: "briefed", label: "Briefed", color: "#9E9E9E" },
  { key: "pointers", label: "Script pointers received", color: "#7A7A7A" },
  { key: "station", label: "Sent to station for production", color: "#585858" },
  { key: "approval", label: "With client for approval", color: "#FDB600" },
  { key: "ready", label: "Ready to launch", color: "#3C9E5B" },
  { key: "live", label: "Live", color: "#0A0A0A" },
  { key: "notlive", label: "Not live", color: "#C2C2C2" },
];

export const AUDIO_STATUS_OPTIONS = AUDIO_STAGES.map((s) => ({ value: s.key, label: s.label }));

const STAGE_MAP: Record<string, (typeof AUDIO_STAGES)[number]> = Object.fromEntries(
  AUDIO_STAGES.map((s) => [s.key, s]),
);

export function audioStageMeta(status: string) {
  return STAGE_MAP[status] ?? { key: status, label: status, color: "#9E9E9E" };
}

export type AudioItemRow = {
  id: number;
  client_id: number;
  estate: string;
  title: string;
  tag: string | null;
  messaging: string | null;
  placement: string | null;
  station: string | null;
  voice: string | null;
  duration: string | null;
  script_url: string | null;
  audio_url: string | null;
  live_date: string | null;
  end_date: string | null;
  status: string;
  sort_order: number;
};
