const $ = id => document.getElementById(id);

function parseIp(s) {
  const p = s.trim().split('.');
  if (p.length !== 4) return null;
  let v = 0;
  for (const x of p) {
    if (!/^\d{1,3}$/.test(x) || +x > 255) return null;
    v = v * 256 + +x;
  }
  return v;
}
const toIp = v => [24, 16, 8, 0].map(s => (v / 2 ** s) & 255).join('.');
const maskOf = n => n === 0 ? 0 : (0xFFFFFFFF << (32 - n)) >>> 0;
const bin32 = v => (v >>> 0).toString(2).padStart(32, '0');

// Binario a ottetti con classi colore: rete originale, bit di sottorete, bit host
function colorBin(v, netBits, newBits) {
  const b = bin32(v);
  let html = '';
  for (let i = 0; i < 32; i++) {
    if (i && i % 8 === 0) html += '.';
    const cls = i < netBits ? 'net' : i < newBits ? 'sub' : 'host';
    html += `<span class="${cls}">${b[i]}</span>`;
  }
  return `<span class="bin">${html}</span>`;
}

function validate(ipStr, bits) {
  const ip = parseIp(ipStr);
  if (ip === null) return 'Indirizzo IP non valido.';
  if (!Number.isInteger(bits) || bits < 0 || bits > 32) return 'I bit di rete devono essere tra 0 e 32.';
  return null;
}

function hostsOf(prefix) {
  if (prefix >= 31) return prefix === 31 ? 2 : 1;
  return 2 ** (32 - prefix) - 2;
}

function calc1() {
  const bits = parseInt($('bits1').value, 10);
  const err = validate($('ip1').value, bits);
  if (err) { $('out1').innerHTML = `<div class="err">${err}</div>`; return; }
  const ip = parseIp($('ip1').value);
  const mask = maskOf(bits);
  const net = (ip & mask) >>> 0;
  const bc = (net | ~mask) >>> 0;
  const first = bits >= 31 ? net : net + 1;
  const last = bits >= 31 ? bc : bc - 1;
  $('out1').innerHTML = `
    <table>
      <tr><th>Subnet mask</th><td>${toIp(mask)} (/${bits})</td></tr>
      <tr><th>Mask binaria</th><td>${colorBin(mask, bits, bits)}</td></tr>
      <tr><th>IP binario</th><td>${colorBin(ip, bits, bits)}</td></tr>
      <tr><th>Indirizzo di rete</th><td>${toIp(net)}</td></tr>
      <tr><th>Broadcast</th><td>${toIp(bc)}</td></tr>
      <tr><th>Range host</th><td>${toIp(first)} – ${toIp(last)}</td></tr>
      <tr><th>Host utilizzabili</th><td>${hostsOf(bits)}</td></tr>
    </table>
    <p class="legend"><span class="net">1 / bit di rete</span><span class="host">bit di host</span></p>`;
}

