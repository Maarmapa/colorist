// Ensayo del guion de la demo, para correr en la consola del navegador.
//
// NO es para grabar: en el video el que maneja es el agente, no un script.
// Esto existe para ensayar antes, y sobre todo para detectar el escenario que
// arruina una grabación — que el stock cambie entre el ensayo y la toma y el
// plan devuelva otra cosa. Corriéndolo tres veces seguidas se ve si el flujo es
// estable o si hay un tono al borde del quiebre que conviene evitar.
//
// Uso: pegar en la consola de la página abierta.
//
//   await fetch('/scripts/rehearse.mjs').then(r=>r.text()).then(eval)
//
// o copiar el cuerpo de `ensayo()` a mano.

export async function ensayo({ verbose = true } = {}) {
  const t = navigator.modelContextTesting;
  if (!t) {
    console.error('Sin shim de pruebas. Abrí con ?webmcp o en un navegador con WebMCP nativo.');
    return null;
  }

  const tools = async () => (await document.modelContext.getTools()).map((x) => x.name).sort();
  const esperar = (ms = 800) => new Promise((r) => setTimeout(r, ms));
  const llamar = async (n, a = {}) => JSON.parse(await t.executeTool(n, JSON.stringify(a)));

  try { localStorage.clear(); } catch {}
  await esperar(300);

  const pasos = [];
  const anotar = (o) => { pasos.push(o); if (verbose) console.log(o); };

  anotar({
    paso: '0 · arranque',
    stock: document.getElementById('stock-banner')?.textContent,
    tools: (await tools()).length,
  });

  await llamar('set_targets', { colors: ['#8a4b2a', '#f5e3da', '#3a8dc7', '#1d3557', '#2a9d8f'] });
  await llamar('set_surface', { surface: 'paper' });
  await esperar();

  anotar({
    paso: '1 · paleta y superficie puestas',
    prepare_order: (await tools()).includes('prepare_order'),
    esperado: true,
  });

  const plan = await llamar('plan_purchase');
  anotar({
    paso: '2 · el plan',
    recomendados: plan.recommended?.length,
    total_clp: plan.totalClp,
    // Esta es la línea del video. Si sale vacía, el plan llegó a lo
    // imperceptible antes de encontrar un paso inútil: cambiá un objetivo.
    no_comprar: plan.steps?.filter((s) => !s.worth).map((s) => `${s.code} solo compra ΔE ${s.buys}`),
  });

  await llamar('update_kit', { add: (plan.recommended ?? []).map((r) => ({ card: r.card, code: r.code })) });
  await esperar(1400);

  anotar({
    paso: '3 · EL MOMENTO',
    prepare_order: (await tools()).includes('prepare_order'),
    esperado: false,
    motivo_en_pantalla: document.querySelector('.toollist li.off em')?.textContent,
  });

  // Lo que puede arruinar la toma, revisado antes y no después.
  const avisos = [];
  const p1 = pasos[1], p3 = pasos[3];
  if (!p1?.prepare_order) avisos.push('⚠️ prepare_order NO apareció con la paleta puesta — sin esto no hay demo.');
  if (p3?.prepare_order) avisos.push('⚠️ prepare_order NO desapareció — el momento del video no ocurre.');
  if (!pasos[2]?.no_comprar?.length) avisos.push('⚠️ el plan no encontró un paso "no lo compres": cambiá un color objetivo.');
  if (!String(pasos[0]?.stock).includes('live')) avisos.push('⚠️ modo snapshot: sin stock vivo la app se niega a recomendar. Revisá /api/catalog.');

  console.log(avisos.length ? avisos.join('\n') : '✅ el guion corre limpio de punta a punta');
  return { pasos, avisos };
}

if (typeof window !== 'undefined') Object.assign(window, { ensayo });
