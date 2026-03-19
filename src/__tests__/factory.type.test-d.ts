import { expectTypeOf, test } from 'vitest';
import { createFactory } from '../factory.js';

test('infers a distinct created type from toCreate', async () => {
  const factory = createFactory((factory) =>
    factory
      .attributes<{ name: string }>({
        name: 'Alice',
      })
      .toCreate(async ({ entity }) => ({
        id: 'user-1',
        name: entity.name,
      }))
  );

  const built = factory.build();
  const created = await factory.create();
  const createdList = await factory.createList(2);

  expectTypeOf(built).toEqualTypeOf<{ name: string }>();
  expectTypeOf(created).toEqualTypeOf<{ id: string; name: string }>();
  expectTypeOf(createdList).toEqualTypeOf<
    Array<{ id: string; name: string }>
  >();

  // @ts-expect-error built entities should not expose created-only fields
  built.id;
  // @ts-expect-error created entities should not expose missing fields
  created.missing;
  // @ts-expect-error afterCreate is intentionally not part of the public API
  factory.afterCreate;
});
