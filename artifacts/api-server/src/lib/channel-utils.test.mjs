import assert from "node:assert/strict";
import { describe, it } from "node:test";

function formatFollowersCount(count) {
  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(1).replace(".0", "")} M`;
  }
  if (count >= 1_000) {
    return `${(count / 1_000).toFixed(1).replace(".0", "")} K`;
  }
  return `${count}`;
}

describe("formatFollowersCount", () => {
  it("formate les milliers", () => {
    assert.equal(formatFollowersCount(442_000), "442 K");
    assert.equal(formatFollowersCount(1_300_000), "1.3 M");
  });

  it("formate les petits nombres", () => {
    assert.equal(formatFollowersCount(89), "89");
    assert.equal(formatFollowersCount(0), "0");
  });
});
