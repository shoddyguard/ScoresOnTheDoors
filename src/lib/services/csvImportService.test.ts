import { describe, it, expect } from "vitest";
import { parsePredictionCsv } from "./csvImportService";

// ---------------------------------------------------------------------------
// Valid CSV
// ---------------------------------------------------------------------------

describe("parsePredictionCsv - valid input", () => {
  it("parses a well-formed group-match CSV into rows", () => {
    const csv = [
      "username,home_team,away_team,date,home_goals,away_goals,advancing_team",
      "alice,Mexico,South Africa,2026-06-11,2,0,",
      "bob,USA,England,2026-06-17,1,2,",
    ].join("\n");

    const { rows, errors } = parsePredictionCsv(csv);
    expect(errors).toHaveLength(0);
    expect(rows).toHaveLength(2);

    expect(rows[0]).toMatchObject({
      rowNum: 1,
      username: "alice",
      homeTeam: "Mexico",
      awayTeam: "South Africa",
      date: "2026-06-11",
      homeGoals: 2,
      awayGoals: 0,
      advancingTeam: "",
    });

    expect(rows[1]).toMatchObject({
      rowNum: 2,
      username: "bob",
      homeTeam: "USA",
      awayTeam: "England",
      date: "2026-06-17",
      homeGoals: 1,
      awayGoals: 2,
      advancingTeam: "",
    });
  });

  it("allows advancing_team to be non-empty (knockout row)", () => {
    const csv = [
      "username,home_team,away_team,date,home_goals,away_goals,advancing_team",
      "charlie,Brazil,Argentina,2026-07-02,1,1,Brazil",
    ].join("\n");

    const { rows, errors } = parsePredictionCsv(csv);
    expect(errors).toHaveLength(0);
    expect(rows[0].advancingTeam).toBe("Brazil");
  });

  it("allows advancing_team column to be absent entirely", () => {
    const csv = [
      "username,home_team,away_team,date,home_goals,away_goals",
      "alice,Mexico,South Africa,2026-06-11,2,0",
    ].join("\n");

    const { rows, errors } = parsePredictionCsv(csv);
    expect(errors).toHaveLength(0);
    expect(rows[0].advancingTeam).toBe("");
  });

  it("returns empty rows and no errors for a header-only CSV", () => {
    const csv = "username,home_team,away_team,date,home_goals,away_goals,advancing_team";
    const { rows, errors } = parsePredictionCsv(csv);
    expect(errors).toHaveLength(0);
    expect(rows).toHaveLength(0);
  });

  it("trims whitespace from values", () => {
    const csv = [
      "username,home_team,away_team,date,home_goals,away_goals,advancing_team",
      "  alice  ,  Mexico  ,  South Africa  ,  2026-06-11  ,  2  ,  0  ,  ",
    ].join("\n");

    const { rows, errors } = parsePredictionCsv(csv);
    expect(errors).toHaveLength(0);
    expect(rows[0].username).toBe("alice");
    expect(rows[0].homeTeam).toBe("Mexico");
    expect(rows[0].date).toBe("2026-06-11");
    expect(rows[0].homeGoals).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Header errors
// ---------------------------------------------------------------------------

describe("parsePredictionCsv - missing headers", () => {
  it("reports a row-0 error when a mandatory column is missing", () => {
    const csv = [
      "username,home_team,away_team,date,home_goals",
      "alice,Mexico,South Africa,2026-06-11,2",
    ].join("\n");

    const { rows, errors } = parsePredictionCsv(csv);
    expect(rows).toHaveLength(0);
    expect(errors).toHaveLength(1);
    expect(errors[0].row).toBe(0);
    expect(errors[0].message).toContain("away_goals");
  });

  it("reports a row-0 error listing all missing columns", () => {
    const csv = [
      "username,home_team",
      "alice,Mexico",
    ].join("\n");

    const { rows, errors } = parsePredictionCsv(csv);
    expect(rows).toHaveLength(0);
    expect(errors[0].row).toBe(0);
    expect(errors[0].message).toContain("away_team");
    expect(errors[0].message).toContain("date");
    expect(errors[0].message).toContain("home_goals");
    expect(errors[0].message).toContain("away_goals");
  });
});

// ---------------------------------------------------------------------------
// Row-level validation errors
// ---------------------------------------------------------------------------

describe("parsePredictionCsv - row validation errors", () => {
  const header = "username,home_team,away_team,date,home_goals,away_goals,advancing_team";

  it("reports an error for a non-numeric home_goals value", () => {
    const csv = [header, "alice,Mexico,South Africa,2026-06-11,two,0,"].join("\n");
    const { rows, errors } = parsePredictionCsv(csv);
    expect(rows).toHaveLength(0);
    expect(errors[0].row).toBe(1);
    expect(errors[0].message).toContain("home_goals");
  });

  it("reports an error for home_goals above 20", () => {
    const csv = [header, "alice,Mexico,South Africa,2026-06-11,99,0,"].join("\n");
    const { rows, errors } = parsePredictionCsv(csv);
    expect(rows).toHaveLength(0);
    expect(errors[0].row).toBe(1);
    expect(errors[0].message).toContain("home_goals");
  });

  it("reports an error for a fractional goal value", () => {
    const csv = [header, "alice,Mexico,South Africa,2026-06-11,2,0.5,"].join("\n");
    const { rows, errors } = parsePredictionCsv(csv);
    expect(rows).toHaveLength(0);
    expect(errors[0].row).toBe(1);
    expect(errors[0].message).toContain("away_goals");
  });

  it("reports an error for a negative goal value", () => {
    const csv = [header, "alice,Mexico,South Africa,2026-06-11,-1,0,"].join("\n");
    const { rows, errors } = parsePredictionCsv(csv);
    expect(rows).toHaveLength(0);
    expect(errors[0].row).toBe(1);
    expect(errors[0].message).toContain("home_goals");
  });

  it("reports an error for a malformed date", () => {
    const csv = [header, "alice,Mexico,South Africa,11-06-2026,2,0,"].join("\n");
    const { rows, errors } = parsePredictionCsv(csv);
    expect(rows).toHaveLength(0);
    expect(errors[0].row).toBe(1);
    expect(errors[0].message).toContain("date");
  });

  it("reports an error for a date with slashes", () => {
    const csv = [header, "alice,Mexico,South Africa,2026/06/11,2,0,"].join("\n");
    const { rows, errors } = parsePredictionCsv(csv);
    expect(rows).toHaveLength(0);
    expect(errors[0].row).toBe(1);
    expect(errors[0].message).toContain("date");
  });

  it("reports an error for a missing username", () => {
    const csv = [header, ",Mexico,South Africa,2026-06-11,2,0,"].join("\n");
    const { rows, errors } = parsePredictionCsv(csv);
    expect(rows).toHaveLength(0);
    expect(errors[0].row).toBe(1);
    expect(errors[0].message).toContain("username");
  });

  it("skips only the bad row; valid rows still parse", () => {
    const csv = [
      header,
      "alice,Mexico,South Africa,2026-06-11,2,0,",
      "bob,USA,England,BAD-DATE,1,2,",
      "charlie,Brazil,Argentina,2026-07-02,1,0,",
    ].join("\n");

    const { rows, errors } = parsePredictionCsv(csv);
    expect(rows).toHaveLength(2);
    expect(errors).toHaveLength(1);
    expect(errors[0].row).toBe(2);
    expect(rows.map((r) => r.username)).toEqual(["alice", "charlie"]);
  });
});
