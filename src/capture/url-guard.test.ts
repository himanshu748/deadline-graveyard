// Validates: capture-and-export R1.3, R1.4
import { describe, expect, it } from 'vitest';
import { bareHost, checkUrlSyntax, isIpLiteral, isPublicAddress, parseIPv6 } from './url-guard.ts';

describe('checkUrlSyntax (R1.3)', () => {
  it.each([
    ['https://kiroween.devpost.com/rules', true],
    ['http://example.com/', true],
    ['https://example.com:8443/x', true],
  ])('accepts %s', (raw, ok) => {
    expect(checkUrlSyntax(raw).ok).toBe(ok);
  });

  it.each([
    ['ftp://example.com/file', 'scheme'],
    ['file:///etc/passwd', 'scheme'],
    ['javascript:alert(1)', 'scheme'],
    ['data:text/html,hi', 'scheme'],
    ['gopher://example.com', 'scheme'],
    ['https://user:pass@example.com/', 'credentials'],
    ['https://example.com:22/', 'port'],
    ['not a url', 'invalid'],
    ['', 'invalid'],
    [`https://example.com/${'a'.repeat(2100)}`, 'invalid'],
  ])('rejects %s as %s', (raw, reason) => {
    const result = checkUrlSyntax(raw);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe(reason);
  });

  it('strips IPv6 brackets from the host', () => {
    const r = checkUrlSyntax('http://[::1]/');
    expect(r.ok && bareHost(r.url)).toBe('::1');
  });
});

describe('isPublicAddress (R1.4)', () => {
  it.each([
    '127.0.0.1',
    '127.255.255.254',
    '10.0.0.1',
    '10.255.255.255',
    '172.16.0.1',
    '172.31.255.255',
    '192.168.1.1',
    '169.254.169.254',
    '169.254.0.1',
    '100.64.0.1',
    '0.0.0.0',
    '224.0.0.1',
    '255.255.255.255',
    '192.0.2.10',
    '198.18.0.1',
    '::',
    '::1',
    'fc00::1',
    'fd12:3456:789a::1',
    'fe80::1',
    'fec0::1',
    'ff02::1',
    '::ffff:127.0.0.1',
    '::ffff:7f00:1',
    '::ffff:10.0.0.1',
    '::ffff:169.254.169.254',
    '64:ff9b::a9fe:a9fe',
    '2002:7f00:1::',
    '2001:db8::1',
    '2001::1',
    '100::1',
    'fe80::1%en0',
    'localhost',
    '',
    '1.2.3',
    '256.1.1.1',
  ])('rejects %s', (ip) => {
    expect(isPublicAddress(ip)).toBe(false);
  });

  it.each(['93.184.215.14', '8.8.8.8', '1.1.1.1', '172.32.0.1', '192.169.0.1', '2606:2800:21f:cb07:6820:80da:af6b:8b2c', '2a00:1450:4009:81f::200e', '::ffff:8.8.8.8', '2002:0808:0808::1'])(
    'accepts %s',
    (ip) => {
      expect(isPublicAddress(ip)).toBe(true);
    },
  );
});

describe('parseIPv6', () => {
  it('expands compressed forms and embedded IPv4', () => {
    expect(parseIPv6('::1')).toEqual([0, 0, 0, 0, 0, 0, 0, 1]);
    expect(parseIPv6('::ffff:1.2.3.4')).toEqual([0, 0, 0, 0, 0, 0xffff, 0x0102, 0x0304]);
    expect(parseIPv6('1:2:3:4:5:6:7:8')).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('rejects malformed input', () => {
    for (const bad of [':::', '1::2::3', '1:2:3:4:5:6:7:8:9', '12345::', 'g::1', '1.2.3.4']) expect(parseIPv6(bad)).toBeNull();
  });

  it('knows IP literals from names', () => {
    expect(isIpLiteral('10.0.0.1')).toBe(true);
    expect(isIpLiteral('fe80::1')).toBe(true);
    expect(isIpLiteral('example.com')).toBe(false);
  });
});
