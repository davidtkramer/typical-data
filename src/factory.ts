type EntityAttributes<Entity, TransientParams> = {
  [Property in keyof Entity]: EntityAttribute<
    Entity,
    TransientParams,
    Property
  >;
};
type EntityAttribute<Entity, TransientParams, Property extends keyof Entity> =
  | AttributeBuilder<Entity, TransientParams, Property>
  | Entity[Property];
type AttributeBuilder<
  Entity,
  TransientParams,
  Property extends keyof Entity
> = (
  params: AttributeBuilderParams<Entity, TransientParams>
) => Entity[Property];
type AttributeBuilderParams<Entity, TransientParams> = {
  sequence: number;
  params: Partial<Entity>;
  transientParams: TransientParams;
};

type TransientParamsForTraits<
  Traits,
  TraitNames extends keyof Traits
> = UnionToIntersection<Pick<Traits, TraitNames>[TraitNames]>;
type UnionToIntersection<U> = {
  [K in GetKeys<U>]: U extends Record<K, infer T> ? T : never;
};
type GetKeys<U> = U extends Record<infer K, any> ? K : never;

type FinalBuilder<Builder> = Omit<Builder, 'attributes' | 'transient'>;

interface TraitBuilder<
  Entity,
  GlobalTransientParams = unknown,
  TransientParams = {} // eslint-disable-line @typescript-eslint/ban-types
> {
  transient<TraitTransientParams extends Record<string, unknown>>(
    params: TraitTransientParams
  ): Omit<
    TraitBuilder<Entity, GlobalTransientParams, TraitTransientParams>,
    'transient'
  >;

  attributes(
    attributes: EntityAttributes<
      Partial<Entity>,
      GlobalTransientParams & TransientParams
    >
  ): FinalBuilder<TraitBuilder<Entity, GlobalTransientParams, TransientParams>>;

  afterCreate(
    afterCreateCallback: (
      entity: Entity,
      params: { transientParams: GlobalTransientParams & TransientParams }
    ) => void
  ): FinalBuilder<TraitBuilder<Entity, GlobalTransientParams, TransientParams>>;
}

interface FactoryBuilder<
  Entity = unknown,
  GlobalTransientParams = unknown,
  Traits = unknown
> {
  transient<GlobalTransientParams>(
    params: GlobalTransientParams
  ): Omit<FactoryBuilder<Entity, GlobalTransientParams, Traits>, 'transient'>;

  attributes<Entity>(
    attributes: EntityAttributes<Entity, GlobalTransientParams>
  ): FinalBuilder<FactoryBuilder<Entity, GlobalTransientParams, Traits>>;

  trait<TraitName extends string, TraitTransientParams>(
    name: TraitName,
    traitBuilderCallBack: (
      builder: TraitBuilder<Entity, GlobalTransientParams>
    ) => FinalBuilder<
      TraitBuilder<Entity, GlobalTransientParams, TraitTransientParams>
    >
  ): FinalBuilder<
    FactoryBuilder<
      Entity,
      GlobalTransientParams,
      Traits & Record<TraitName, TraitTransientParams>
    >
  >;

  afterCreate(
    afterCreateCallback: (
      entity: Entity,
      params: { transientParams: GlobalTransientParams }
    ) => void
  ): FinalBuilder<FactoryBuilder<Entity, GlobalTransientParams, Traits>>;
}

export interface EntityFactory<Entity, GlobalTransientParams, Traits> {
  build(entity?: Partial<Entity & GlobalTransientParams>): Entity;

  build<TraitNames extends keyof Traits>(
    ...params:
      | [
          ...traits: [TraitNames, ...Array<TraitNames>],
          params: Partial<
            Entity &
              GlobalTransientParams &
              TransientParamsForTraits<Traits, TraitNames>
          >
        ]
      | Array<keyof Traits>
  ): Entity;

  buildList(
    count: number,
    entity?: Partial<Entity & GlobalTransientParams>
  ): Array<Entity>;

  buildList<TraitNames extends keyof Traits>(
    count: number,
    ...params:
      | [
          ...traits: [TraitNames, ...Array<TraitNames>],
          params: Partial<
            Entity &
              GlobalTransientParams &
              TransientParamsForTraits<Traits, TraitNames>
          >
        ]
      | Array<keyof Traits>
  ): Array<Entity>;