function calc2() {
  const bits = parseInt($('bits2').value, 10);
  const n = parseInt($('n2').value, 10);
  let err = validate($('ip2').value, bits);
  if (!err && (!Number.isInteger(n) || n < 1)) err = 'Il numero di sottoreti deve essere almeno 1.';
  let borrowed = 0;
  if (!err) {
    borrowed = Math.ceil(Math.log2(n));
    if (bits + borrowed > 32) err = 'Non ci sono abbastanza bit host per ottenere quel numero di sottoreti.';
    else if (borrowed > 16) err = 'Troppe sottoreti da visualizzare (massimo 65536).';
  }
  if (err) { $('out2').innerHTML = `<div class="err">${err}</div>`; return; }

  const ip = parseIp($('ip2').value);
  const newBits = bits + borrowed;
  const mask = maskOf(newBits);
  const base = (ip & maskOf(bits)) >>> 0;
  const total = 2 ** borrowed;
  const step = 2 ** (32 - newBits);

  let rows = '';
  for (let i = 0; i < total; i++) {
    const net = base + i * step;
    const bc = net + step - 1;
    const first = newBits >= 31 ? net : net + 1;
    const last = newBits >= 31 ? bc : bc - 1;
    const line = (label, v) => `<tr><td>${label}</td><td>${toIp(v)}</td><td>${colorBin(v, bits, newBits)}</td></tr>`;
    rows += `<tr><th colspan="3">Sottorete ${i}${i >= n ? ' (extra)' : ''} – ${toIp(net)}/${newBits}</th></tr>`
      + line('Indirizzo di rete', net)
      + line('Primo host', first)
      + line('Ultimo host', last)
      + line('Broadcast', bc);
  }

  $('out2').innerHTML = `
    <p>Rete di partenza: <b>${toIp(base)}/${bits}</b> · Nuova mask: <b>${toIp(mask)} (/${newBits})</b></p>
    <ol>
      <li><b>Bit di sottorete</b>: servono ${n} sottoreti, quindi si prendono in prestito <i>s</i> bit tali che 2<sup>s</sup> ≥ ${n}.
        Qui s = <b>${borrowed}</b> (2<sup>${borrowed}</sup> = ${total} sottoreti).</li>
      <li><b>Nuovo prefisso</b>: ${bits} (bit di rete) + ${borrowed} (bit di sottorete) = <b>/${newBits}</b>.</li>
      <li><b>Bit di host</b>: 32 − ${newBits} = <b>${32 - newBits}</b>.</li>
      <li><b>Host per sottorete</b>: 2<sup>${32 - newBits}</sup> − 2 = ${2 ** (32 - newBits)} − 2 = <b>${hostsOf(newBits)}</b>
        (si tolgono 2 indirizzi: quello di rete, con tutti i bit host a 0, e il broadcast, con tutti i bit host a 1).</li>
    </ol>
    <p>Mask binaria: ${colorBin(mask, bits, newBits)}</p>
    <p class="legend"><span class="net">bit di rete originali</span>
      <span class="sub">bit di sottorete (variano)</span>
      <span class="host">bit di host</span></p>
    <div class="scroll"><table>
      ${rows}
    </table></div>`;
}

$('b1').onclick = calc1;
$('b2').onclick = calc2;
$('b3').onclick = calc3;
$('ip3').addEventListener('keydown', e => e.key === 'Enter' && calc3());

