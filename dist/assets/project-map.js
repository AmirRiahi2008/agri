/* Leaflet + OpenStreetMap: no API key, responsive sizing and connection recovery. */
(() => {
  'use strict';
  // Leaflet treats its own emptyImageUrl as a cancelled request, so use a distinct transparent tile.
  const TRANSPARENT_TILE = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>');
  const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a>';
  const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

  window.ProjectMap = {
    create(id, { expanded = false, onStatus = () => {} } = {}) {
      const project = window.AgriProject?.project;
      const coordinates = project?.location?.coordinates;
      if (!Array.isArray(coordinates) || coordinates.length !== 2 || !coordinates.every(Number.isFinite) || Math.abs(coordinates[0]) > 85 || Math.abs(coordinates[1]) > 180) { onStatus('pending'); return null; }
      const CENTER = [...coordinates];
      const START_ZOOM = Math.max(13, Math.min(19, Number(project.location.zoom) || 16));
      const el = document.getElementById(id);
      if (!window.L || !el) { onStatus('unavailable'); return null; }
      const L = window.L;
      let destroyed = false;
      let map;
      let resizeObserver;
      let refreshFrame;
      const cancellations = new Set();
      const controller = { status: 'loading' };

      const notify = status => {
        if (destroyed) return;
        controller.status = status; onStatus(status);
      };

      const LiveLayer = L.TileLayer.extend({
        createTile(coords, done) {
          const tile = document.createElement('img');
          tile.alt = ''; tile.setAttribute('role', 'presentation');
          tile.referrerPolicy = 'strict-origin-when-cross-origin';
          tile.dataset.mapZoom = String(coords.z);
          let timeout;
          let settled = false;

          const cleanup = () => {
            clearTimeout(timeout); tile.onload = null; tile.onerror = null;
            cancellations.delete(cancel);
          };
          const cancel = () => { settled = true; cleanup(); };
          cancellations.add(cancel);
          tile._mapRequestCleanup = cancel;

          const finish = source => {
            if (settled || destroyed) return;
            settled = true; cleanup(); tile.dataset.mapSource = source;
            // Keep failed tiles neutral; the UI explains the connection issue.
            if (source === 'offline') tile.src = TRANSPARENT_TILE;
            done(null, tile);
          };

          const attempt = () => {
            if (settled || destroyed) return;
            if (navigator.onLine === false) { finish('offline'); return; }
            tile.dataset.mapSource = 'osm';
            tile.onerror = () => finish('offline');
            tile.onload = () => finish('osm');
            timeout = setTimeout(() => finish('offline'), 7000);
            tile.src = L.Util.template(TILE_URL, coords);
          };
          // Leaflet must attach the tile before the offline callback can complete.
          timeout = setTimeout(attempt, 0);
          return tile;
        },
      });

      try {
        map = L.map(el, {
          zoomControl: false, attributionControl: true, trackResize: false,
          minZoom: 13, maxZoom: 19, zoomSnap: 1, zoomDelta: 1,
          dragging: true, touchZoom: true, tap: false, keyboard: true,
          scrollWheelZoom: expanded, gestureHandling: !expanded,
          gestureHandlingOptions: {
            duration: 1800,
            text: {
              touch: 'برای جابه‌جایی نقشه از دو انگشت استفاده کنید',
              scroll: 'برای زوم نقشه، Ctrl را نگه دارید و اسکرول کنید',
              scrollMac: 'برای زوم نقشه، ⌘ را نگه دارید و اسکرول کنید',
            },
          },
          zoomAnimation: !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
          fadeAnimation: false,
        });
        map.setView(CENTER, START_ZOOM);
      } catch {
        map?.remove();
        onStatus('unavailable'); return null;
      }

      map.attributionControl.setPrefix(false);
      L.control.zoom({ position: 'topleft' }).addTo(map);
      L.control.scale({ position: 'bottomleft', imperial: false, maxWidth: 85 }).addTo(map);
      const live = new LiveLayer(TILE_URL, {
        minZoom: 13, maxZoom: 19, noWrap: true, keepBuffer: 1,
        attribution: ATTRIBUTION, className: 'project-live-tiles',
        updateWhenIdle: true, updateWhenZooming: false,
      });
      live.on('tileunload', e => e.tile._mapRequestCleanup?.());
      live.on('tileload', e => {
        if (e.coords.z !== Math.round(map.getZoom()) || navigator.onLine === false) return;
        const source = e.tile.dataset.mapSource;
        if (source === 'osm') notify('osm');
      });
      live.on('load', () => {
        if (destroyed) return;
        const tiles = Array.from(live.getContainer()?.querySelectorAll('img[data-map-source]') || [])
          .filter(tile => Number(tile.dataset.mapZoom) === Math.round(map.getZoom()));
        if (tiles.length) {
          if (navigator.onLine === false || tiles.every(tile => tile.dataset.mapSource === 'offline')) notify('offline');
          else if (tiles.some(tile => tile.dataset.mapSource === 'offline')) notify('partial');
          else notify('osm');
        }
      });
      live.addTo(map);

      const markerContent = document.createElement('div');
      markerContent.className = 'pin-wrap';
      markerContent.innerHTML = '<span class="pin-shadow"></span><span class="pin-shape"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path d="M3 20V9l9-6 9 6v11M3 9h18M7 20v-7h10v7M2 20h20" stroke-linecap="round" stroke-linejoin="round"/></svg></span>';
      const caption = document.createElement('div'); caption.className = 'map-caption'; caption.textContent = project.name;
      markerContent.prepend(caption);
      const icon = L.divIcon({
        className: 'map-marker', iconSize: [48, 60], iconAnchor: [24, 48], popupAnchor: [0, -43],
        html: markerContent,
      });
      const marker = L.marker(CENTER, { icon, keyboard: true, title: 'نمایش آدرس و مسیریابی ' + project.name }).addTo(map);
      const popup = document.createElement('div');
      popup.className = 'project-map-popup'; popup.dir = 'rtl';
      const title = document.createElement('strong'); title.textContent = project.name;
      const address = document.createElement('p'); address.textContent = project.location.address;
      const link = document.createElement('a'); link.href = 'https://www.google.com/maps/dir/?api=1&destination=' + CENTER.join(',');
      link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = 'مسیریابی تا واحد ←';
      popup.append(title, address, link);
      marker.bindPopup(popup, { minWidth: 200, maxWidth: 260, autoPanPadding: [28, 80] });

      const refresh = () => {
        if (destroyed || !el.clientWidth || !el.clientHeight) return;
        map.invalidateSize({ pan: true, animate: false, debounceMoveend: true });
      };
      const scheduleRefresh = () => { cancelAnimationFrame(refreshFrame); refreshFrame = requestAnimationFrame(refresh); };
      if (window.ResizeObserver) { resizeObserver = new ResizeObserver(scheduleRefresh); resizeObserver.observe(el); }
      window.addEventListener('resize', scheduleRefresh);
      document.fonts?.ready.then(scheduleRefresh);

      const retry = () => {
        if (destroyed) return;
        notify('loading'); live.redraw();
      };
      const offline = () => { notify('offline'); };
      window.addEventListener('online', retry);
      window.addEventListener('offline', offline);
      if (navigator.onLine === false) offline();

      Object.assign(controller, {
        map, refresh, retry,
        recenter() {
          if (destroyed) return;
          map.closePopup();
          const zoom = Math.max(START_ZOOM, map.getMinZoom());
          if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) map.setView(CENTER, zoom, { animate: false });
          else map.flyTo(CENTER, zoom, { duration: 0.7 });
        },
        destroy() {
          destroyed = true;
          cancellations.forEach(cancel => cancel());
          resizeObserver?.disconnect(); cancelAnimationFrame(refreshFrame);
          window.removeEventListener('resize', scheduleRefresh);
          window.removeEventListener('online', retry); window.removeEventListener('offline', offline);
          map.remove();
        },
      });
      scheduleRefresh();
      return controller;
    },
  };
})();
