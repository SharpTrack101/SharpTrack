# SharpTrack Frontend Guidelines

## Stack
- Pure HTML, CSS, JavaScript — no frameworks
- Mobile-first, max-width 480px centered
- All pages must work offline (no CDN dependencies)

## Brand Colors
```css
--primary: #0a4d33;
--primary-dark: #083b27;
--bg: #f0ebe0;
--card-bg: #ffffff;
--border: #e8e3d8;
--text: #1a2e26;
--muted: #7a8880;
--orange: #e07b2a;
--orange-bg: #fdf3ea;
```

## Typography
- Font: `'Segoe UI', Tahoma, Geneva, Verdana, sans-serif`
- Page titles: 22-28px, font-weight 800
- Section headers: 13-15px, font-weight 700, uppercase + letter-spacing
- Body text: 14px
- Labels/subtitles: 12px, color var(--muted)

## Layout Rules
- Body padding-bottom: 90px (always — bottom nav overlap)
- Content padding: 0 20px
- Card border-radius: 16px
- Button border-radius: 16px (primary), 10px (secondary)
- Gap between cards: 12px
- Section margin-bottom: 20px

## Navigation
- Sticky top navbar: logo center, hamburger left, bell right
- Fixed bottom nav: 5 items — Dashboard, Inventory, FAB, Sales, More
- FAB: 52px circle, background var(--primary), centered, elevated 16px above nav
- Active nav item: color var(--primary), inactive: color var(--muted)
- All nav buttons use: `onclick="window.location.href='page.html'"`

## Page Files
| Page | File |
|------|------|
| Dashboard | dashboard.html |
| Add Stock | add-stock.html |
| Record Sale | record-sale.html |
| Login | login.html |
| Signup | signup.html |

## Components

### Stat Cards
- 2-column grid, gap 12px
- Icon: 36x36px, border-radius 10px
- Green variant: background #edf5ef, color var(--primary)
- Orange/alert variant: background var(--orange-bg), color var(--orange)

### Buttons
- Primary: full width, 16px padding, background var(--primary), white text, border-radius 16px
- Secondary: border 1.5px solid var(--primary), no background, color var(--primary)
- Active state: `transform: scale(0.97-0.98)`
- Hover state: background var(--primary-dark)

### Forms / Inputs
- Border: 1.5px solid var(--border)
- Background: #fafaf8
- Border-radius: 8-10px
- Focus: border-color var(--primary)
- Font: inherit

### List Items
- Padding: 10-12px 0
- Border-bottom: 1px solid var(--border)
- Last child: no border-bottom
- Image/icon: 44-48px, border-radius 10px, background #f5f5f0

## Icons
- All icons: SVG inline, no icon libraries
- Size: 22x22px standard, 18px small, 24px FAB
- Style: fill none, stroke currentColor, stroke-width 2, stroke-linecap round, stroke-linejoin round
- Always wrap in a button or clickable element — never bare SVG for actions

## Interactions
- All clickable buttons must have visible `:active` state
- Transitions: `0.1s` for transforms, `0.2s` for color/background
- No hover effects on mobile-only elements
- Disabled buttons: background var(--muted), cursor not-allowed

## Code Rules
- No inline styles except one-off overrides
- No external CSS frameworks (no Bootstrap, Tailwind)
- No jQuery — vanilla JS only
- Keep JS at bottom of body in `<script>` tags
- No `<form>` tags — use button onclick handlers
- No `<a>` tags inside `<button>` tags
- Images use `mix-blend-mode: multiply` to remove white backgrounds

## File Naming
- All lowercase with hyphens: `add-stock.html`, `record-sale.html`
- Logo file: `logo2.png` in root folder
- Keep all files in same root folder — no subfolders for now