// Validates: capture-and-export R1.4 (property: no generated private-range address is ever accepted)
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { isPublicAddress } from './url-guard.ts';

const octet = fc.integer({ min: 0, max: 255 });
const hex16 = fc.integer({ min: 0, max: 0xffff }).map((n) => n.toString(16));

/** [first octet, second octet range] for each private or special IPv4 block. */
const privateV4 = fc.oneof(
  fc.tuple(fc.constant(10), octet, octet, octet),
  fc.tuple(fc.constant(127), octet, octet, octet),
  fc.tuple(fc.constant(0), octet, octet, octet),
  fc.tuple(fc.constant(169), fc.constant(254), octet, octet),
  fc.tuple(fc.constant(172), fc.integer({ min: 16, max: 31 }), octet, octet),
  fc.tuple(fc.constant(192), fc.constant(168), octet, octet),
  fc.tuple(fc.constant(100), fc.integer({ min: 64, max: 127 }), octet, octet),
  fc.tuple(fc.integer({ min: 224, max: 255 }), octet, octet, octet),
);

const v4Text = (a: number[]) => a.join('.');

describe('isPublicAddress property (R1.4)', () => {
  it('rejects every private, loopback, link-local, CGNAT, multicast and reserved IPv4 address', () => {
    fc.assert(fc.property(privateV4, (a) => !isPublicAddress(v4Text(a))));
  });

  it('rejects the same addresses in IPv4-mapped IPv6 form', () => {
    fc.assert(fc.property(privateV4, (a) => !isPublicAddress(`::ffff:${v4Text(a)}`)));
  });

  it('rejects every unique-local fc00::/7 and link-local fe80::/10 address', () => {
    const ula = fc.tuple(fc.integer({ min: 0xfc00, max: 0xfdff }), fc.array(hex16, { minLength: 7, maxLength: 7 }));
    const linkLocal = fc.tuple(fc.integer({ min: 0xfe80, max: 0xfebf }), fc.array(hex16, { minLength: 7, maxLength: 7 }));
    fc.assert(
      fc.property(fc.oneof(ula, linkLocal), ([first, rest]) => !isPublicAddress([first.toString(16), ...rest].join(':'))),
    );
  });

  it('never throws on arbitrary strings', () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        expect(typeof isPublicAddress(s)).toBe('boolean');
      }),
    );
  });
});