function calc3() {
  const ip = parseIp($('ip3').value);
  if (ip === null) { $('out3').innerHTML = '<div class="err">Indirizzo IP non valido.</div>'; return; }
  const o1 = ip >>> 24, o2 = (ip >>> 16) & 255;
  let cls, mask = '–', note = '';
  if (o1 < 128) { cls = 'A'; mask = '255.0.0.0 (/8)'; }
  else if (o1 < 192) { cls = 'B'; mask = '255.255.0.0 (/16)'; }
  else if (o1 < 224) { cls = 'C'; mask = '255.255.255.0 (/24)'; }
  else if (o1 < 240) cls = 'D';
  else cls = 'E';

  let kind = 'N/A';
  if (cls <= 'C') {
    if (o1 === 10 || (o1 === 172 && o2 >= 16 && o2 <= 31) || (o1 === 192 && o2 === 168)) kind = 'Privato';
    else if (o1 === 127) { kind = 'Speciale'; note = 'Loopback (127.0.0.0/8)'; }
    else if (o1 === 169 && o2 === 254) { kind = 'Speciale'; note = 'Link-local / APIPA (169.254.0.0/16)'; }
    else if (o1 === 0) { kind = 'Speciale'; note = 'Rete "questa rete" (0.0.0.0/8)'; }
    else kind = 'Pubblico';
  } else note = cls === 'D' ? 'Multicast' : 'Riservata / sperimentale';

  $('out3').innerHTML = `<table>
    <tr><th>IP</th><td>${toIp(ip)}</td></tr>
    <tr><th>IP binario</th><td class="bin">${bin32(ip).replace(/(.{8})(?!$)/g, '$1.')}</td></tr>
    <tr><th>Classe</th><td>${cls}</td></tr>
    <tr><th>Mask predefinita</th><td>${mask}</td></tr>
    <tr><th>Pubblico / Privato</th><td>${kind}</td></tr>
    ${note ? `<tr><th>Note</th><td>${note}</td></tr>` : ''}
  </table>`;
}
function calc4() {
  const mask = parseIp($('mask4').value);
  let err = null;
  if (mask === null) err = 'Subnet mask non valida.';
  const prefix = mask === null ? 0 : bin32(mask).indexOf('0') === -1 ? 32 : bin32(mask).indexOf('0');
  if (!err && (mask >>> 0) !== maskOf(prefix)) err = 'La subnet mask non è valida: deve essere formata da 1 consecutivi seguiti da 0 (es. 255.255.255.192).';
  if (!err && prefix > 30) err = 'La mask lascia meno di 2 bit di host: non ci sono host utilizzabili.';
  if (err) { $('out4').innerHTML = `<div class="err">${err}</div>`; return; }

  const oct = [24, 16, 8, 0].map(s => (mask >>> s) & 255);
  const k = oct.findIndex(o => o !== 255);
  const m = prefix - 8 * k;
  const hostBits = 32 - prefix;
  const total = 2 ** m;
  const step = 2 ** (8 - m);
  const letters = ['x', 'y', 'z'].slice(0, k);
  const fixed = letters.length ? letters.join('.') + '.' : '';

  const addr = (v, tail) => {
    const parts = [...letters, v];
    while (parts.length < 4) parts.push(tail);
    return parts.join('.');
  };
  const binOct = v => {
    const b = v.toString(2).padStart(8, '0');
    return `<span class="bin"><span class="sub">${b.slice(0, m)}</span><span class="host">${b.slice(m)}</span></span>`;
  };

  let rows = '';
  for (let i = 0; i < total; i++) {
    const v = i * step;
    const w = v + step - 1;
    const row = (label, text, bits) => `<tr><td>${label}</td><td>${text}</td><td>${bits}</td></tr>`;
    const firstTxt = k === 3 ? addr(v + 1, 0) : addr(v, 0).replace(/\.0$/, '.1');
    const lastTxt = k === 3 ? addr(w - 1, 0) : addr(w, 255).replace(/\.255$/, '.254');
    rows += `<tr><th colspan="3">Sottorete ${i}</th></tr>`
      + row('Indirizzo di rete', addr(v, 0), `ottetto ${k + 1}: ${binOct(v)}`)
      + row('Primo host', firstTxt, `ottetto ${k + 1}: ${binOct(k === 3 ? v + 1 : v)}`)
      + row('Ultimo host', lastTxt, `ottetto ${k + 1}: ${binOct(k === 3 ? w - 1 : w)}`)
      + row('Broadcast', addr(w, 255), `ottetto ${k + 1}: ${binOct(w)}`);
  }

  const maskBin = bin32(mask).replace(/(.{8})(?!$)/g, '$1.');
  const letterNote = letters.length
    ? `Gli ottetti a 255 sono la parte di rete fissa e vengono indicati con <b>${letters.join(', ')}</b> (valori qualsiasi).`
    : 'Nessun ottetto è a 255: tutta la rete è variabile.';

  $('out4').innerHTML = `
    <ol>
      <li><b>Prefisso</b>: ${toIp(mask)} in binario è <span class="bin">${maskBin}</span>, con ${prefix} bit a 1, quindi <b>/${prefix}</b>.</li>
      <li><b>Ottetti di rete</b>: ${letterNote}</li>
      <li><b>Ottetto che varia</b>: il ${k + 1}° ottetto (${oct[k]}) ha <b>${m}</b> bit a 1, che sono i bit di sottorete.</li>
      <li><b>Numero di sottoreti</b>: 2<sup>${m}</sup> = <b>${total}</b>.</li>
      <li><b>Bit di host</b>: 32 − ${prefix} = <b>${hostBits}</b>.</li>
      <li><b>Host per sottorete</b>: 2<sup>${hostBits}</sup> − 2 = ${2 ** hostBits} − 2 = <b>${hostsOf(prefix)}</b>
        (si tolgono l'indirizzo di rete e il broadcast).</li>
      <li><b>Salto tra sottoreti</b> nel ${k + 1}° ottetto: 2<sup>${8 - m}</sup> = <b>${step}</b>.</li>
    </ol>
    <p class="legend"><span class="sub">bit di sottorete (variano)</span><span class="host">bit di host</span></p>
    <div class="scroll"><table>${rows}</table></div>`;
}
$('b4').onclick = calc4;
$('mask4').addEventListener('keydown', e => e.key === 'Enter' && calc4());

