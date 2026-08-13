import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DefinitionList } from "./DefinitionList";

describe("DefinitionList", () => {
  it("shows non-empty terms and hides empty ones", () => {
    render(
      <DefinitionList
        items={[
          { term: "สรรพคุณ", value: "แก้ไข้" },
          { term: "หมายเหตุ", value: "" },
        ]}
      />,
    );
    expect(screen.getByText("สรรพคุณ")).toBeInTheDocument();
    expect(screen.getByText("แก้ไข้")).toBeInTheDocument();
    expect(screen.queryByText("หมายเหตุ")).toBeNull();
  });
});