  rewindSequence(): void;
}

interface FactoryDefinition {
  attributeDefaults: Record<string, any>;
  transientParamDefaults: Record<string, any>;
  traits: Record<
    string,
    {
      attributeDefaults: Record<string, any>;
      transientParamDefaults: Record<string, any>;
      afterCreate?(...args: Array<any>): void;
    }
  >;
  afterCreate(...args: Array<any>): void;
  sequence: number;
}

export const Factory = {
  define<Entity, GlobalTransientParams, Traits>(
    factoryBuilderCallback: (
      builder: FactoryBuilder
    ) => FinalBuilder<FactoryBuilder<Entity, GlobalTransientParams, Traits>>
  ): EntityFactory<Entity, GlobalTransientParams, Traits> {
    const definition: FactoryDefinition = {
      attributeDefaults: {},
      transientParamDefaults: {},
      traits: {},
      afterCreate: () => null,
      sequence: -1,
    };

    const factory: EntityFactory<Entity, GlobalTransientParams, Traits> = {
      build(...args: any[]) {
        let [params, ...traitNames] = args.reverse();
        if (typeof params === 'string') {
          traitNames.unshift(params);
          params = {};
        }

        // split params into attributes and transient params
        let attributes: Record<string, any> = {};
        let transientParams: Record<string, any> = {
          ...definition.transientParamDefaults,
        };
        for (let key in params) {
          if (key in definition.attributeDefaults) {
            attributes[key] = params[key];
          } else {
            transientParams[key] = params[key];
          }
        }

        // build entity
        const entity: Record<string, any> = attributes;
        definition.sequence++;

        // apply defaults from traits
        for (let traitName of traitNames) {
          const trait = definition.traits[traitName];

          for (let key in trait.attributeDefaults) {
            if (key in entity) continue;
            let attribute = trait.attributeDefaults[key];
            if (typeof attribute === 'function') {
              entity[key] = attribute({
                sequence: definition.sequence,
                params: { ...attributes, ...entity },
                transientParams: {
                  ...trait.transientParamDefaults,
                  ...transientParams,
                },
              });
            } else {
              entity[key] = attribute;
            }
          }
        }

        // apply global defaults
        for (let key in definition.attributeDefaults) {
          if (key in entity) continue;
          let attribute = definition.attributeDefaults[key];
          if (typeof attribute === 'function') {
            entity[key] = attribute({
              sequence: definition.sequence,
              params: { ...attributes, ...entity },
              transientParams,
            });
          } else {
            entity[key] = attribute;
          }
        }

        // after create hooks
        for (let traitName of traitNames.reverse()) {
          const trait = definition.traits[traitName];
          trait.afterCreate?.(entity, {
            transientParams: {
              ...trait.transientParamDefaults,
              ...transientParams,
            },
          });
        }
        definition.afterCreate(entity, { transientParams });

        return entity as Entity;
      },

      buildList(count: number, ...args: any[]) {
        let result = [];
        for (let i = 0; i < count; i++) {
          result.push(factory.build(...args));
        }
        return result;
      },

      rewindSequence() {
        definition.sequence = -1;
      },
    };

    const factoryBuilder: FactoryBuilder<any, any, any> = {
      attributes(params) {
        definition.attributeDefaults = params;
        return factoryBuilder;
      },
      transient(params) {
        definition.transientParamDefaults = params;
        return factoryBuilder;
      },
      trait(name, traitBuilderCallBack) {
        definition.traits[name] = {
          attributeDefaults: {},
          transientParamDefaults: {},
          afterCreate: undefined,
        };
        const traitBuilder: TraitBuilder<any, any, any> = {
          attributes(attributes) {
            definition.traits[name].attributeDefaults = attributes;
            return traitBuilder;
          },
          transient(params) {
            definition.traits[name].transientParamDefaults = params;
            return traitBuilder;
          },
          afterCreate(afterCreateCallback) {
            definition.traits[name].afterCreate = afterCreateCallback;
            return traitBuilder;
          },
        };
        traitBuilderCallBack(traitBuilder);
        return factoryBuilder;
      },
      afterCreate(afterCreateCallback) {
        definition.afterCreate = afterCreateCallback;
        return factoryBuilder;
      },
    };

    factoryBuilderCallback(factoryBuilder);

    return factory;
  },
};
