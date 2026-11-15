// @vitest-environment happy-dom
import { render } from 'preact';
import { afterEach, describe, expect, it } from 'vitest';
import { App } from './App.tsx';

describe('App placeholder', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('renders the app heading', () => {
    const root = document.createElement('div');
    document.body.append(root);
    render(<App />, root);
    expect(root.querySelector('h1')?.textContent).toBe('Deadline Graveyard');
  });
});
