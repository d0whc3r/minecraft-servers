// Dashboard ↔ admin deep links: the href must survive URL encoding of server
// names (they can contain spaces or unicode), and its hash must decode to the
// exact DOM anchor id of the admin table row — that pairing is what makes the
// browser scroll to the row.
import { describe, expect, it } from "vitest";
import { adminServerAnchor, adminServerHref } from "@/lib/serverLinks";

describe("adminServerHref", () => {
  it("builds plain links for simple names", () => {
    expect(adminServerHref("vanilla")).toBe(
      "/admin?server=vanilla#admin-server-vanilla",
    );
  });

  it("encodes characters that would break the query or the hash", () => {
    const href = adminServerHref("all the mods & more");
    const [beforeHash, hash] = href.split("#");
    const query = new URLSearchParams(beforeHash.split("?")[1]);
    // The query param must round-trip, not embed raw "&" (which would split
    // the parameter) or spaces.
    expect(query.get("server")).toBe("all the mods & more");
    expect(hash).toBe(
      `admin-server-${encodeURIComponent("all the mods & more")}`,
    );
  });

  it("hash decodes to the row's DOM anchor id", () => {
    for (const name of ["vanilla", "cobblemon", "better mc bmc5"]) {
      const href = adminServerHref(name);
      const hash = href.split("#")[1];
      // Browsers percent-decode location.hash, so the decoded hash must be
      // exactly the anchor the table renders.
      expect(decodeURIComponent(hash)).toBe(adminServerAnchor(name));
    }
  });
});

describe("adminServerAnchor", () => {
  it("is the raw name behind a fixed prefix", () => {
    expect(adminServerAnchor("pixelmon")).toBe("admin-server-pixelmon");
  });
});
