const fs = require('fs');

let css = fs.readFileSync('frontend/src/index.css', 'utf8');

const addition = `

  /* Premium Modern Travel Action Tokens */
  .btn-emerald {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-family: var(--font-body, 'Manrope', 'Inter', sans-serif);
    font-weight: 600;
    background-color: #14532d;
    color: #ffffff;
    transition: transform 0.15s ease, background-color 0.15s ease, box-shadow 0.15s ease;
    border-radius: 0.75rem;
    min-height: 2.75rem;
    padding-left: 1.25rem;
    padding-right: 1.25rem;
    box-shadow: 0 2px 6px rgba(20, 83, 45, 0.18);
  }
  .btn-emerald:hover {
    background-color: #166534;
    transform: translateY(-1px);
    box-shadow: 0 4px 14px rgba(20, 83, 45, 0.28);
  }
  .btn-emerald:active {
    transform: translateY(0);
  }

  .btn-outline-emerald {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-family: var(--font-body, 'Manrope', 'Inter', sans-serif);
    font-weight: 600;
    border: 1.5px solid #166534;
    color: #166534;
    background-color: transparent;
    transition: all 0.15s ease;
    border-radius: 0.75rem;
    min-height: 2.75rem;
    padding-left: 1.25rem;
    padding-right: 1.25rem;
  }
  .btn-outline-emerald:hover {
    background-color: #f0fdf4;
    border-color: #14532d;
    color: #14532d;
  }

  .travel-surface {
    background-color: #ffffff;
    border: 1px solid rgba(226, 232, 240, 0.85);
    border-radius: 1rem;
    box-shadow: 0 2px 8px rgba(15, 23, 42, 0.04);
  }

  .travel-input {
    width: 100%;
    min-height: 2.75rem;
    border-radius: 0.75rem;
    border: 1px solid #e2e8f0;
    background-color: #ffffff;
    padding: 0.625rem 0.875rem;
    font-size: 0.9375rem;
    color: #0f172a;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
  }
  .travel-input:focus {
    outline: none;
    border-color: #166534;
    box-shadow: 0 0 0 3px rgba(22, 101, 52, 0.12);
  }

  .travel-sticky-bar {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 40;
    background: rgba(255, 255, 255, 0.96);
    backdrop-filter: blur(12px);
    border-top: 1px solid rgba(226, 232, 240, 0.9);
    padding: 0.75rem 1rem;
    box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.08);
  }
`;

if (css.includes('.btn-emerald')) {
  console.log('.btn-emerald already present');
} else {
  const targetPattern = /\.btn-crimson:hover\s*\{[^}]*\}/;
  const match = css.match(targetPattern);
  if (match) {
    const idx = match.index + match[0].length;
    css = css.slice(0, idx) + addition + css.slice(idx);
    fs.writeFileSync('frontend/src/index.css', css, 'utf8');
    console.log('Successfully added tokens to index.css');
  } else {
    console.error('Pattern not found');
  }
}
