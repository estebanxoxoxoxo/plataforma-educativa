#!/usr/bin/env python3
"""Campaña de tomas de flow-apollo.mjs con compuerta de máquina tranquila (pedido 14-nov).

uso: python3 campaign.py <es|en>   (corre en background; deja todo en campaign-<lang>.log)

Compuerta (antes de CADA arranque): muestra de CPU con `top -l 2 -s 5 -o cpu` (se usa la 2.ª muestra). Pasa si, en DOS
mediciones seguidas separadas por 30 s: WindowServer ≤ 60 %, ningún proceso ajeno > 25 % (se ignoran kernel_task, top, la app de Claude,
com.apple.Virtualization y lo de la grabación) y load de 1 min < 4. Si no, espera 60 s y mide de
nuevo, hasta 3 HORAS de espera acumulada por campaña. Cada medición queda en el log.

Arranques: hasta 8 por idioma; hasta 3 tomas COMPLETAS (las que llegaron a generar la ruta). Un arranque que aborta antes
de generar no cuenta como toma. En castellano, los arranques pares usan la frase alternativa del chat (CHAT_ES2=1).
Fluidez (cuadros repetidos, syncstat): ≤10 % buena → fin; 10–15 % candidata (sigue si quedan topes); >15 % descartada.
"""
import json, os, re, shutil, subprocess, sys, time

L = sys.argv[1]
assert L in ('es', 'en')
HERE = os.path.dirname(os.path.abspath(__file__))
os.chdir(HERE)
LOG = open(f'campaign-{L}.log', 'a', buffering=1)
ENV = dict(os.environ, PLAYWRIGHT_BROWSERS_PATH=os.path.join(HERE, '..', 'flow-en', 'ms-playwright'))
FF = [os.path.join(r, f) for r, _, fs in os.walk(ENV['PLAYWRIGHT_BROWSERS_PATH']) for f in fs if f == 'ffmpeg-mac'][0]
ENV['FF'] = FF
MAX_WAIT = 3 * 3600
MAX_STARTS, MAX_FULL = 8, 3
# Ajeno = todo menos: kernel_task, top, WindowServer (aparte), la app de Claude (dibuja la sesión: está siempre y estaba
# también en las tomas buenas), com.apple.Virtualization y lo de la grabación (node del guion, Chrome headless de Playwright:
# entre tomas no corren). Ajuste del coordinador, 14-nov.
IGNORE = ('kernel_task', 'top', 'claude', 'Claude', 'com.apple.Virtua')


def log(*a):
    LOG.write(time.strftime('%H:%M:%S ') + ' '.join(str(x) for x in a) + '\n')


def sample():
    out = subprocess.run(['top', '-l', '2', '-s', '5', '-o', 'cpu', '-n', '15', '-stats', 'pid,cpu,command'],
                         capture_output=True, text=True).stdout
    block = out.split('PID')[-1].splitlines()[1:]  # 2.ª muestra
    ws, other = 0.0, ('-', 0.0)
    for line in block:
        m = re.match(r'\s*(\d+)\s+([\d.]+)\s+(.*)$', line)
        if not m:
            continue
        cpu, cmd = float(m.group(2)), m.group(3).strip()
        if cmd.startswith('WindowServer'):
            ws = max(ws, cpu)
        elif not cmd.startswith(IGNORE) and cpu > other[1]:
            other = (f'{cmd}({m.group(1)})', cpu)
    load = float(subprocess.run(['sysctl', '-n', 'vm.loadavg'], capture_output=True, text=True).stdout.split()[1])
    ok = ws <= 60 and other[1] <= 25 and load < 4
    log(f'MEDICION ws={ws:.1f}% mayor_ajeno={other[0]} {other[1]:.1f}% load1={load:.2f} -> {"ok" if ok else "no"}')
    return ok


waited = 0.0


def gate():
    """Devuelve True cuando hubo dos mediciones ok seguidas (30 s); False si se agotaron las 3 h."""
    global waited
    t0 = time.time()
    while True:
        if sample():
            time.sleep(30)
            if sample():
                waited += time.time() - t0
                log(f'COMPUERTA ABIERTA tras {time.time() - t0:.0f} s (espera acumulada {waited / 60:.1f} min)')
                return True
        if waited + (time.time() - t0) > MAX_WAIT:
            waited += time.time() - t0
            log('COMPUERTA: 3 h de espera sin ventana tranquila')
            return False
        time.sleep(60)


def smooth(cuts_file):
    r = subprocess.run(['node', 'syncstat.mjs', cuts_file, os.path.join(HERE, 'syncstat-tmp.webm')],
                       capture_output=True, text=True, env=dict(ENV, SYNC_ONLY='1'))
    m = re.search(r'congelados ([\d.]+)%', r.stdout + r.stderr)
    return float(m.group(1)) if m else 999.0


starts = full = 0
results = []
while starts < MAX_STARTS and full < MAX_FULL:
    if not gate():
        break
    starts += 1
    tag = f'c{starts}'
    env = dict(ENV, FLOW_LANG=L, DSF='3', MODE='full', NORETRY='1')
    if L == 'es' and starts % 2 == 0:
        env['CHAT_ES2'] = '1'
    log(f'ARRANQUE {tag} (frase {"alternativa" if env.get("CHAT_ES2") else "de siempre"}) load {subprocess.run(["sysctl","-n","vm.loadavg"],capture_output=True,text=True).stdout.strip()}')
    with open(f'take-{L}-{tag}.log', 'w') as f:
        subprocess.run(['node', 'flow-apollo.mjs'], stdout=f, stderr=subprocess.STDOUT, env=env)
    any_json = f'cuts-{L}-full-caratula-inicio-caratula-fin.json'
    try:
        rep = json.load(open(any_json))
    except Exception as e:
        log('SIN REPORTE', e); continue
    shutil.copy(any_json, f'cuts-{L}-{tag}.json')
    generated = any(e['name'] == 'generando' for e in rep.get('events', []))
    if generated:
        full += 1
    pct = smooth(f'cuts-{L}-{tag}.json')
    load_end = subprocess.run(['sysctl', '-n', 'vm.loadavg'], capture_output=True, text=True).stdout.strip()
    verdict = ('buena' if pct <= 10 else 'candidata' if pct <= 15 else 'descartada') if rep.get('ok') else 'abortada'
    log(f'RESULTADO {tag} ok={rep.get("ok")} error={rep.get("error")} generó={generated} repetidos={pct:.1f}% '
        f'load_fin={load_end} -> {verdict} (arranques {starts}/{MAX_STARTS}, completas {full}/{MAX_FULL})')
    results.append({'tag': tag, 'ok': rep.get('ok'), 'pct': pct, 'verdict': verdict, 'route': (rep.get('savedRoute') or {}).get('id')})
    if verdict == 'buena':
        break

best = sorted([r for r in results if r['verdict'] in ('buena', 'candidata')], key=lambda r: r['pct'])
log('FIN', json.dumps({'results': results, 'elegida': best[0] if best else None, 'espera_min': round(waited / 60, 1)}, ensure_ascii=False))
print('FIN', json.dumps({'elegida': best[0] if best else None}))
