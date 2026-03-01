import {
  shouldShowCheckIn,
  getCheckInContext,
  type CheckInData,
} from '../services/checkInService';

describe('checkInService', () => {
  describe('shouldShowCheckIn', () => {
    it('returns true when lastDate is null', () => {
      expect(shouldShowCheckIn(null)).toBe(true);
    });

    it('returns true when lastDate is a different day', () => {
      expect(shouldShowCheckIn('2025-01-01')).toBe(true);
    });

    it('returns false when lastDate is today', () => {
      const today = new Date().toISOString().slice(0, 10);
      expect(shouldShowCheckIn(today)).toBe(false);
    });
  });

  describe('getCheckInContext', () => {
    it('returns empty array for neutral values', () => {
      const data: CheckInData = { energy: 3, sleepQuality: 3, soreness: 3 };
      expect(getCheckInContext(data)).toEqual([]);
    });

    it('returns low energy bullet when energy <= 2', () => {
      const data: CheckInData = { energy: 2, sleepQuality: 3, soreness: 3 };
      expect(getCheckInContext(data)).toContain('Low energy noted');
    });

    it('returns poor sleep bullet when sleepQuality <= 2', () => {
      const data: CheckInData = { energy: 3, sleepQuality: 1, soreness: 3 };
      expect(getCheckInContext(data)).toContain('Poor sleep reported');
    });

    it('returns high soreness bullet when soreness >= 4', () => {
      const data: CheckInData = { energy: 3, sleepQuality: 3, soreness: 4 };
      expect(getCheckInContext(data)).toContain('High soreness noted');
    });

    it('returns multiple bullets when multiple signals present', () => {
      const data: CheckInData = { energy: 1, sleepQuality: 1, soreness: 5 };
      const bullets = getCheckInContext(data);
      expect(bullets).toHaveLength(3);
      expect(bullets).toContain('Low energy noted');
      expect(bullets).toContain('Poor sleep reported');
      expect(bullets).toContain('High soreness noted');
    });

    it('does not flag energy=3 or soreness=3 as issues', () => {
      const data: CheckInData = { energy: 3, sleepQuality: 4, soreness: 3 };
      expect(getCheckInContext(data)).toEqual([]);
    });
  });
});
