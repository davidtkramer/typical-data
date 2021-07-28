import { EntityFactory } from './factory';

type EntityFromFactory<Factory> = Factory extends EntityFactory<
  infer Entity,
  unknown,
  unknown
>
  ? Entity
  : never;

type FixtureMap<FM extends FactoryMap> = {
  [Property in keyof FM]: Record<string, EntityFromFactory<FM[Property]>>;
};

interface FactoryMap {
  [key: string]:
    | EntityFactory<unknown, unknown, unknown>
    | { [key: string]: EntityFactory<unknown, unknown, unknown> };
}

interface EntityStore<
  Factory extends EntityFactory<unknown, unknown, unknown>,
  Entity = EntityFromFactory<Factory>
> extends Array<Entity> {
  create: Factory['build'];
  createList: Factory['buildList'];
  reset(): Array<Entity>;
}

type EntityStores<FM extends FactoryMap> = {
  [Property in keyof FM]: FM[Property] extends EntityFactory<
    unknown,
    unknown,
    unknown
  >
    ? EntityStore<FM[Property]>
    : FM[Property] extends {
        [key: string]: EntityFactory<unknown, unknown, unknown>;
      }
    ? {
        [NestedProperty in keyof FM[Property]]: EntityStore<
          FM[Property][NestedProperty]
        >;
      }
    : never;
};

type EntityDatabase<
  FM extends FactoryMap,
  FX extends FixtureMap<FM>
> = EntityStores<FM> & {
  reset(): void;
  fixtures: FX;
};

export const Database = {
  create<FM extends FactoryMap, FX extends FixtureMap<FM>>({
    models,
    fixtures,
  }: {
    models: FM;
    fixtures?: (database: EntityDatabase<FM, any>) => FX | void;
  }): EntityDatabase<FM, FX> {
    const database: Record<string, any> = {
      reset() {
        for (let key in models) {
          database[key].reset();
        }
        database.fixtures = fixtures?.(database as any);
      },
    };

    for (let key in models) {
      const factory = models[key];

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

    return database as EntityDatabase<FM, FX>;
  },
};

function isFactory(arg: any): arg is EntityFactory<unknown, unknown, unknown> {
  return typeof arg.build === 'function';
}
