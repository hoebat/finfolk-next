import { formatBytes } from './activity.js';
import {deviceStorage} from './device-storage.js';
export function installOfflineUI(
  downloads,
  { region = () => null, onOpen = () => {} } = {},
) {
  const device=deviceStorage(downloads.store);
  downloads.store.maintenance=()=>device.enforce();
  const el = (tag, text) => {
      const n = document.createElement(tag);
      if (text !== undefined) n.textContent = text;
      return n;
    },
    button = (text, fn) => {
      const b = el('button', text);
      b.type = 'button';
      b.onclick = async () => {
        b.disabled = true;
        try {
          await fn();
        } catch (e) {
          status.textContent = e.message;
        } finally {
          b.disabled = false;
        }
      };
      return b;
    };
  const section = el('section'),
    status = el('p'),
    list = el('div'),
    size = el('p'),
    limit = el('select');
  section.className = 'storage-controls';
  section.append(el('h3', 'Storage on this device'), size, status);
  for (const mb of [100, 250, 1024]) {
    const o = el(
      'option',
      mb === 1024 ? '1 GB recent cache' : `${mb} MB recent cache`,
    );
    o.value = mb * 1024 ** 2;
    limit.append(o);
  }
  limit.setAttribute('aria-label', 'Recent cache limit');
  limit.value = 250 * 1024 ** 2;
  limit.onchange = async () => {
    await downloads.store.meta('limit', Number(limit.value));
    await device.enforce();
    await draw();
  };
  section.append(
    limit,
    button('Clear recent cache', async () => {
      await device.clearRecent();
      await draw();
    }),
    button('Clear account cache', async()=>{await device.clearAccount();status.textContent='Saved account reads cleared. Saved maps remain available.';await draw();}),
    button('Keep downloaded data on this device', async()=>{status.textContent=await device.keep()?'Browser persistence granted for maps and application data.':'The browser may remove saved data when storage is needed.';await draw();}),
    button('Load without saving', () => {
      downloads.bypass = !downloads.bypass;
      status.textContent = downloads.bypass
        ? 'Network only for this visit.'
        : 'Saving recent data again.';
    }),
    list,
  );
  document.getElementById('system-panel')?.append(section);
  const save = button('Save region offline', async () => {
    const r = region();
    if (!r) return;
    status.textContent = `Saving ${r.name}…`;
    await downloads.saveRegion(r.id);
    status.textContent =
      'Saved on this device. External imagery and social posts still need internet.';
    await draw();
  });
  document.querySelector('.data-source-card .source-actions')?.append(save);
  const callout = el('section');
  callout.id = 'download-callout';
  callout.setAttribute('aria-label', 'Dataset downloads');
  callout.hidden = true;
  document.body.append(callout);
  function progress() {
    let ops = [...downloads.operations.values()].filter(
      (o) => o.state === 'loading' && (o.total || 0) > 5 * 1024 ** 2,
    );
    if (ops.some((o) => o.package)) ops = ops.filter((o) => o.package);
    callout.hidden = !ops.length;
    callout.replaceChildren();
    for (const op of ops) {
      const row = el('div'),
        p = el('progress');
      p.max = op.total;
      p.value = op.loaded;
      row.append(
        el('strong', op.label),
        el(
          'small',
          `${formatBytes(op.loaded)} of ${formatBytes(op.total)} · dataset size`,
        ),
        p,
        button('Cancel', () => op.controller.abort()),
      );
      callout.append(row);
    }
    if (downloads.storageMessage) status.textContent = downloads.storageMessage;
  }
  let drawing = false;
  async function draw() {
    if (drawing) return;
    drawing = true;
    try {
      const application=await device.stats();
      const rows = await downloads.store.all(),
        saved = (await downloads.store.meta('saved')) || [],
        estimate = await navigator.storage?.estimate?.().catch(() => null);
      size.textContent = `${formatBytes(rows.reduce((n, r) => n + r.bytes, 0))} atlas data · ${formatBytes(application.bytes)} application cache (${application.mode})${estimate ? ' · browser uses ' + formatBytes(estimate.usage) + ' of approximately ' + formatBytes(estimate.quota) : ''}`;
      if(application.message)status.textContent=application.message;
      const persistent = await navigator.storage
        ?.persisted?.()
        .catch(() => false);
      size.textContent += persistent
        ? ' · persistent storage granted'
        : ' · browser may remove stored data';
      if (downloads.store.disabled)
        status.textContent =
          'Persistent storage unavailable. Maps continue using the network.';
      limit.value = (await downloads.store.meta('limit')) || 250 * 1024 ** 2;
      list.replaceChildren();
      const keys = new Set(rows.map((r) => r.key));
      for (const item of saved) {
        const complete =
            item.complete && item.keys.every((key) => keys.has(key)),
          row = el('div');
        row.className = 'saved-region';
        row.append(
          el(
            'span',
            `${item.name} · ${complete ? (downloads.latestManifest && item.version !== downloads.latestManifest.revision ? 'Update available · previous version saved' : item.pending ? 'Saved offline · update incomplete' : 'Saved offline') : 'Incomplete — retry to finish'}`,
          ),
          button('Open', () => onOpen(item.id)),
          button('Update / retry', () => downloads.saveRegion(item.id)),
          button('Remove', () => downloads.removeRegion(item.id)),
        );
        list.append(row);
      }
    } finally {
      drawing = false;
    }
  }
  downloads.subscribe(() => {
    progress();
    draw();
  });
  downloads.store.subscribe(() => draw());
  globalThis.addEventListener?.('finfolk:cache-changed',()=>{device.enforce().then(draw).catch(()=>{});});
  globalThis.addEventListener?.('finfolk:cache-status',event=>{
    if(event.detail?.cached){
      status.textContent=`Offline · showing saved application data from ${new Date(event.detail.savedAt).toLocaleString()}.`;
      let notice=document.getElementById('application-cache-notice');
      if(!notice){notice=el('p');notice.id='application-cache-notice';notice.setAttribute('role','status');document.getElementById('app-main')?.prepend(notice);}
      notice.textContent=status.textContent;
    }
    else if(event.detail?.cached===false){
      if(document.getElementById('application-cache-notice'))status.textContent='';
      document.getElementById('application-cache-notice')?.remove();
    }
    else if(event.detail?.message)status.textContent=event.detail.message;
    draw();
  });
  globalThis.addEventListener?.('online',()=>document.getElementById('application-cache-notice')?.remove());
  globalThis.addEventListener?.('finfolk:member-cleared',()=>document.getElementById('application-cache-notice')?.remove());
  draw();
  if (
    'serviceWorker' in navigator &&
    (location.protocol === 'https:' ||
      ['localhost', '127.0.0.1'].includes(location.hostname))
  )
    navigator.serviceWorker
      .register(new URL('./sw.js', downloads.base))
      .catch(() => {
        status.textContent =
          'Offline app startup is unavailable. Downloaded data can still speed up visits.';
      });
  return { draw };
}
