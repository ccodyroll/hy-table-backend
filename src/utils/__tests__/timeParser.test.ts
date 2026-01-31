/**
 * Unit tests for timeParser utility
 * 
 * To run these tests, install a test framework:
 *   npm install --save-dev jest @types/jest ts-jest
 * 
 * Then add to package.json:
 *   "scripts": { "test": "jest" }
 *   "jest": { "preset": "ts-jest", "testEnvironment": "node" }
 */

import { parseMeetingTimes, timeSlotsOverlap, parseTimeRange } from '../timeParser';
import { TimeSlot, DayOfWeek } from '../../types';

describe('timeParser', () => {
  describe('parseMeetingTimes', () => {
    it('should parse Airtable format: 수(15:00-17:00)', () => {
      const result = parseMeetingTimes('수(15:00-17:00)');
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        day: 'WED',
        startTime: '15:00',
        endTime: '17:00',
      });
    });

    it('should parse Korean format: 월 09:00-10:30', () => {
      const result = parseMeetingTimes('월 09:00-10:30');
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        day: 'MON',
        startTime: '09:00',
        endTime: '10:30',
      });
    });

    it('should parse multiple days: 월/수 09:00-10:30', () => {
      const result = parseMeetingTimes('월/수 09:00-10:30');
      expect(result).toHaveLength(2);
      expect(result[0].day).toBe('MON');
      expect(result[1].day).toBe('WED');
    });

    it('should parse multiple time slots: 월 09:00-10:30, 수 11:00-12:30', () => {
      const result = parseMeetingTimes('월 09:00-10:30, 수 11:00-12:30');
      expect(result).toHaveLength(2);
      expect(result[0].day).toBe('MON');
      expect(result[1].day).toBe('WED');
    });

    it('should return empty array for empty string', () => {
      const result = parseMeetingTimes('');
      expect(result).toEqual([]);
    });

    it('should return empty array for invalid format', () => {
      const result = parseMeetingTimes('invalid format');
      expect(result).toEqual([]);
    });
  });

  describe('timeSlotsOverlap', () => {
    it('should detect overlapping time slots on same day', () => {
      const slot1: TimeSlot = { day: 'MON', startTime: '09:00', endTime: '10:30' };
      const slot2: TimeSlot = { day: 'MON', startTime: '10:00', endTime: '11:30' };
      expect(timeSlotsOverlap(slot1, slot2)).toBe(true);
    });

    it('should not detect overlap on different days', () => {
      const slot1: TimeSlot = { day: 'MON', startTime: '09:00', endTime: '10:30' };
      const slot2: TimeSlot = { day: 'TUE', startTime: '09:00', endTime: '10:30' };
      expect(timeSlotsOverlap(slot1, slot2)).toBe(false);
    });

    it('should not detect overlap for non-overlapping times', () => {
      const slot1: TimeSlot = { day: 'MON', startTime: '09:00', endTime: '10:00' };
      const slot2: TimeSlot = { day: 'MON', startTime: '10:00', endTime: '11:00' };
      expect(timeSlotsOverlap(slot1, slot2)).toBe(false);
    });

    it('should detect exact boundary overlap', () => {
      const slot1: TimeSlot = { day: 'MON', startTime: '09:00', endTime: '10:00' };
      const slot2: TimeSlot = { day: 'MON', startTime: '09:59', endTime: '11:00' };
      expect(timeSlotsOverlap(slot1, slot2)).toBe(true);
    });
  });

  describe('parseTimeRange', () => {
    it('should parse time range: 09:00-10:30', () => {
      const result = parseTimeRange('09:00-10:30');
      expect(result).toEqual({ start: '09:00', end: '10:30' });
    });

    it('should parse time range with tilde: 09:00~10:30', () => {
      const result = parseTimeRange('09:00~10:30');
      expect(result).toEqual({ start: '09:00', end: '10:30' });
    });

    it('should return null for invalid format', () => {
      const result = parseTimeRange('invalid');
      expect(result).toBeNull();
    });
  });
});
