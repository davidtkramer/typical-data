import { createFactory } from '../factory';

describe('build', () => {
  const factory = createFactory((factory) =>
    factory
      .transient({
        skipGlobalHook: false,
      })
      .attributes<{
        id: number;
        type: 'standard' | 'bot';
        role: 'member' | 'admin' | 'owner';
        name: string;
        hooks: Array<string>;
      }>({
        id: 1,
        type: 'standard',
        role: 'member',
        name: 'Alice',
        hooks: () => [],
      })
      .trait('bob', { name: 'Bob' })
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
          .afterCreate(({ entity, transientParams }) => {
            if (transientParams.skipOwnerHook) return;
            entity.hooks.push('owner');
          })
      )
      .trait('bot', (trait) =>
        trait
          .transient({ skipBotHook: false })
          .attributes({
            type: 'bot',
          })
          .afterCreate(({ entity, transientParams }) => {
            if (transientParams.skipBotHook) return;
            entity.hooks.push('bot1');
          })
          .afterCreate(({ entity, transientParams }) => {
            if (transientParams.skipBotHook) return;
            entity.hooks.push('bot2');
          })
      )
      .afterCreate(({ entity, transientParams }) => {
        if (transientParams.skipGlobalHook) return;
        entity.hooks.push('global1');
      })
      .afterCreate(({ entity, transientParams }) => {
        if (transientParams.skipGlobalHook) return;
        entity.hooks.push('global2');
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
      hooks: ['global1', 'global2'],
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
      hooks: ['global1', 'global2'],
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
    expect(user.hooks).toEqual([]);
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
    const user = factory.build('owner', 'admin', 'bot', 'bob', {
      id: 10,
      skipBotHook: true,
      skipOwnerHook: true,
      skipGlobalHook: true,
    });
    expect(user.id).toBe(10);
    expect(user.role).toBe('admin');
    expect(user.type).toBe('bot');
    expect(user.name).toBe('Bob');
    expect(user.hooks).toEqual([]);
  });

  it('gives precedence to rightmost traits', () => {
    const ownerUser = factory.build('admin', 'owner');
    expect(ownerUser.role).toBe('owner');
  });

  it('runs global afterCreate hooks after trait afterCreate hooks', () => {
    const user = factory.build('owner', 'bot');
    expect(user.hooks).toEqual(['owner', 'bot1', 'bot2', 'global1', 'global2']);
  });

  it('runs trait afterCreate hooks in same order as provided traits', () => {
    const user1 = factory.build('owner', 'bot', { skipGlobalHook: true });
    expect(user1.hooks).toEqual(['owner', 'bot1', 'bot2']);

    const user2 = factory.build('bot', 'owner', { skipGlobalHook: true });
    expect(user2.hooks).toEqual(['bot1', 'bot2', 'owner']);
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

describe('buildList', () => {
  const factory = createFactory((factory) =>
    factory
      .attributes<{
        id: number;
        type: 'standard' | 'bot';
        role: 'member' | 'admin' | 'owner';
      }>({
        id: ({ sequence }) => sequence + 1,
        type: 'standard',
        role: 'member',
      })
      .trait('admin', (trait) =>
        trait.attributes({
          role: 'admin',
        })
      )
      .trait('bot', (trait) =>
        trait.attributes({
          type: 'bot',
        })
      )
  );

  beforeEach(() => {
    factory.rewindSequence();
  });

  it('builds list of default entities', () => {
    const users = factory.buildList(2);
    expect(users).toHaveLength(2);
    expect(users[0]).toEqual({ id: 1, type: 'standard', role: 'member' });
    expect(users[1]).toEqual({ id: 2, type: 'standard', role: 'member' });
  });

  it('build list of entities with attribute overrides', () => {
    const users = factory.buildList(2, { id: 10 });
    expect(users).toHaveLength(2);
    expect(users[0].id).toBe(10);
    expect(users[1].id).toBe(10);
  });

  it('builds list of entities with single trait', () => {
    const users = factory.buildList(2, 'admin');
    expect(users).toHaveLength(2);
    expect(users[0].role).toBe('admin');
    expect(users[1].role).toBe('admin');
  });

  it('builds list of entities with multiple traits', () => {
    const users = factory.buildList(2, 'admin', 'bot');
    expect(users).toHaveLength(2);
    expect(users[0].role).toBe('admin');
    expect(users[0].type).toBe('bot');
    expect(users[1].role).toBe('admin');
    expect(users[1].type).toBe('bot');
  });

  it('build list of entities with multiple traits and attribute overrides', () => {
    const users = factory.buildList(2, 'admin', 'bot', { id: 10 });
    expect(users).toHaveLength(2);
    expect(users[0].id).toBe(10);
    expect(users[0].role).toBe('admin');
    expect(users[0].type).toBe('bot');
    expect(users[1].id).toBe(10);
    expect(users[1].role).toBe('admin');
    expect(users[1].type).toBe('bot');
  });
});

describe('DSL', () => {
  describe('extends', () => {
    it('can inherit attributes, transientParams, traits, and afterCreate hooks', () => {
      interface BaseContact {
        id: number;
        phone: string;
      }
      const baseFactory = createFactory((factory) =>
        factory
          .transient({
            areaCode: 555,
          })
          .attributes<BaseContact>({
            id: 1,
            phone: ({ transientParams }) =>
              `(${transientParams.areaCode}) 123-4567`,
          })
          .trait('invalidPhone', { phone: 'asdf' })
          .trait('withCountryCode', (trait) =>
            trait.transient({ countryCode: 1 }).afterCreate(({ entity }) => {
              entity.phone = `+1 ${entity.phone}`;
            })
          )
          .afterCreate(({ entity }) => {
            entity.phone = entity.phone + ' x123';
          })
      );

      interface BusinessContact extends BaseContact {
        businessName: string;
      }
      const businessFactory = createFactory((factory) =>
        factory
          .extends(baseFactory)
          .transient({ upcaseName: false })
          .attributes<BusinessContact>({
            businessName: 'Mega Lo Mart',
          })
          .trait('invalidName', { businessName: '' })
          .afterCreate(({ entity, transientParams }) => {
            if (transientParams.upcaseName) {
              entity.businessName = entity.businessName.toUpperCase();
            }
          })
      );

      // inherits attributes, transientParam defaults, and afterCreate hooks
      const business1 = businessFactory.build();
      expect(business1.id).toBe(1);
      expect(business1.phone).toBe('(555) 123-4567 x123');
      expect(business1.businessName).toBe('Mega Lo Mart');

      // can override inherited transientParams
      const business2 = businessFactory.build({
        areaCode: 916,
        upcaseName: true,
      });
      expect(business2.phone).toBe('(916) 123-4567 x123');
      expect(business2.businessName).toBe('MEGA LO MART');

      // inherits traits and trait transient params
      const business3 = businessFactory.build(
        'invalidName',
        'invalidPhone',
        'withCountryCode',
        { countryCode: 1 }
      );
      expect(business3.phone).toBe('+1 asdf x123');
      expect(business3.businessName).toBe('');
    });

    it('can inherit from multiple factories', () => {
      interface Callable {
        phone: string;
      }
      interface Emailable {
        email: string;
      }
      interface Contact {
        id: number;
        email: string;
        phone: string;
      }

      const emailFactory = createFactory((factory) =>
        factory.transient({ tld: '.com' }).attributes<Emailable>({
          email: ({ transientParams }) => `email@example${transientParams.tld}`,
        })
      );
      const phoneFactory = createFactory((factory) =>
        factory
          .transient({ areaCode: 555 })
          .attributes<Callable>({
            phone: ({ transientParams }) =>
              `(${transientParams.areaCode}) 123-4567`,
          })
          .trait('withExt', (trait) =>
            trait.transient({ ext: '' }).attributes({
              phone: ({ transientParams }) =>
                `(${transientParams.areaCode}) 123-4567 ${transientParams.ext}`.trim(),
            })
          )
      );
      const contactFactory = createFactory((factory) =>
        factory
          .extends(emailFactory, phoneFactory)
          .attributes<Contact>({ id: 1 })
          .trait('emptyEmail', { email: '' })
      );

      // inherits attributes + transientParam defaults
      const contact1 = contactFactory.build();
      expect(contact1.id).toBe(1);
      expect(contact1.email).toBe('email@example.com');
      expect(contact1.phone).toBe('(555) 123-4567');

      // can override inherited transientParams
      const contact2 = contactFactory.build({ areaCode: 916, tld: '.org' });
      expect(contact2.phone).toBe('(916) 123-4567');
      expect(contact2.email).toBe('email@example.org');

      // inherits traits + trait transient params
      const contact3 = contactFactory.build('withExt', 'emptyEmail', {
        ext: 'x123',
      });
      expect(contact3.phone).toBe('(555) 123-4567 x123');
      expect(contact3.email).toBe('');
    });

    it('does not share state between sibling + parent factories', () => {
      interface Parent {
        parentAttribute: number;
        hooks: string[];
      }
      interface ChildOne extends Parent {
        childOneAttribute: number;
      }
      interface ChildTwo extends Parent {
        childTwoAttribute: number;
      }

      const parentFactory = createFactory((factory) =>
        factory
          .transient({ parentTransientParam: 1 })
          .attributes<Parent>({ parentAttribute: 1, hooks: () => [] })
          .trait('parentTrait', (trait) =>
            trait
              .transient({ parentTraitTransientParam: 1 })
              .afterCreate(({ entity }) => {
                entity.hooks.push('parentTraitHook');
              })
          )
          .afterCreate(({ entity }) => {
            entity.hooks.push('parentHook');
          })
      );

      const childOneFactory = createFactory((factory) =>
        factory
          .extends(parentFactory)
          .attributes<ChildOne>({ childOneAttribute: 1 })
          .trait('parentTrait', (trait) =>
            trait
              .attributes({ childOneAttribute: 2 })
              .afterCreate(({ entity }) => {
                entity.hooks.push('childOneTraitHook');
              })
          )
          .afterCreate(({ entity }) => {
            entity.hooks.push('childOneHook');
          })
      );

      const childTwoFactory = createFactory((factory) =>
        factory
          .extends(parentFactory)
          .attributes<ChildTwo>({ childTwoAttribute: 1 })
          .trait('parentTrait', (trait) =>
            trait
              .attributes({ childTwoAttribute: 1 })
              .afterCreate(({ entity }) => {
                entity.hooks.push('childTwoTraitHook');
              })
          )
          .afterCreate(({ entity }) => {
            entity.hooks.push('childTwoHook');
          })
      );

      // does not share attributes and hooks

      let childOne = childOneFactory.build();
      // @ts-expect-error childTwoAttribute should not exist
      expect(childOne.childTwoAttribute).toBeUndefined();
      expect(childOne.hooks).toEqual(['parentHook', 'childOneHook']);

      let childTwo = childTwoFactory.build();
      // @ts-expect-error childOneAttribute should not exist
      expect(childTwo.childOneAttribute).toBeUndefined();
      expect(childTwo.hooks).toEqual(['parentHook', 'childTwoHook']);

      // does not share traits

      childOne = childOneFactory.build('parentTrait');
      // @ts-expect-error childTwoAttribute should not exist
      expect(childOne.childTwoAttribute).toBeUndefined();
      expect(childOne.hooks).toEqual([
        'childOneTraitHook',
        'parentHook',
        'childOneHook',
      ]);

      childTwo = childTwoFactory.build('parentTrait');
      // @ts-expect-error childOneAttribute should not exist
      expect(childTwo.childOneAttribute).toBeUndefined();
      expect(childTwo.hooks).toEqual([
        'childTwoTraitHook',
        'parentHook',
        'childTwoHook',
      ]);
    });
  });

  describe('transient', () => {
    it('can handle optional params', () => {
      type TransientParams = { globalTransientId?: number };
      const factory = createFactory((factory) =>
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
      const factory = createFactory((factory) =>
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
      const factory = createFactory((factory) =>
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
      const factory = createFactory((factory) =>
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
    it('defines trait with shorthand syntax', () => {
      const factory = createFactory((factory) =>
        factory
          .attributes<{ id: number; name: string }>({
            id: 1,
            name: 'Alice',
          })
          .trait('Bob', { name: 'Bob' })
      );

      const user = factory.build('Bob');
      expect(user.name).toBe('Bob');
    });

    it('can use sequence in attribute builder', () => {
      const factory = createFactory((factory) =>
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
      const factory = createFactory((factory) =>
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
      const factory = createFactory((factory) =>
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
      const factory = createFactory((factory) =>
        factory
          .transient({ globalTransientId: 10 })
          .attributes<{ id: number; name: string }>({ id: 1, name: 'name' })
          .trait('transient', (trait) =>
            trait
              .transient({ traitTransientName: 'transientNameDefault' })
              .afterCreate(({ entity, transientParams }) => {
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
      const factory = createFactory((factory) =>
        factory
          .transient({ globalTransientId: 10 })
          .attributes<{ id: number }>({ id: 1 })
          .afterCreate(({ entity, transientParams }) => {
            entity.id = transientParams.globalTransientId;
          })
      );

      const user = factory.build({ globalTransientId: 20 });
      expect(user.id).toBe(20);
    });
  });
});
