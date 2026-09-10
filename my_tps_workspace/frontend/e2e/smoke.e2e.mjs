/**
 * EBRT workspace smoke script — run with:
 *   cd frontend && npm run ui:smoke
 *
 * Requires: backend (:3001) + frontend dev server (:5173) running.
 * Each step's `do` is the body of an async function with `h` = window.__h;
 * end the body with `return` of the value to assert on.
 */
export default [
  {
    name: 'app loads with module tabs',
    do: `
      await h.waitFor(() => document.querySelectorAll('.MuiTab-root').length >= 5, { timeout: 20000 });
      return [...document.querySelectorAll('.MuiTab-root')].map(t => t.textContent);
    `,
    expect: tabs => tabs.includes('EBRT PLAN') && tabs.includes('IMAGES'),
    shot: 'app-loaded',
  },
  {
    name: 'switch to EBRT PLAN module',
    do: `
      await h.clickText('.MuiTab-root', 'EBRT PLAN');
      await h.waitFor(() => document.body.innerText.includes('EBRT PLANS'), { timeout: 10000 });
      return h.text().match(/EBRT PLANS \\(\\d+\\)/)?.[0];
    `,
    expect: m => !!m,
  },
  {
    name: 'select a plan with beams (plan list hydrates fields table)',
    do: `
      const row = await h.waitFor(() =>
        h.all('.MuiTypography-caption').find(t => t.textContent.trim() === 'Audit Plan A'), { timeout: 10000 });
      await h.click(row.parentElement.parentElement, { settle: false });
      await h.waitFor(() => document.body.innerText.includes('ADD BEAM'), { timeout: 8000 });
      return { fields: h.text().includes('Field X (mm)'), plans: row.textContent.trim() };
    `,
    expect: r => r.fields === true,
  },
  {
    name: 'no beam selected by default (empty-state hint)',
    do: `
      await h.waitFor(() => document.body.innerText.includes('Click a field row to edit'), { timeout: 6000 });
      return { hint: true, detail: h.text().match(/BEAM \\d/)?.[0] ?? null };
    `,
    expect: r => r.hint === true && r.detail === null,
  },
  {
    name: 'clicking a field row shows beam detail',
    do: `
      const tr = h.all('tbody tr').find(r => r.querySelector('td')?.textContent.trim() === '1');
      if (!tr) return 'no field row';
      await h.click(tr);
      await h.waitFor(() => /BEAM 1/.test(h.text()), { timeout: 6000 });
      return h.text().match(/BEAM 1 · \\w+/)?.[0];
    `,
    expect: m => !!m,
    shot: 'beam-detail',
  },
  {
    name: 'normalization VALUE 50 rescales (busy state + note)',
    do: `
      await h.select('Normalize', 'Normalization Value %');
      await h.fill('%', '50');
      const apply = h.button('Apply');
      if (!apply) return 'no Apply button';
      await h.click(apply, { settle: false });
      await h.waitFor(() => /Normalized|Applying/.test(h.text()), { timeout: 20000 });
      await h.waitFor(() => h.text().match(/Normalized[^\\n]*/), { timeout: 30000 }).catch(() => null);
      return h.text().match(/Normalized \\(VALUE\\) ×[\\d.]+/)?.[0] ?? h.text().match(/Normalized[^\\n]*/)?.[0] ?? 'no note';
    `,
    expect: m => !!m && m.includes('Normalized'),
    shot: 'normalized',
  },
  {
    name: 'info tab Reference Points shows report (with or without grid)',
    do: `
      const tabs = h.all('.MuiTab-root').filter(t => t.textContent === 'Reference Points');
      const infoTab = tabs.at(-1);
      if (!infoTab) return 'no Reference Points tab';
      await h.click(infoTab);
      await h.waitFor(() => h.all('table').some(t => t.textContent.includes('Per fx')), { timeout: 10000 });
      const table = h.all('table').find(t => t.textContent.includes('Per fx'));
      return { header: table.textContent.includes('Per fx') && table.textContent.includes('Limit'), rows: table.querySelectorAll('tbody tr').length };
    `,
    expect: r => r.header === true && r.rows >= 0,
    shot: 'info-refpoints',
  },
  {
    name: 'no page errors during the run',
    do: `return h.errs()`,
    expect: errs => errs.length === 0,
  },
];
