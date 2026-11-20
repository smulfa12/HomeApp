/**
 * Router Service
 * Hash router kecil: "#/inventory/input?id=xxx".
 * Setiap modul program mendaftarkan { path, render } dan router
 * yang memanggil render() saat URL berubah.
 */
export function createRouter({ outlet, notFound = '/', onNavigate = () => {} }) {
  const routes = new Map();
  let cleanup = null;

  function parse() {
    const hash = location.hash.replace(/^#/, '') || '/';
    const [path, query = ''] = hash.split('?');
    return { path, params: Object.fromEntries(new URLSearchParams(query)) };
  }

  async function resolve() {
    const { path, params } = parse();
    const mod = routes.get(path) || routes.get(notFound);
    if (typeof cleanup === 'function') {
      try { await cleanup(); } catch { /* abaikan */ }
    }
    cleanup = null;
    outlet.innerHTML = '';
    outlet.scrollTop = 0;
    window.scrollTo(0, 0);
    const view = document.createElement('div');
    view.className = 'view';
    outlet.appendChild(view);
    if (mod.title) document.title = `${mod.title} · Rumahku`;
    onNavigate(path, mod);
    cleanup = await mod.render(view, params);
  }

  return {
    register(mod) {
      routes.set(mod.path, mod);
      return this;
    },
    start() {
      window.addEventListener('hashchange', resolve);
      resolve();
    },
    refresh: resolve,
  };
}

export const navigate = (path) => (location.hash = '#' + path);
