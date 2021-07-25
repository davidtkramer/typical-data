import { EntityFactory, Factory } from '../factory.new';

/**
 * TODO
 * - implement buildList
 * - runtime warnings for invalid dsl invocations
 * - omit trait from builder returned by afterCreate
 */

describe('build', () => {
  const factory = Factory.define((factory) =>
    factory
      .transient({
        skipGlobalHook: false,
      })
      .attributes<{
        id: number;
        type: 'standard' | 'bot';
        role: 'member' | 'admin' | 'owner';
        name: string;
        lastHook: string;
      }>({
        id: 1,
        type: 'standard',
        role: 'member',
        name: 'Alice',
        lastHook: '',
      })
      .trait('admin', (trait) =>
        trait.attributes({
          role: 'admin',
        })
      )
      .trait('owner', (trait) =>
        trait
          .transient({ skipOwnerHook: false })
          .attributes({
            role: 'owner',
          })
          .afterCreate((entity, { transientParams }) => {
            if (transientParams.skipOwnerHook) return;
            entity.lastHook = 'owner';
          })
      )
      .trait('bot', (trait) =>
        trait
          .transient({ skipBotHook: false })
          .attributes({
            type: 'bot',
          })
          .afterCreate((entity, { transientParams }) => {
            if (transientParams.skipBotHook) return;
            entity.lastHook = 'bot';
          })
      )
      .afterCreate((entity, { transientParams }) => {
        if (transientParams.skipGlobalHook) return;
        entity.lastHook = 'global';
      })
  );

  beforeEach(() => {
    factory.rewindSequence();
  });

  it('builds default entity', () => {
    const user = factory.build();
    expect(user).toEqual({
      id: 1,
      type: 'standard',
      role: 'member',
      name: 'Alice',
      lastHook: 'global',
    });
  });

  it('builds entity with attribute overrides', () => {
    const user = factory.build({
      id: 10,
      type: 'bot',
      role: 'admin',
      name: 'bot',
    });
    expect(user).toEqual({
      id: 10,
      type: 'bot',
      role: 'admin',
      name: 'bot',
      lastHook: 'global',
    });
  });

  it('builds entity with single trait', () => {
    const user = factory.build('admin');
    expect(user.role).toBe('admin');
  });

  it('builds entity with single trait and attribute overrides', () => {
    const user = factory.build('admin', { id: 10 });
    expect(user.role).toBe('admin');
    expect(user.id).toBe(10);
  });

  it('builds entity with single trait, transient params, and attribute overrides', () => {
    const user = factory.build('owner', {
      id: 10,
      skipOwnerHook: true,
      skipGlobalHook: true,
    });
    expect(user.id).toBe(10);
    expect(user.role).toBe('owner');
    expect(user.lastHook).toBe('');
  });

  it('gives precedence to attribute overrides over trait attributes', () => {
    const user = factory.build('admin', { role: 'owner' });
    expect(user.role).toBe('owner');
  });

  it('builds entity with multiple traits', () => {
    const user = factory.build('admin', 'bot');
    expect(user.role).toBe('admin');
    expect(user.type).toBe('bot');
  });

  it('builds entity with multiple traits and overrides', () => {
    const user = factory.build('admin', 'bot', { id: 10 });
    expect(user.role).toBe('admin');
    expect(user.type).toBe('bot');
    expect(user.id).toBe(10);
  });

  it('builds entity with multiple traits, transient params, and attribute overrides', () => {
    const user = factory.build('owner', 'admin', 'bot', {
      id: 10,
      skipBotHook: true,
      skipOwnerHook: true,
      skipGlobalHook: true,
    });
    expect(user.id).toBe(10);
    expect(user.role).toBe('admin');
    expect(user.type).toBe('bot');
    expect(user.lastHook).toBe('');
  });

  it('gives precedence to rightmost traits', () => {
    const ownerUser = factory.build('admin', 'owner');
    expect(ownerUser.role).toBe('owner');
  });

  it('runs global afterCreate hooks', () => {
    const user = factory.build();
    expect(user.lastHook).toBe('global');
  });

  it('runs global afterCreate hooks after trait afterCreate hooks', () => {
    const user = factory.build('owner', 'bot');
    expect(user.lastHook).toBe('global');
  });

  it('runs trait afterCreate hooks in same order as provided traits', () => {
    const user1 = factory.build('owner', 'bot', { skipGlobalHook: true });
    expect(user1.lastHook).toBe('bot');

    const user2 = factory.build('bot', 'owner', { skipGlobalHook: true });
    expect(user2.lastHook).toBe('owner');
  });

  it('rejects trait transient params when no traits are provided', () => {
    // @ts-expect-error - skipOwnerHook is not available
    factory.build({ skipOwnerHook: true });
  });

  it('rejects trait transient params when corresponding trait is absent', () => {
    // @ts-expect-error - skipOwnerHook is not available
    factory.build('admin', { skipOwnerHook: true });
    // @ts-expect-error - skipOwnerHook is not available
    factory.build('admin', 'bot', { skipBotHook: true, skipOwnerHook: true });
    // @ts-expect-error - skipOwnerHook is not available
    factory.build('bot', { skipBotHook: true, skipOwnerHoook: true });
  });
});

