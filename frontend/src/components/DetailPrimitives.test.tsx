import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Callout } from "./Callout";
import { ContentBlock } from "./ContentBlock";
import { DetailHeader } from "./DetailHeader";
import { FactPanel } from "./FactPanel";

describe("detail primitives", () => {
  it("DetailHeader shows title and optional edit link", () => {
    render(<DetailHeader titleThai="ฟ้าทะลายโจร" subtitle="Andrographis" editHref="/staff/herbs/1/edit" />);
    expect(screen.getByRole("heading", { name: "ฟ้าทะลายโจร" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /แก้ไข/ })).toHaveAttribute("href", "/staff/herbs/1/edit");
  });
  it("ContentBlock renders its title and body", () => {
    render(<ContentBlock titleThai="สรรพคุณ" titleEnglish="Properties">แก้ไข้</ContentBlock>);
    expect(screen.getByRole("heading", { name: /สรรพคุณ/ })).toBeInTheDocument();
    expect(screen.getByText("แก้ไข้")).toBeInTheDocument();
  });
  it("Callout renders children", () => {
    render(<Callout variant="caution">ข้อควรระวัง</Callout>);
    expect(screen.getByText("ข้อควรระวัง")).toBeInTheDocument();
  });
  it("FactPanel renders key/value facts", () => {
    render(<FactPanel title="ข้อมูล" facts={[{ key: "วงศ์", value: "Acanthaceae" }]} />);
    expect(screen.getByText("วงศ์")).toBeInTheDocument();
    expect(screen.getByText("Acanthaceae")).toBeInTheDocument();
  });
});
