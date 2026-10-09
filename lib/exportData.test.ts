import { describe, expect, it } from 'vitest';
import { buildCsv, csvEscape, exportRidesCsv } from './exportData';

describe('csvEscape', () => {
    it('quotes and doubles embedded quotes', () => {
        expect(csvEscape('a"b')).toBe('"a""b"');
    });

    it('neutralizes spreadsheet formula injection', () => {
        expect(csvEscape('=SUM(A1:A2)')).toBe('"\'=SUM(A1:A2)"');
        expect(csvEscape('+49')).toBe('"\'+49"');
        expect(csvEscape('-1+2')).toBe('"\'-1+2"');
        expect(csvEscape('@cmd')).toBe('"\'@cmd"');
    });

    it('keeps plain values untouched', () => {
        expect(csvEscape('Trail')).toBe('"Trail"');
        expect(csvEscape(42)).toBe('"42"');
        expect(csvEscape(null)).toBe('""');
    });
});

describe('buildCsv', () => {
    it('joins with semicolons, CRLF and prepends the UTF-8 BOM', () => {
        expect(buildCsv([['a', 'b'], ['c', 'd']])).toBe('\uFEFF"a";"b"\r\n"c";"d"');
    });
});

describe('exportRidesCsv', () => {
    it('includes the header and neutralizes notes', () => {
        const csv = exportRidesCsv([{ id: '1', date: '2026-01-02', location: 'Park', notes: '=evil()' }]);
        expect(csv).toContain('"id";"date";"location"');
        expect(csv).toContain('"\'=evil()"');
    });
});
