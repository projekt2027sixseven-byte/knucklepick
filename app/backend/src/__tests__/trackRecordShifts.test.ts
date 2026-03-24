import { describe, expect, it } from "vitest";
import {
  computeTrackRecordShifts,
  NAIVE_BASELINE_1X2,
  TRACK_RECORD_MIN_N,
} from "../../../services/predictionSettlement";

describe("computeTrackRecordShifts", () => {
  it("returns zero deltas when sample below minimum", () => {
    const r = computeTrackRecordShifts(0.5, TRACK_RECORD_MIN_N - 1);
    expect(r.confidenceDelta).toBe(0);
    expect(r.trustDelta).toBe(0);
    expect(r.hitRate).toBe(0.5);
  });

  it("increases confidence and trust when hit rate beats naive baseline", () => {
    const r = computeTrackRecordShifts(0.45, 20);
    expect(r.hitRate).toBe(0.45);
    expect(r.confidenceDelta).toBeGreaterThan(0);
    expect(r.trustDelta).toBeGreaterThan(0);
  });

  it("decreases confidence and trust when hit rate lags baseline", () => {
    const r = computeTrackRecordShifts(0.22, 20);
    expect(r.confidenceDelta).toBeLessThan(0);
    expect(r.trustDelta).toBeLessThan(0);
  });

  it("baseline is neutral at 1/3", () => {
    const r = computeTrackRecordShifts(NAIVE_BASELINE_1X2, 30);
    expect(r.confidenceDelta).toBeCloseTo(0, 6);
    expect(r.trustDelta).toBeCloseTo(0, 6);
  });
});
