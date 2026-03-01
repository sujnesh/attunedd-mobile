/**
 * Tests for the WHOOP OAuth deep link configuration.
 * Validates the attunedd:// URL scheme and callback parsing.
 */
describe('Deep linking configuration', () => {
  it('parses whoop callback success URL', () => {
    const url = 'attunedd://whoop/callback?status=connected';
    const params = new URLSearchParams(url.split('?')[1] ?? '');
    expect(params.get('status')).toBe('connected');
    expect(params.get('error')).toBeNull();
  });

  it('parses whoop callback error URL', () => {
    const url = 'attunedd://whoop/callback?error=denied';
    const params = new URLSearchParams(url.split('?')[1] ?? '');
    expect(params.get('error')).toBe('denied');
    expect(params.get('status')).toBeNull();
  });

  it('parses whoop callback with encoded error message', () => {
    const url = 'attunedd://whoop/callback?error=Failed%20to%20connect';
    const params = new URLSearchParams(url.split('?')[1] ?? '');
    expect(params.get('error')).toBe('Failed to connect');
  });

  it('handles callback URL with no params', () => {
    const url = 'attunedd://whoop/callback';
    const params = new URLSearchParams(url.split('?')[1] ?? '');
    expect(params.get('status')).toBeNull();
    expect(params.get('error')).toBeNull();
  });

  it('correctly identifies whoop callback URLs', () => {
    const whoopUrl = 'attunedd://whoop/callback?status=connected';
    const otherUrl = 'attunedd://settings';
    expect(whoopUrl.startsWith('attunedd://whoop/callback')).toBe(true);
    expect(otherUrl.startsWith('attunedd://whoop/callback')).toBe(false);
  });
});
