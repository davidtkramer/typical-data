import { EntityFactory } from './factory';

type EntityFromFactory<Factory> = Factory extends EntityFactory<
  infer Entity,
  unknown,
  unknown
>
  ? Entity
  : never;

type FixtureMap<FM extends FactoryConfig> = {
  [Property in keyof FM]: Record<string, EntityFromFactory<FM[Property]>>;
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
}

type EntityStores<FC extends FactoryConfig> = {
  [Prop in keyof FC]: FC[Prop] extends EntityFactory<unknown, unknown, unknown>
    ? EntityStore<FC[Prop]>
    : FC[Prop] extends FactoryMap
    ? {
        [NestedProp in keyof FC[Prop]]: EntityStore<FC[Prop][NestedProp]>;
      }
    : never;
};

type EntityDatabase<
  FM extends FactoryConfig,
  FX extends FixtureMap<FM>
> = EntityStores<FM> & {
  reset(): void;
  fixtures: FX;
};

export const Database = {
  create<FC extends FactoryConfig, FM extends FixtureMap<FC>>({
    factories,
    fixtures,
  }: {
    factories: FC;
    fixtures?: (database: EntityDatabase<FC, any>) => FM | void;
  }): EntityDatabase<FC, FM> {
    const database: Record<string, any> = {
      reset() {
        for (let key in factories) {
          database[key].reset();
        }
        database.fixtures = fixtures?.(database as any);
      },
    };

    for (let key in factories) {
      const factory = factories[key];

      if (isFactory(factory)) {
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
        });
        database[key] = store;
      } else {
        // handle nested factories
      }
    }

    database.fixtures = fixtures?.(database as any);

    return database as EntityDatabase<FC, FM>;
  },
};

function isFactory(arg: any): arg is EntityFactory<unknown, unknown, unknown> {
  return typeof arg.build === 'function';
}
