type CommonAttributes<Parent, Child> = Partial<
  Pick<Child, keyof (Parent | Child)>
>;
type NewAttributes<Parent, Child> = Omit<Child, keyof Parent>;
type ExtendedAttributes<Parent, Child> = CommonAttributes<Parent, Child> &
  NewAttributes<Parent, Child>;

type FactoryBuilderTypesFromFactories<Factories> = Factories extends Array<
  EntityFactory<infer Entity, infer GlobalTransientParams, infer Traits>
>
  ? {
      entities: UnionToIntersection<Entity>;
      globalTransientParams: UnionToIntersection<GlobalTransientParams>;
      traits: UnionToIntersection<Traits>;
    }
  : never;

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

type FinalBuilder<Builder> = Omit<
  Builder,
  'extends' | 'attributes' | 'transient'
>;

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
  OuterEntity = unknown,
  GlobalTransientParams = unknown,
  Traits = unknown
> {
  extends<
    ParentFactories extends Array<EntityFactory<unknown, unknown, unknown>>
  >(
    ...parentFactories: ParentFactories
  ): Omit<
    FactoryBuilder<
      FactoryBuilderTypesFromFactories<ParentFactories>['entities'],
      FactoryBuilderTypesFromFactories<ParentFactories>['globalTransientParams'],
      FactoryBuilderTypesFromFactories<ParentFactories>['traits']
    >,
    'extends'
  >;

  transient<GlobalTransientParams>(
    params: GlobalTransientParams
  ): Omit<
    FactoryBuilder<OuterEntity, GlobalTransientParams, Traits>,
    'transient'
  >;

  attributes<Entity extends OuterEntity>(
    attributes: EntityAttributes<
      ExtendedAttributes<OuterEntity, Entity>,
      GlobalTransientParams
    >
  ): FinalBuilder<FactoryBuilder<Entity, GlobalTransientParams, Traits>>;

  trait<TraitName extends string, TraitTransientParams>(
    name: TraitName,
    traitBuilderArg:
      | EntityAttributes<Partial<OuterEntity>, GlobalTransientParams>
      | ((
          builder: TraitBuilder<OuterEntity, GlobalTransientParams>
        ) => FinalBuilder<
          TraitBuilder<OuterEntity, GlobalTransientParams, TraitTransientParams>
        >)
  ): FinalBuilder<
    FactoryBuilder<
      OuterEntity,
      GlobalTransientParams,
      Traits & Record<TraitName, TraitTransientParams>
    >
  >;

  afterCreate(
    afterCreateCallback: (
      entity: OuterEntity,
      params: { transientParams: GlobalTransientParams }
    ) => void
  ): FinalBuilder<FactoryBuilder<OuterEntity, GlobalTransientParams, Traits>>;
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

  withSequence(sequence: { count: number }): void;

  /** @internal */
  getDefinition(): FactoryDefinition;
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
  afterCreateHooks: Array<(...args: Array<any>) => void>;
  sequence: { count: number };
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
      afterCreateHooks: [],
      sequence: { count: -1 },
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
        definition.sequence.count++;

        // apply defaults from traits
        for (let traitName of traitNames) {
          const trait = definition.traits[traitName];

          for (let key in trait.attributeDefaults) {
            if (key in entity) continue;
            let attribute = trait.attributeDefaults[key];
            if (typeof attribute === 'function') {
              entity[key] = attribute({
                sequence: definition.sequence.count,
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
              sequence: definition.sequence.count,
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

        for (let afterCreate of definition.afterCreateHooks) {
          afterCreate(entity, { transientParams });
        }

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
        definition.sequence.count = -1;
      },

      withSequence(sequence) {
        definition.sequence = sequence;
      },

      getDefinition() {
        return definition;
      },
    };

    const factoryBuilder: FactoryBuilder<any, any, any> = {
      extends(...parents: Array<EntityFactory<any, any, any>>) {
        for (let parent of parents) {
          const parentDefinition = parent.getDefinition();
          definition.attributeDefaults = {
            ...parentDefinition.attributeDefaults,
          };
          definition.transientParamDefaults = {
            ...parentDefinition.transientParamDefaults,
          };
          for (let traitName in parentDefinition.traits) {
            const trait = parentDefinition.traits[traitName];
            definition.traits[traitName] = { ...trait };
          }
        }
        return factoryBuilder;
      },
      transient(params) {
        definition.transientParamDefaults = params;
        return factoryBuilder;
      },
      attributes(params) {
        Object.assign(definition.attributeDefaults, params);
        return factoryBuilder;
      },
      trait(name, traitBuilderArg) {
        definition.traits[name] = {
          attributeDefaults: {},
          transientParamDefaults: {},
          afterCreate: undefined,
        };
        if (typeof traitBuilderArg === 'function') {
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
          traitBuilderArg(traitBuilder);
        } else {
          definition.traits[name].attributeDefaults = traitBuilderArg;
        }
        return factoryBuilder;
      },
      afterCreate(afterCreateCallback) {
        definition.afterCreateHooks.push(afterCreateCallback);
        return factoryBuilder;
      },
    };

    factoryBuilderCallback(factoryBuilder);

    return factory;
  },
};