function calc5() {
  const ip = parseIp($('ip5').value);
  const n = parseInt($('n5').value, 10);
  let err = null;
  if (ip === null) err = 'Indirizzo IP non valido.';
  else if (!Number.isInteger(n) || n < 1) err = 'Il numero di sottoreti deve essere almeno 1.';
  const o1 = ip === null ? 0 : ip >>> 24;
  if (!err && o1 >= 224) err = 'Le classi D ed E non hanno una mask predefinita: non si possono suddividere in sottoreti.';
  const bits = o1 < 128 ? 8 : o1 < 192 ? 16 : 24;
  const borrowed = err ? 0 : Math.ceil(Math.log2(n));
  if (!err && bits + borrowed > 30) err = 'Non ci sono abbastanza bit host per ottenere quel numero di sottoreti.';
  if (!err && borrowed > 12) err = 'Troppe sottoreti da visualizzare (massimo 4096).';
  if (err) { $('out5').innerHTML = `<div class="err">${err}</div>`; return; }

  const cls = o1 < 128 ? 'A' : o1 < 192 ? 'B' : 'C';
  const newBits = bits + borrowed;
  const hostBits = 32 - newBits;
  const total = 2 ** borrowed;
  const step = 2 ** hostBits;
  const base = (ip & maskOf(bits)) >>> 0;
  const oct = Math.ceil(newBits / 8) - 1;
  const r = newBits - 8 * oct;
  const jump = 2 ** (8 - r);

  const maskOct = [24, 16, 8, 0].map(s => (maskOf(newBits) >>> s) & 255);
  // indirizzo con l'ottetto critico evidenziato
  const hl = v => toIp(v).split('.').map((o, i) => i === oct ? `<b class="crit">${o}</b>` : o).join('.');

  let rows = '';
  for (let i = 0; i < total; i++) {
    const net = base + i * step;
    const bc = net + step - 1;
    rows += `<tr><td>${i + 1}${i >= n ? ' <small>(extra)</small>' : ''}</td><td>${hl(net)}/${newBits}</td>
      <td>${hl(net)} – ${hl(bc)}</td><td>${hl(net + 1)} – ${hl(bc - 1)}</td></tr>`;
  }

  const octBox = (i) => {
    const role = i < oct ? ['fix', 'rete fissa'] : i === oct ? ['crit', 'ottetto critico'] : ['host', 'host 0–255'];
    return `<div class="octbox ${role[0]}"><div class="octval">${maskOct[i]}</div>
      <div class="octbin">${maskOct[i].toString(2).padStart(8, '0')}</div><div class="octrole">${role[1]}</div></div>`;
  };
  const chip = (label, value) => `<div class="chip"><span>${label}</span><b>${value}</b></div>`;

  $('out5').innerHTML = `
    <div class="chips">
      ${chip('Classe', `${cls} (/${bits})`)}
      ${chip('Bit di sottorete', `${borrowed} → 2<sup>${borrowed}</sup> = ${total}`)}
      ${chip('Nuova mask', `${toIp(maskOf(newBits))} (/${newBits})`)}
      ${chip('Host / sottorete', `2<sup>${hostBits}</sup> − 2 = ${step - 2}`)}
    </div>
    <h3>Dov'è il salto?</h3>
    <div class="octrow">${[0, 1, 2, 3].map(octBox).join('<div class="dot">.</div>')}</div>
    <div class="jumpbox">Salto = <b>${jump}</b> nell'ottetto <b>${oct + 1}</b>
      <small>(2<sup>${8 - r}</sup> = 256 − ${maskOct[oct]})</small></div>
    <div class="formula">
      <div><span>Prima rete</span><b>${hl(base)}</b></div>
      <div class="op">+ ${jump} sull'ottetto ${oct + 1} →</div>
      <div><span>Rete successiva</span><b>${hl(base + step)}</b></div>
    </div>
    <ul class="mini">
      <li>Broadcast = rete successiva − 1 → <b>${hl(base + step - 1)}</b></li>
      <li>Primo host = rete + 1 · Ultimo host = broadcast − 1</li>
      <li>Oltre 255 si riporta +1 sull'ottetto a sinistra</li>
    </ul>
    <div class="scroll"><table>
      <tr><th>#</th><th>Sottorete</th><th>Intervallo di rete (rete – broadcast)</th><th>Intervallo host</th></tr>
      ${rows}
    </table></div>`;
}
$('b5').onclick = calc5;
['ip5', 'n5'].forEach(i => $(i).addEventListener('keydown', e => e.key === 'Enter' && calc5()));

