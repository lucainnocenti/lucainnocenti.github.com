(() => {
  const endpoint = 'https://pub.orcid.org/v3.0/0000-0002-7678-1128/works';
  const supplemental = [
    {year:'2026', month:10, title:'Who can sample forever? Shot noise effects in quantum linear regression', label:'Preprint', url:'https://arxiv.org/abs/2610.12015'},
    {year:'2026', month:7, title:'A general estimation framework for continuous-variable systems', label:'Preprint', url:'https://arxiv.org/abs/2607.19287'},
    {year:'2026', month:4, title:'Efficient classical training of model-free quantum photonic reservoir', label:'Preprint', url:'https://arxiv.org/abs/2604.12441'}
  ];
  const knownPreprints = {
    'speedingupthermalizationandquantumstatepreparationthroughengineeredquantumcollisions':'https://arxiv.org/abs/2506.20625',
    'thenonstabilizernesscostofquantumstateestimation':'https://arxiv.org/abs/2510.00157'
  };
  const aliases = {
    'nonlocalitybreakstherelationsbetweenmeasuresofquantumobjectivity':'themeaningofredundancyandconsensusinquantumobjectivity',
    'onthepotentialandlimitationsofquantumextremelearningmachines':'potentialandlimitationsofquantumextremelearningmachines',
    'quantumsuppressionlawina3dphotonicchipimplementingthefastfouriertransform':'suppressionlawofquantumstatesina3dphotonicfastfouriertransformchip'
  };
  const list = document.querySelector('.paper-list');
  const caption = document.querySelector('.publication-caption');
  const key = title => {
    const normalized = title.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
    return aliases[normalized] || normalized;
  };
  function fromOrcid(group, correctionDois) {
    const records = group['work-summary'] || [];
    return records.map(w => {
      const title = w.title?.title?.value || '';
      if (!title || !['journal-article', 'preprint'].includes(w.type) || /\b(correction|corrigendum|erratum|retraction)\b/i.test(title)) return null;
      const ids = w['external-ids']?.['external-id'] || [];
      const doi = ids.find(x => x['external-id-type']?.toLowerCase() === 'doi')?.['external-id-value'];
      if (doi && correctionDois.has(doi.toLowerCase())) return null;
      const arxiv = ids.find(x => x['external-id-type']?.toLowerCase() === 'arxiv')?.['external-id-value'];
      const journal = w['journal-title']?.value || '';
      const preprint = w.type === 'preprint' || /^arxiv$/i.test(journal);
      let url = doi ? 'https://doi.org/' + doi : knownPreprints[key(title)] || arxiv || w.url?.value || 'https://orcid.org/0000-0002-7678-1128';
      if (arxiv && !/^https?:\/\//i.test(url)) url = 'https://arxiv.org/abs/' + arxiv;
      try { const parsed = new URL(url); if (!['https:', 'http:'].includes(parsed.protocol)) throw Error(); url = parsed.href; } catch { url = 'https://orcid.org/0000-0002-7678-1128'; }
      return {title, year:w['publication-date']?.year?.value || '', month:Number(w['publication-date']?.month?.value || 0), label:preprint ? 'Preprint' : journal || 'Journal article', url, score:preprint ? (doi ? 2 : 1) : (doi ? 4 : 3)};
    }).filter(Boolean);
  }
  function render(records) {
    const merged = new Map();
    for (const paper of records) {
      const k = key(paper.title), old = merged.get(k);
      if (!old || (paper.score || 1) > (old.score || 1)) merged.set(k, paper);
    }
    const papers = [...merged.values()].sort((a,b) => Number(b.year) - Number(a.year) || (b.month || 0) - (a.month || 0) || a.title.localeCompare(b.title));
    const fragment = document.createDocumentFragment();
    for (const paper of papers) {
      const a = document.createElement('a'); a.className = 'paper'; a.href = paper.url;
      const year = document.createElement('span'); year.className = 'paper-year'; year.textContent = paper.year;
      const title = document.createElement('span'); title.className = 'paper-title'; title.append(document.createTextNode(paper.title + ' '));
      const venue = document.createElement('span'); venue.className = 'paper-venue'; venue.textContent = '· ' + paper.label; title.append(venue);
      const arrow = document.createElement('span'); arrow.className = 'arrow'; arrow.setAttribute('aria-hidden', 'true'); arrow.textContent = '↗';
      a.append(year, title, arrow); fragment.append(a);
    }
    list.replaceChildren(fragment);
    caption.textContent = papers.length + ' papers · Scroll to explore · Updated from ORCID';
  }
  async function refresh() {
    try {
      const response = await fetch(endpoint, {headers:{Accept:'application/json'}});
      if (!response.ok) throw new Error('ORCID unavailable');
      const data = await response.json();
      if (!Array.isArray(data.group)) throw new Error('Unexpected ORCID response');
      const allSummaries = data.group.flatMap(g => g['work-summary'] || []);
      const correctionDois = new Set(allSummaries.filter(w => /\b(correction|corrigendum|erratum|retraction)\b/i.test(w.title?.title?.value || '')).flatMap(w => (w['external-ids']?.['external-id'] || []).filter(x => x['external-id-type']?.toLowerCase() === 'doi').map(x => x['external-id-value'].toLowerCase())));
      const records = data.group.flatMap(g => fromOrcid(g, correctionDois));
      if (!records.length) throw new Error('No papers returned');
      render([...records, ...supplemental]);
    } catch {
      caption.textContent = caption.dataset.fallback;
    }
  }
  refresh();
})();
