// Panel «Cohorte» de la pantalla Mundo (spec 024 R-026): cuántas personas cumplen el filtro, edad con histograma,
// ocupación, estrato y ánimo. Solo calcula en el cliente (cohort.ts); no escribe en el mundo. «Guardar cohorte» queda
// desactivado, con «Pronto», hasta que exista persistencia de cohortes (decisión del usuario, 2026-10-05).
import { AGE_BINS, AGE_LIMIT, ALL_COHORT, ageHistogram, binInRange, cohortOf, describe, facets, isActive, toggled } from './cohort.ts';
import type { CohortFilter, CohortPerson, CohortResult } from './cohort.ts';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

export interface CohortPanel {
  /** Recalcula con la población de ahora (cada segundo). */
  refresh: () => void;
  /** Quita el filtro (el «✕» de la cohorte activa en el dashboard). */
  reset: () => void;
  /** Los ids de la cohorte, o null si no hay filtro. */
  ids: () => ReadonlySet<string> | null;
  filter: () => CohortFilter;
  result: () => CohortResult;
}

export function setupCohort(o: { people: () => readonly CohortPerson[]; onChange: (r: CohortResult, f: CohortFilter) => void }): CohortPanel {
  const root = document.querySelector<HTMLElement>('#cohort')!;
  let f: CohortFilter = ALL_COHORT;
  let res: CohortResult = cohortOf(o.people(), f);
  root.innerHTML = `
    <div class="coh-count"><b class="dw-big" id="coh-n">0</b><span class="muted" id="coh-of">de 0 personas<br>en la cohorte</span><span class="grow"></span><span class="tag gold" id="coh-pct">100 %</span></div>
    <div class="meter-bar"><i id="coh-bar"></i></div>
    <div class="coh-row"><b>Edad</b><span class="grow"></span>
      <label class="coh-in">de <input id="coh-amin" type="number" min="0" max="${AGE_LIMIT}" inputmode="numeric" aria-label="Edad mínima" /></label>
      <label class="coh-in">a <input id="coh-amax" type="number" min="0" max="${AGE_LIMIT}" inputmode="numeric" aria-label="Edad máxima" /></label></div>
    <svg class="coh-hist" id="coh-hist" viewBox="0 0 264 58" role="img" aria-label="Personas por grupo de edad"></svg>
    <b>Ocupación</b><div class="tags" id="coh-occ"></div>
    <b>Estrato</b><div class="tags" id="coh-str"></div>
    <div class="coh-row"><b>Ánimo</b><span class="grow"></span><span class="muted mono" id="coh-mood-txt"></span></div>
    <div class="dual" role="group" aria-label="Rango de ánimo"><input id="coh-mmin" type="range" min="0" max="100" aria-label="Ánimo mínimo" /><input id="coh-mmax" type="range" min="0" max="100" aria-label="Ánimo máximo" /></div>
    <div class="coh-row"><button class="btn" id="coh-reset" type="button">Restablecer</button><span class="grow"></span><button class="btn accent" id="coh-save" type="button" disabled title="Guardar cohortes llega cuando exista persistencia de cohortes">Guardar · Pronto</button></div>`;
  const $ = <T extends HTMLElement>(s: string) => root.querySelector<T>(s)!;
  const amin = $<HTMLInputElement>('#coh-amin');
  const amax = $<HTMLInputElement>('#coh-amax');
  const mmin = $<HTMLInputElement>('#coh-mmin');
  const mmax = $<HTMLInputElement>('#coh-mmax');
  const last = { occ: '', str: '', hist: '' };

  const set = (next: CohortFilter) => {
    f = next;
    update();
    o.onChange(res, f);
  };

  const update = () => {
    const people = o.people();
    res = cohortOf(people, f);
    $('#coh-n').textContent = String(res.count);
    $('#coh-of').innerHTML = `de ${res.total} personas<br>${isActive(f) ? 'en la cohorte' : 'sin filtro'}`;
    $('#coh-pct').textContent = `${res.pct} %`;
    $<HTMLElement>('#coh-bar').style.width = `${res.pct}%`;
    if (document.activeElement !== amin) amin.value = String(f.ageMin);
    if (document.activeElement !== amax) amax.value = String(f.ageMax);
    if (document.activeElement !== mmin) mmin.value = String(Math.round(f.moodMin * 100));
    if (document.activeElement !== mmax) mmax.value = String(Math.round(f.moodMax * 100));
    $('#coh-mood-txt').textContent = `${f.moodMin.toFixed(2).replace('.', ',')} – ${f.moodMax.toFixed(2).replace('.', ',')}`;
    // Histograma: cada barra dice cuántas personas hay y, resaltada, si su grupo cae dentro del rango.
    const h = ageHistogram(people);
    const top = Math.max(1, ...h);
    const hist = h.map((n, i) => `<g><title>${AGE_BINS[i]} años: ${n}</title><rect x="${i * 33 + 4}" y="${52 - Math.round((n / top) * 46) - 2}" width="27" height="${Math.round((n / top) * 46) + 2}" rx="3" class="${binInRange(i, f) && (f.ageMin > 0 || f.ageMax < AGE_LIMIT) ? 'on' : ''}"></rect></g>`).join('');
    if (hist !== last.hist) $('#coh-hist').innerHTML = hist;
    last.hist = hist;
    const fx = facets(people);
    const occ = fx.occupations.map(([k, n]) => `<button type="button" class="tag" data-occ="${esc(k)}" aria-pressed="${f.occupations.includes(k)}">${esc(k)} · ${n}</button>`).join('');
    if (occ !== last.occ) $('#coh-occ').innerHTML = occ;
    last.occ = occ;
    const str = fx.strata.map(([k, n]) => `<button type="button" class="tag" data-str="${k}" aria-pressed="${f.strata.includes(k)}" title="${n} personas">${k}</button>`).join('');
    if (str !== last.str) $('#coh-str').innerHTML = str;
    last.str = str;
    $<HTMLButtonElement>('#coh-reset').disabled = !isActive(f);
    root.dataset.summary = describe(f, res);
  };

  amin.addEventListener('input', () => {
    const v = clamp(Math.round(Number(amin.value) || 0), 0, f.ageMax);
    set({ ...f, ageMin: v });
  });
  amax.addEventListener('input', () => {
    const v = clamp(Math.round(Number(amax.value) || AGE_LIMIT), f.ageMin, AGE_LIMIT);
    set({ ...f, ageMax: v });
  });
  mmin.addEventListener('input', () => set({ ...f, moodMin: Math.min(Number(mmin.value) / 100, f.moodMax) }));
  mmax.addEventListener('input', () => set({ ...f, moodMax: Math.max(Number(mmax.value) / 100, f.moodMin) }));
  root.addEventListener('click', (e) => {
    const t = (e.target as HTMLElement).closest<HTMLElement>('[data-occ],[data-str]');
    if (t?.dataset.occ) set({ ...f, occupations: toggled(f.occupations, t.dataset.occ) });
    else if (t?.dataset.str) set({ ...f, strata: toggled(f.strata, Number(t.dataset.str)) });
  });
  $('#coh-reset').addEventListener('click', () => set(ALL_COHORT));
  update();
  return {
    refresh: () => {
      const before = res.count;
      update();
      if (res.count !== before) o.onChange(res, f);
    },
    reset: () => set(ALL_COHORT),
    ids: () => res.ids,
    filter: () => f,
    result: () => res,
  };
}

export type { CohortPerson };
