import { describe, expect, it } from "vitest";

import { formatActivity } from "@/lib/activity-format";

describe("formatActivity", () => {
  it("maps *.created to 'added' and takes the title from payload.Name", () => {
    const result = formatActivity({
      id: 1,
      eventName: "remedy.created",
      occurredAt: "2026-08-01T10:00:00Z",
      payload: { Name: "ยาแก้ไข้" },
    });
    expect(result).toEqual({ verb: "added", title: "ยาแก้ไข้", when: "2026-08-01" });
  });

  it("maps *.updated to 'updated' and prefers NameThai over Name", () => {
    const result = formatActivity({
      id: 2,
      eventName: "healer.updated",
      occurredAt: "2026-08-02T10:00:00Z",
      payload: { NameThai: "หมอ ก", Name: "should not win" },
    });
    expect(result.verb).toBe("updated");
    expect(result.title).toBe("หมอ ก");
  });

  it("maps *.deleted to 'deleted' and falls back to the entity noun when no title field is present", () => {
    const result = formatActivity({
      id: 3,
      eventName: "district.deleted",
      occurredAt: "2026-08-03T10:00:00Z",
      payload: {},
    });
    expect(result).toEqual({ verb: "deleted", title: "District", when: "2026-08-03" });
  });

  it("falls back to the entity noun when the title field is an empty string", () => {
    const result = formatActivity({
      id: 4,
      eventName: "province.created",
      occurredAt: "2026-08-04T10:00:00Z",
      payload: { Name: "  " },
    });
    expect(result.title).toBe("Province");
  });
});