// Accetta "/22", "22" oppure "255.255.252.0"; restituisce il prefisso o null
function parseMask(s) {
  s = s.trim();
  const m = s.match(/^\/?(\d{1,2})$/);
  if (m) return +m[1] <= 32 ? +m[1] : null;
  const v = parseIp(s);
  if (v === null) return null;
  const b = bin32(v);
  const p = b.indexOf('0') === -1 ? 32 : b.indexOf('0');
  return (v >>> 0) === maskOf(p) ? p : null;
}

// Binario a ottetti: bit di rete in blu, host in verde; se "ref" è dato, i bit di rete diversi diventano rossi
function andBin(v, prefix, ref) {
  const b = bin32(v), r = ref === undefined ? null : bin32(ref);
  let html = '';
  for (let i = 0; i < 32; i++) {
    if (i && i % 8 === 0) html += '.';
    const cls = i >= prefix ? 'host' : r !== null && b[i] !== r[i] ? 'diff' : 'net';
    html += `<span class="${cls}">${b[i]}</span>`;
  }
  return `<span class="bin">${html}</span>`;
}

function verdictBadge(ok, yes, no) {
  return `<div class="verdict ${ok ? 'yes' : 'no'}">${ok ? '✔ ' + yes : '✘ ' + no}</div>`;
}

function calc6() {
  const a = parseIp($('ipa6').value), b = parseIp($('ipb6').value), p = parseMask($('mask6').value);
  const err = a === null ? 'IP 1 non valido.' : b === null ? 'IP 2 non valido.' : p === null ? 'Mask non valida (es. 255.255.252.0 oppure /22).' : null;
  if (err) { $('out6').innerHTML = `<div class="err">${err}</div>`; return; }
  const mask = maskOf(p);
  const na = (a & mask) >>> 0, nb = (b & mask) >>> 0;
  const same = na === nb;
  const row = (l, v, bin) => `<tr><td>${l}</td><td>${v}</td><td>${bin}</td></tr>`;
  $('out6').innerHTML = `
    ${verdictBadge(same, 'Stessa sottorete', 'Sottoreti diverse')}
    <div class="scroll"><table class="and-table">
      <tr><th></th><th>Decimale</th><th>Binario (IP AND mask)</th></tr>
      ${row('IP 1', toIp(a), andBin(a, p))}
      ${row('IP 2', toIp(b), andBin(b, p))}
      ${row('Mask /' + p, toIp(mask), andBin(mask, p))}
      ${row('Rete di IP 1', `<b>${toIp(na)}</b>`, andBin(na, p))}
      ${row('Rete di IP 2', `<b>${toIp(nb)}</b>`, andBin(nb, p, na))}
    </table></div>
    <p class="legend"><span class="net">bit di rete</span><span class="host">bit di host</span><span class="diff">bit di rete diversi</span></p>
    ${netList6(na, nb, p)}`;
}

