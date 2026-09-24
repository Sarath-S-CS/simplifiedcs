// News page (/news): live feed from Supabase, with the bundled items as a fallback.
import { newsCardHtml } from "../ui/feed-cards.js";
import { LEARNING_RESOURCES } from "../content/learning.js";
import { NEWS_ITEMS } from "../content/news.js";
import { keepFocusAcrossRedraw } from "../ui/a11y.js";
import { getSupabase } from "../data/supabase-client.js";
import { pathForTab, wireNavClick, activeTab } from "../router.js";
import { observeReveals } from "./shared.js";

let newsFilter = 'all';
let newsCache = null; // { items, live } - loaded once per session, filter clicks just re-render from this

// §1 Phase 2: news_items is fetched by a daily Edge Function (see
// supabase/functions/fetch-news) from CISA KEV, NVD, and security RSS,
// ranked by a computed priority score (not just recency). Falls back to the
// hand-curated NEWS_ITEMS snapshot above if the table is empty (e.g. before
// the first scheduled run) or the request fails for any reason - the tab
// should never show a broken/empty page just because the live fetch had a
// bad day.
async function loadNewsData(){
  if(newsCache) return newsCache;
  try {
    const { data, error } = await (await getSupabase())
      .from('news_items')
      .select('external_id, headline, body, source, source_url, category, published_at')
      .order('priority_score', { ascending:false })
      .order('published_at', { ascending:false })
      .limit(100);
    if(error) throw error;
    if(data && data.length){
      newsCache = {
        live: true,
        items: data.map(d => ({
          // external_id is 'cve:CVE-xxxx-xxxxx' for KEV-sourced items, used
          // below to link through to the matching Exploits entry instead of
          // duplicating its mitigation detail inline here.
          cveId: d.external_id?.startsWith('cve:') ? d.external_id.slice(4) : null,
          headline: d.headline, body: d.body, source: d.source, sourceUrl: d.source_url,
          cat: d.category, publishedAt: d.published_at,
        })),
      };
      return newsCache;
    }
  } catch(e) { /* fall through to static snapshot below */ }
  newsCache = {
    live: false,
    items: [...NEWS_ITEMS]
      .sort((a,b)=> b.date.localeCompare(a.date))
      .map(n => ({ headline:n.headline, body:n.body, source:n.source, sourceUrl:null, cveId:null, cat:n.cat, publishedAt:n.date })),
  };
  return newsCache;
}

const NEWS_CATS = [
  { id:'all', label:'All' },
  { id:'ai', label:'AI & Security' },
  { id:'vuln', label:'Vulnerabilities' },
  { id:'ot', label:'OT / Industrial' },
  { id:'landscape', label:'Threat Landscape' },
];

export async function renderNewsTab(container){
  container.innerHTML = `
    <div class="page">
      <div class="page-intro revealed">
        <div class="page-eyebrow">Stay Current</div>
        <h2 class="page-title">Trends & News</h2>
        <p class="page-lede">A curated read of what's actually happening in the threat landscape and in AI-for-security - the same context a good consultant would bring into a conversation with you.</p>
      </div>
      <div class="section-tile revealed"><p class="body-text">Loading the latest…</p></div>
    </div>
  `;
  const newsData = await loadNewsData();
  // Bail if the user already navigated away while this was loading.
  if(!document.getElementById('tabContent')?.contains(container) && activeTab !== 'news') return;
  renderNewsList(container, newsData);
  // renderNewsList() just replaced the loading skeleton's .section-tile
  // with a fresh one - re-observe it so the scroll-reveal fade-in actually
  // fires (see the identical note on the filter-pill handler below).
  observeReveals();
}

function renderNewsList(container, newsData){
  // headline/body/source/source_url come from third-party RSS feeds and
  // catalogs via fetch-news - every one is escaped (and the link
  // scheme-checked) here at render, see src/ui/html-safety.js.
  const items = newsData.items.filter(n => newsFilter==='all' || n.cat===newsFilter);
  const freshness = newsData.live
    ? `Refreshed daily from CISA's KEV catalog, NVD, and security RSS feeds, ranked by exploitation status/severity/recency - not just "newest first."`
    : `Showing a curated snapshot - the live feed didn't return anything this time, so nothing's lost, just not current. Refresh in a bit.`;
  const restoreFocus = keepFocusAcrossRedraw(container);
  container.innerHTML = `
    <div class="page">
      <div class="page-intro">
        <div class="page-eyebrow">Stay Current</div>
        <h2 class="page-title">Trends & News</h2>
        <p class="page-lede">A curated read of what's actually happening in the threat landscape and in AI-for-security - the same context a good consultant would bring into a conversation with you.</p>
      </div>

      <div class="section-tile">
        <p class="news-freshness">${freshness}</p>
        <div class="news-filters">
          ${NEWS_CATS.map(c=>`<button class="filter-pill ${newsFilter===c.id?'active':''}" data-cat="${c.id}" data-fkey="news-filter-${c.id}">${c.label}</button>`).join('')}
        </div>
        <div class="news-grid">
          ${items.map(n => newsCardHtml(n, {
            categoryLabel: (id) => NEWS_CATS.find(c => c.id === id)?.label,
            exploitHref: (cveId) => pathForTab('exploits', `exploit-${cveId}`),
          })).join('')}
        </div>
      </div>

      <div class="section-tile">
        <h3 class="section-h">Where to keep following this yourself</h3>
        <p class="body-text">This tab is a snapshot; these are live, ongoing sources across every format worth following - podcasts for the commute, newsletters for the inbox, and communities for everything in between.</p>
        <div class="resource-groups">
          <div class="resource-group">
            <h4>Podcasts</h4>
            ${LEARNING_RESOURCES.podcasts.map(r=>`<div class="resource-item"><b>${r.name}</b><span>${r.desc}</span></div>`).join('')}
          </div>
          <div class="resource-group">
            <h4>Newsletters</h4>
            ${LEARNING_RESOURCES.newsletters.map(r=>`<div class="resource-item"><b>${r.name}</b><span>${r.desc}</span></div>`).join('')}
          </div>
          <div class="resource-group">
            <h4>Medium</h4>
            ${LEARNING_RESOURCES.medium.map(r=>`<div class="resource-item"><b>${r.name}</b><span>${r.desc}</span></div>`).join('')}
          </div>
          <div class="resource-group">
            <h4>News Sites</h4>
            ${LEARNING_RESOURCES.newssites.map(r=>`<div class="resource-item"><b>${r.name}</b><span>${r.desc}</span></div>`).join('')}
          </div>
          <div class="resource-group">
            <h4>LinkedIn</h4>
            ${LEARNING_RESOURCES.linkedin.map(r=>`<div class="resource-item"><b>${r.name}</b><span>${r.desc}</span></div>`).join('')}
          </div>
        </div>
      </div>
    </div>
  `;
  container.querySelectorAll('[data-goto-exploit]').forEach(btn=>{
    wireNavClick(btn, ()=> ({ tab:'exploits', anchor:`exploit-${btn.dataset.gotoExploit}` }));
  });
  container.querySelectorAll('.filter-pill').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      newsFilter = btn.dataset.cat;
      renderNewsList(container, newsData);
      // renderNewsList() replaces container.innerHTML, so the fresh
      // .section-tile starts at opacity:0 per the scroll-reveal CSS (see
      // observeReveals()) - without re-observing it here, it never gets the
      // .revealed class and stays invisible, which is exactly the reported
      // "filter click does nothing / blank page" bug (§4 Phase 2 brief).
      observeReveals();
    });
  });
  restoreFocus();
}
