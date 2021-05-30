import { Factory } from './factory';

type EntityFromFactory<F> = F extends Factory<infer Entity, infer T>
  ? Entity
  : F;

type TransientParamsFromFactory<F> = F extends Factory<
  infer Entity,
  infer TransientParams
>
  ? TransientParams
  : F;

interface FactoryMap {
  [key: string]: Factory<unknown, unknown>;
}

type EntityStore<F extends FactoryMap> = {
  [Property in keyof F]: Array<EntityFromFactory<F[Property]>>;
};

type FixtureMap<F extends FactoryMap> =
  | {
      [Property in keyof F]?: Record<string, EntityFromFactory<F[Property]>>;
    }
  | void;

export class DB<FM extends FactoryMap, FX extends FixtureMap<FM> = void> {
  public factories: FM;
  public fixtures!: FX;
  private store: EntityStore<FM>;
  private setupFixtures?: (database: DB<FM, FX>) => FX;

  static setup<FM extends FactoryMap, FX extends FixtureMap<FM> = void>({
    factories,
    fixtures,
  }: {
    factories: FM;
    fixtures?: (database: DB<FM, void>) => FX;
  }) {
    return new DB(factories, fixtures) as DB<FM, FX> & EntityStore<FM>;
  }

  constructor(factories: FM, fixtures?: (database: DB<FM, FX>) => FX) {
    this.factories = factories;
    this.store = {} as any;
    this.setupFixtures = fixtures;
    this.reset();
  }

  create<EntityType extends keyof FM>(
    type: EntityType,
    params: Partial<EntityFromFactory<FM[EntityType]>> = {},
    transientParams?: Partial<TransientParamsFromFactory<FM[EntityType]>>
  ): EntityFromFactory<FM[EntityType]> {
    const entity: any = this.factories[type].build(params, transientParams);
    this.store[type].push(entity);
    return entity;
  }

  createList<EntityType extends keyof FM>(
    type: EntityType,
    count: number,
    params: Partial<EntityFromFactory<FM[EntityType]>> = {},
    transientParams?: Partial<TransientParamsFromFactory<FM[EntityType]>>
  ): Array<EntityFromFactory<FM[EntityType]>> {
    const entities: any = this.factories[type].buildList(
      count,
      params,
      transientParams
    );
    this.store[type].push(...entities);
    return entities;
  }

  reset() {
    for (let key in this.factories) {
      this.factories[key].rewindSequence();
      this.store[key] = [];
      (this as any)[key] = this.store[key];
    }
    if (this.setupFixtures) {
      this.fixtures = this.setupFixtures(this);
    }
  }
}