// Elenco delle reti (rete – broadcast) dalla precedente alla successiva a quelle dei due IP
function netList6(na, nb, p) {
  const size = p === 0 ? 2 ** 32 : 2 ** (32 - p);
  const lo = Math.min(na, nb), hi = Math.max(na, nb);
  let from = Math.max(0, lo - size), to = Math.min(2 ** 32 - size, hi + size);
  const list = [];
  if ((to - from) / size + 1 > 64) list.push(lo, ...(hi !== lo ? [hi] : []));
  else for (let n = from; n <= to; n += size) list.push(n);
  let rows = '';
  for (const n of list) {
    const tag = [n === na ? 'IP 1' : '', n === nb ? 'IP 2' : ''].filter(Boolean).join(' + ');
    rows += `<tr class="${tag ? 'hit' : ''}"><td>${toIp(n)}</td><td>${toIp(n + size - 1)}</td><td>${tag}</td></tr>`;
  }
  return `<h3>Elenco delle reti /${p}</h3>
    <div class="scroll"><table>
      <tr><th>Indirizzo di rete</th><th>Broadcast</th><th></th></tr>${rows}
    </table></div>`;
}

function calc7() {
  const ip = parseIp($('ip7').value), net = parseIp($('net7').value), p = parseMask($('mask7').value);
  const err = ip === null ? 'IP non valido.' : net === null ? 'Indirizzo di rete non valido.' : p === null ? 'Prefisso / mask non valido (es. /20).' : null;
  if (err) { $('out7').innerHTML = `<div class="err">${err}</div>`; return; }
  const mask = maskOf(p);
  const ipNet = (ip & mask) >>> 0;
  const netAddr = (net & mask) >>> 0;
  const inside = ipNet === netAddr;
  const bc = (netAddr | ~mask) >>> 0;
  const row = (l, v, bin) => `<tr><td>${l}</td><td>${v}</td><td>${bin}</td></tr>`;
  const warn = netAddr !== net >>> 0
    ? `<div class="err">Attenzione: ${toIp(net)} non è un indirizzo di rete per /${p}; si usa ${toIp(netAddr)}.</div>` : '';
  $('out7').innerHTML = `
    ${warn}${verdictBadge(inside, 'Appartiene alla rete', 'Non appartiene alla rete')}
    <div class="scroll"><table class="and-table">
      <tr><th></th><th>Decimale</th><th>Binario</th></tr>
      ${row('IP', toIp(ip), andBin(ip, p))}
      ${row('Mask /' + p, toIp(mask), andBin(mask, p))}
      ${row('IP AND mask', `<b>${toIp(ipNet)}</b>`, andBin(ipNet, p, netAddr))}
      ${row('Rete data', `<b>${toIp(netAddr)}</b>`, andBin(netAddr, p))}
    </table></div>
    <p class="legend"><span class="net">bit di rete</span><span class="host">bit di host</span><span class="diff">bit di rete diversi</span></p>
    <div class="formula">
      <div><span>Primo indirizzo</span><b>${toIp(netAddr)}</b></div>
      <div class="op">→</div>
      <div><span>Ultimo indirizzo</span><b>${toIp(bc)}</b></div>
      <div class="op">${inside ? '✔' : '✘'} ${toIp(ip)} ${inside ? 'è' : 'non è'} nell'intervallo</div>
    </div>`;
}
$('b6').onclick = calc6;
$('b7').onclick = calc7;
['ipa6', 'ipb6', 'mask6'].forEach(i => $(i).addEventListener('keydown', e => e.key === 'Enter' && calc6()));
['ip7', 'net7', 'mask7'].forEach(i => $(i).addEventListener('keydown', e => e.key === 'Enter' && calc7()));

['ip1', 'bits1'].forEach(i => $(i).addEventListener('keydown', e => e.key === 'Enter' && calc1()));
['ip2', 'bits2', 'n2'].forEach(i => $(i).addEventListener('keydown', e => e.key === 'Enter' && calc2()));
document.querySelectorAll('.tab').forEach(t => t.onclick = () => {
  document.querySelectorAll('.tab, .panel').forEach(e => e.classList.remove('active'));
  t.classList.add('active');
  $(t.dataset.target).classList.add('active');
});
