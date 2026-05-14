/**
 * Ejecuta `iteratee` sobre cada item de `items` con concurrencia limitada.
 *
 * Usar en vez de `Promise.all(items.map(...))` cuando cada iteración
 * consume conexiones del pool de Prisma (u otro recurso limitado).
 * Con N items y `concurrency=K`, solo K iteratees corren a la vez.
 *
 * @param items     Colección de entrada
 * @param concurrency  Máximo de promesas en vuelo simultáneamente (>=1)
 * @param iteratee  Función async aplicada a cada item; recibe (item, index)
 * @returns         Array con los resultados en el mismo orden que `items`
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  iteratee: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const limit = Math.max(1, concurrency);
  const results = new Array<R>(items.length);
  let cursor = 0;

  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      results[i] = await iteratee(items[i], i);
    }
  });

  await Promise.all(workers);
  return results;
}
