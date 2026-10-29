import { afterEach, describe, expect, it, vi } from 'vitest';

/* U5-A (docs/U5-LIGA-FAMILIAR-Y-MEDALLAS.md §3.4): el premio de la liga de la familia como canje "de la liga" en el slice del
   chico — itemId 0 y price 0 (no es un ítem ni mueve ⚡), lo lista Tus canjes / Familia → Premios y lo entrega el MISMO
   "Ya se lo di". market.ts de verdad; se mockea parent.json ('../parent'), el set de accesorios ('../identity') y se esconde
   wishlist.json (node:fs: existsSync false para ese archivo, así el módulo no lo lee ni lo escribe). */

vi.mock('node:fs', async (orig) => {
  const fs = await orig<typeof import('node:fs')>();
  return { ...fs, existsSync: (p: string) => (String(p).includes('wishlist') ? false : fs.existsSync(p)) };
});
vi.mock('../identity', () => ({ ACCESSORY_IDS: ['gorra', 'vincha', 'lazo', 'anteojos', 'auriculares', 'corona'] }));
vi.mock('../parent', () => ({
  anyParentItem: () => undefined, featureOn: (_k: string, id: string) => id === 'ian' || id === 'luna', policyItems: () => [], policyMemberId: () => null,
  // la política vigente del pedido: un premio común de Ian (el #4, la bici) para el canje de siempre
  policyItem: (id: number) => (id === 4 ? { id: 4, emoji: '🚲', title: '1 hora de bici en la plaza', price: 200, stock: null, archived: false, createdAt: 0 } : undefined),
  itemOwner: (id: number) => (id >= 1 && id <= 8 ? 'ian' : id >= 9 && id <= 16 ? 'luna' : undefined),
}));

const M = await import('../market');
const P = await import('../progress');
const { runAsUser } = await import('../requestContext');

afterEach(() => { M.resetMarket(); P.resetProgress(); });

describe('FS-BASE-B (hallazgo market.ts:90): los ids de canje no vuelven a 1 con el reset del chico', () => {
  it('Ian canjea A, hace F5 y canjea B: B tiene OTRO id y el «Ya se lo di» de la lista vieja (A) no entrega B', () => {
    const a = runAsUser('ian', () => M.redeem(4)).body.redemption!;
    M.resetMarket('ian'); // el F5 de Ian (POST /api/demo/reset): antes el seq de su slice volvía a 1
    const b = runAsUser('ian', () => M.redeem(4)).body.redemption!;
    expect(b.id).not.toBe(a.id);
    expect(b.id).toBeGreaterThan(a.id); // el contador del proceso solo crece
    expect(M.deliverRedemption(a.id, 'ian')).toBe(false); // "ese canje ya no existe" (RewardsPanel)
    expect(M.listRedemptions('ian')).toEqual([expect.objectContaining({ id: b.id, status: 'pendiente' })]);
  });
  it('lo mismo con el premio de la liga de la familia (grantFamilyPrize usa el mismo contador)', () => {
    const a = M.grantFamilyPrize('luna', { emoji: '📚', title: 'Un libro' }, 1);
    M.resetMarket('luna');
    const b = M.grantFamilyPrize('luna', { emoji: '🍦', title: 'Helado' }, 2);
    expect(b.id).not.toBe(a.id);
    expect(M.deliverRedemption(a.id, 'luna')).toBe(false);
    expect(M.listRedemptions('luna')[0]).toMatchObject({ id: b.id, status: 'pendiente' });
  });
});

describe('grantFamilyPrize: el canje "de la liga"', () => {
  it('queda pendiente en el slice del chico, sin ⚡ ni stock; Tus canjes y Familia lo listan', () => {
    const ec = P.summaryOf('ian').ec;
    const r = M.grantFamilyPrize('ian', { emoji: '🚲', title: '1 hora de bici' }, 1234);
    // FS-BASE-B (hallazgo market.ts:90): el id ya no es "1 del slice" sino el contador del proceso (no vuelve a 1 con un reset)
    expect(r).toMatchObject({ itemId: 0, price: 0, status: 'pendiente', origin: 'liga-familia', closedAt: 1234, emoji: '🚲', title: '1 hora de bici' });
    expect(Number.isSafeInteger(r.id) && r.id > 0).toBe(true);
    expect(P.summaryOf('ian').ec).toBe(ec); // ningún ⚡ entra ni sale
    expect(M.listRedemptions('ian')).toEqual([r]);
    expect(M.listRedemptions('luna')).toEqual([]); // es de SU slice
    expect(M.redeemedCount(0)).toBe(1); // itemId 0 no es ningún premio real (los ids arrancan en 1): no toca stock de nadie
    expect(M.redeemedCount(4)).toBe(0);
  });
  it('el adulto lo entrega con el mismo "Ya se lo di" (solo en el integrante correcto); el reset del chico lo borra', () => {
    const r = M.grantFamilyPrize('luna', { emoji: '📚', title: 'Un libro' }, 1);
    expect(M.deliverRedemption(r.id, 'ian')).toBe(false); // canje de otro integrante
    expect(M.deliverRedemption(r.id, 'luna')).toBe(true);
    expect(M.deliverRedemption(r.id, 'luna')).toBe(true); // idempotente
    expect(M.listRedemptions('luna')[0]).toMatchObject({ status: 'entregado', origin: 'liga-familia' });
    M.resetMarket('luna'); // el F5 de Luna: borde documentado (§2.7)
    expect(M.listRedemptions('luna')).toEqual([]);
    expect(M.deliverRedemption(r.id, 'luna')).toBe(false);
  });
  it('un canje COMÚN (de la Tienda, con ⚡) sigue igual que antes: sin origin ni closedAt en la forma; el de la liga, con los dos', () => {
    const ec = P.summaryOf('ian').ec;
    const common = runAsUser('ian', () => M.redeem(4));
    expect(common.status).toBe(200);
    expect(common.body.ok).toBe(true);
    const keys = ['emoji', 'id', 'itemId', 'price', 'status', 'title', 'ts'];
    expect(Object.keys(common.body.redemption!).sort()).toEqual(keys);
    expect(common.body.redemption).toMatchObject({ itemId: 4, price: 200, status: 'pendiente' });
    expect(P.summaryOf('ian').ec).toBe(ec - 200); // el común sí gasta
    const liga = M.grantFamilyPrize('ian', { emoji: '🚲', title: 'Bici' }, 5);
    expect(Object.keys(liga).sort()).toEqual(['closedAt', ...keys, 'origin'].sort());
    expect(P.summaryOf('ian').ec).toBe(ec - 200); // el de la liga, no
    // GET /api/market/redemptions y Familia leen lo mismo: el común sin los campos nuevos, el de la liga con ellos
    const listed = M.listRedemptions('ian');
    expect(listed.map(r => [r.itemId, Object.keys(r).sort()])).toEqual([[0, ['closedAt', ...keys, 'origin'].sort()], [4, keys]]);
  });
});