describe('DSL', () => {
  describe('transient', () => {
    it('can handle optional params', () => {
      type TransientParams = { globalTransientId?: number };
      const factory = Factory.define((factory) =>
        factory.transient<TransientParams>({}).attributes<{ id: number }>({
          id: ({ transientParams }) => transientParams.globalTransientId ?? 1,
        })
      );

      // default
      const user1 = factory.build();
      expect(user1.id).toBe(1);

      // override
      const user2 = factory.build({ globalTransientId: 10 });
      expect(user2.id).toBe(10);
    });
  });

  describe('attributes', () => {
    it('can use sequence in attribute builder', () => {
      const factory = Factory.define((factory) =>
        factory.attributes<{ id: number }>({
          id: ({ sequence }) => sequence + 1,
        })
      );

      const user1 = factory.build();
      const user2 = factory.build();
      const user3 = factory.build();
      expect(user1.id).toBe(1);
      expect(user2.id).toBe(2);
      expect(user3.id).toBe(3);
    });

    it('can use global transient params in attribute builder', () => {
      const factory = Factory.define((factory) =>
        factory
          .transient({
            globalTransientId: 10,
          })
          .attributes<{ id: number }>({
            id: ({ transientParams }) => transientParams.globalTransientId,
          })
      );

      // default
      const user1 = factory.build({ globalTransientId: 10 });
      expect(user1.id).toBe(10);

      // override
      const user2 = factory.build({ globalTransientId: 20 });
      expect(user2.id).toBe(20);
    });

    it('can use params in attribute builder', () => {
      const factory = Factory.define((factory) =>
        factory.attributes<{ id: number; name: string }>({
          id: 1,
          name({ params }) {
            return (params?.id ?? 0) % 2 === 0 ? 'even' : 'odd';
          },
        })
      );

      const user1 = factory.build({ id: 10 });
      expect(user1.name).toBe('even');

      const user2 = factory.build({ id: 11 });
      expect(user2.name).toBe('odd');
    });
  });

  describe('traits', () => {
    it('can use sequence in attribute builder', () => {
      const factory = Factory.define((factory) =>
        factory
          .attributes<{ id: number }>({
            id: 1,
          })
          .trait('sequence', (trait) =>
            trait.attributes({
              id: ({ sequence }) => sequence + 1,
            })
          )
      );

      const user1 = factory.build('sequence');
      const user2 = factory.build('sequence');
      expect(user1.id).toBe(1);
      expect(user2.id).toBe(2);
    });

    it('can use transient params in attribute builder', () => {
      const factory = Factory.define((factory) =>
        factory
          .transient({ globalTransientId: 10 })
          .attributes<{ id: number; name: string }>({
            id: 1,
            name: 'name',
          })
          .trait('transient', (trait) =>
            trait
              .transient({ traitTransientName: 'transientNameDefault' })
              .attributes({
                id: ({ transientParams }) => transientParams.globalTransientId,
                name: ({ transientParams }) =>
                  transientParams.traitTransientName,
              })
          )
      );

      // default
      const user1 = factory.build('transient');
      expect(user1.id).toBe(10);
      expect(user1.name).toBe('transientNameDefault');

      // override
      const user2 = factory.build('transient', {
        globalTransientId: 20,
        traitTransientName: 'transientNameOverride',
      });
      expect(user2.id).toBe(20);
      expect(user2.name).toBe('transientNameOverride');
    });

    it('can use params in attribute builder', () => {
      const factory = Factory.define((factory) =>
        factory
          .attributes<{ id: number; name: string }>({ id: 1, name: 'name' })
          .trait('evenOdd', (trait) =>
            trait.attributes({
              name({ params }) {
                return (params?.id ?? 0) % 2 === 0 ? 'even' : 'odd';
              },
            })
          )
      );

      const user1 = factory.build('evenOdd', { id: 10 });
      expect(user1.name).toBe('even');

      const user2 = factory.build('evenOdd', { id: 11 });
      expect(user2.name).toBe('odd');
    });

    it('can use transientParams in afterCreate', () => {
      const factory = Factory.define((factory) =>
        factory
          .transient({ globalTransientId: 10 })
          .attributes<{ id: number; name: string }>({ id: 1, name: 'name' })
          .trait('transient', (trait) =>
            trait
              .transient({ traitTransientName: 'transientNameDefault' })
              .afterCreate((entity, { transientParams }) => {
                entity.id = transientParams.globalTransientId;
                entity.name = transientParams.traitTransientName;
              })
          )
      );

      // default
      const user1 = factory.build('transient');
      expect(user1.id).toBe(10);
      expect(user1.name).toBe('transientNameDefault');

      // override
      const user2 = factory.build('transient', {
        globalTransientId: 20,
        traitTransientName: 'transientNameOverride',
      });
      expect(user2.id).toBe(20);
      expect(user2.name).toBe('transientNameOverride');
    });
  });

  describe('afterCreate', () => {
    it('can use transientParams', () => {
      const factory = Factory.define((factory) =>
        factory
          .transient({ globalTransientId: 10 })
          .attributes<{ id: number }>({ id: 1 })
          .afterCreate((entity, { transientParams }) => {
            entity.id = transientParams.globalTransientId;
          })
      );

      const user = factory.build({ globalTransientId: 20 });
      expect(user.id).toBe(20);
    });
  });
});
