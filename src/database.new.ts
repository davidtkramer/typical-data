import { EntityFactory } from './factory.new';

type EntityFromFactory<Factory> = Factory extends EntityFactory<
  infer Entity,
  unknown,
  unknown
>
  ? Entity
  : never;

interface FactoryMap {
  [key: string]: EntityFactory<unknown, unknown, unknown>;
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
  [Property in keyof FM]: EntityStore<FM[Property]>;
};

type EntityDatabase<FM extends FactoryMap> = EntityStores<FM> & {
  reset(): void;
};

export const Database = {
  create<FM extends FactoryMap>({
    models,
  }: {
    models: FM;
  }): EntityDatabase<FM> {
    const database: Record<string, any> = {
      reset() {
        for (let key in models) {
          database[key].reset();
        }
        // re-initialize fixtures
      },
    };

    for (let key in models) {
      const factory = models[key];
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
    }

    return database as EntityDatabase<FM>;
  },
};
