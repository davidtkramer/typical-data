import { EntityFactory } from './factory';

type EntityFromFactory<Factory> = Factory extends EntityFactory<
  infer Entity,
  unknown,
  unknown
>
  ? Entity
  : never;

type FixtureMap<FC extends FactoryConfig> = {
  [Property in keyof FC]?: FC[Property] extends FactoryMap
    ? Record<string, EntityFromFactory<FC[Property][keyof FC[Property]]>>
    : Record<string, EntityFromFactory<FC[Property]>>;
};

interface FactoryMap {
  [key: string]: EntityFactory<unknown, unknown, unknown>;
}

interface FactoryConfig {
  [key: string]: EntityFactory<unknown, unknown, unknown> | FactoryMap;
}

interface EntityStore<
  Factory extends EntityFactory<unknown, unknown, unknown>,
  Entity = EntityFromFactory<Factory>
> extends Array<Entity> {
  create: Factory['build'];
  createList: Factory['buildList'];
  reset(): Array<Entity>;
  all(): Array<Entity>;
}

interface ParentEntityStore<
  Factory extends EntityFactory<unknown, unknown, unknown>,
  Entity = EntityFromFactory<Factory>
> extends Array<Entity> {
  reset(): Array<Entity>;
  all(): Array<Entity>;
}

type EntityStores<FC extends FactoryConfig> = {
  [Prop in keyof FC]: FC[Prop] extends EntityFactory<unknown, unknown, unknown>
    ? EntityStore<FC[Prop]>
    : FC[Prop] extends FactoryMap
    ? {
        [NestedProp in keyof FC[Prop]]: Omit<
          EntityStore<FC[Prop][NestedProp]>,
          'reset'
        >;
      } &
        ParentEntityStore<FC[Prop][keyof FC[Prop]]>
    : never;
};

type EntityDatabase<
  FC extends FactoryConfig,
  FM extends FixtureMap<FC>
> = EntityStores<FC> & {
  reset(): void;
  fixtures: FM;
};

/**
 * Creates a database with the given factories and fixture callback.
 */
export function createDatabase<
  FC extends FactoryConfig,
  FM extends FixtureMap<FC>
>({
  factories,
  fixtures,
}: {
  factories: FC;
  fixtures?: (database: EntityDatabase<FC, any>) => FM | void;
}): EntityDatabase<FC, FM> {
  const database: Record<string, any> = {
    reset() {
      for (const key in factories) {
        database[key].reset();
      }
      database.fixtures = fixtures?.(database as any);
    },
  };

  for (const key in factories) {
    const item = factories[key];

    if (isFactory(item)) {
      const factory = item;
      const entities: Array<any> = [];
      const store = Object.assign(entities, {
        create(...args: Array<any>) {
          const entity = factory.build(...args);
          entities.push(entity);
          return entity;
        },
        createList(count: number, ...args: Array<any>) {
          const result = factory.buildList(count, ...args);
          entities.push(...result);
          return result;
        },
        reset() {
          factory.rewindSequence();
          return entities.splice(0, entities.length);
        },
        all() {
          return [...entities];
        },
      });
      database[key] = store;
    } else if (typeof item === 'object') {
      const sequence = { count: -1 };
      const entities: Array<any> = [];
      const combinedStore = Object.assign(entities, {
        reset() {
          sequence.count = -1;
          return entities.splice(0, entities.length);
        },
        all() {
          return [...entities];
        },
      });

      for (const key in item) {
        const factory = item[key];
        if (!isFactory(factory)) {
          throw new Error('Invalid item provided to nested factory config.');
        }
        factory.withSequence(sequence);

        Object.assign(combinedStore, {
          [key]: {
            create(...args: Array<any>) {
              const entity = factory.build(...args);
              entities.push(entity);
              return entity;
            },
            createList(count: number, ...args: Array<any>) {
              const result = factory.buildList(count, ...args);
              entities.push(...result);
              return result;
            },
          },
        });
      }

      database[key] = combinedStore;
    } else {
      throw new Error('Invalid argument passed to createDatabase');
    }
  }

  database.fixtures = fixtures?.(database as any);

  return database as EntityDatabase<FC, FM>;
}

function isFactory(arg: any): arg is EntityFactory<any, any, any> {
  const factory = arg as EntityFactory<any, any, any>;
  return (
    typeof factory === 'object' &&
    typeof factory.build === 'function' &&
    typeof factory.buildList === 'function' &&
    typeof factory.rewindSequence === 'function'
  );
}
