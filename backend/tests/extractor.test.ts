import { describe, expect, it } from "vitest";
import { extractWithHeuristics } from "../src/extractor.js";

describe("extractWithHeuristics", () => {
  it("maps common lead fields into CRM format", () => {
    const result = extractWithHeuristics({
      recordId: "row_1",
      row: {
        "Lead Name": "John Doe",
        Email: "john@example.com",
        Phone: "+91 9876543210",
        City: "Mumbai",
        Status: "follow up",
        Remarks: "Asked for a demo next week",
      },
    });

    expect(result.action).toBe("import");
    if (result.action !== "import") {
      return;
    }

    expect(result.crmRecord.name).toBe("John Doe");
    expect(result.crmRecord.email).toBe("john@example.com");
    expect(result.crmRecord.country_code).toBe("+91");
    expect(result.crmRecord.mobile_without_country_code).toBe("9876543210");
    expect(result.crmRecord.crm_status).toBe("GOOD_LEAD_FOLLOW_UP");
  });

  it("skips rows without email and phone", () => {
    const result = extractWithHeuristics({
      recordId: "row_2",
      row: {
        created_at: "2026-05-13 14:30:15",
        Name: "No Contact Lead",
        Company: "GrowEasy",
      },
    });

    expect(result.action).toBe("skip");
  });
});
