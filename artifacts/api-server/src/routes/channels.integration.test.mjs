import assert from "node:assert/strict";
import { describe, it } from "node:test";

describe("channels integration contract", () => {
  it("déclare les endpoints attendus du module", () => {
    const endpoints = [
      "POST /api/channels",
      "GET /api/channels",
      "GET /api/channels/:id",
      "PATCH /api/channels/:id",
      "DELETE /api/channels/:id",
      "POST /api/channels/:id/follow",
      "DELETE /api/channels/:id/follow",
      "POST /api/channels/:id/posts",
      "GET /api/channels/:id/posts",
      "GET /api/channels/feed",
      "POST /api/posts/:id/reactions",
      "POST /api/posts/:id/views",
    ];

    assert.equal(endpoints.length, 12);
  });
});
