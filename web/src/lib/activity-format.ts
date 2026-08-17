import type { Activity } from "@/lib/api-types";

const TITLE_FIELDS = ["NameThai", "Name", "FullName", "Title"] as const;

const VERB_BY_ACTION: Record<string, string> = {
  created: "added",
  updated: "updated",
  deleted: "deleted",
};

function titleFromPayload(payload: Record<string, unknown>): string | null {
  for (const field of TITLE_FIELDS) {
    const value = payload[field];
    if (typeof value === "string" && value.trim() !== "") return value;
  }
  return null;
}

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

/** formatActivity turns a persisted event into a short, human-readable line. */
export function formatActivity(activity: Activity): { verb: string; title: string; when: string } {
  const [entity, action] = activity.eventName.split(".");
  return {
    verb: VERB_BY_ACTION[action] ?? action,
    title: titleFromPayload(activity.payload) ?? capitalize(entity),
    when: activity.occurredAt.slice(0, 10),
  };
}
