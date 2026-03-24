import { describe, expect, it } from "vitest";
import { expandFrontendCorsOrigins } from "../../../config/env";

describe("expandFrontendCorsOrigins", () => {
  it("adds apex when primary is www", () => {
    const o = expandFrontendCorsOrigins("https://www.knuckleaigroup.com");
    expect(o).toContain("https://www.knuckleaigroup.com");
    expect(o).toContain("https://knuckleaigroup.com");
    expect(o.length).toBe(2);
  });

  it("adds www when primary is apex", () => {
    const o = expandFrontendCorsOrigins("https://knuckleaigroup.com");
    expect(o).toContain("https://knuckleaigroup.com");
    expect(o).toContain("https://www.knuckleaigroup.com");
  });

  it("does not duplicate localhost", () => {
    const o = expandFrontendCorsOrigins("http://localhost:3001");
    expect(o).toEqual(["http://localhost:3001"]);
  });
});
