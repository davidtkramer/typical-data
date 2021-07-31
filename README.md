<div align="center">
    <img
    height="80"
    width="80"
    alt="factory"
    src="https://raw.githubusercontent.com/davidtkramer/typical-data/7180b347449fc02d5f8daf68dc65ec27c853260e/logo.png"
  />
  <p />
  <h1>Typical Data</h1>
</div>

Typical Data is a library for building mock data with factories and querying it with a lightweight in-memory database. Although it's designed with [Mock Service Worker](https://github.com/mswjs/msw), [React Testing Library](https://github.com/testing-library/react-testing-library), and TypeScript in mind, Typical Data can be used with any API mocking or testing framework.

## Table of Contents

- [The Problem](#the-problem)
- [The Solution](#the-solution)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Factories](#factories)
  - [Attributes](#attributes)
  - [Sequences](#sequences)
  - [Dependent Attributes](#dependent-attributes)
  - [Transient Params](#transient-params)
  - [Traits](#traits)
  - [After Create Hooks](#after-create-hooks)
  - [Extending Factories](#extending-factories)
- [Database](#database)
  - [Database Setup](#database-setup)
  - [Fixtures](#fixtures)
  - [Querying](#querying)
  - [Reset](#reset)
- [Credits](#credits)

## The Problem

[Mock Service Worker](https://github.com/mswjs/msw) makes it easy to create mock APIs and helps you avoid testing implementation details by eliminating request mocking in your tests. But removing API mocking from your tests can make it harder to customize the data returned by your API on a test-by-test basis. Hard-coded fixtures can be cumbersome and endpoint overriding is verbose and re-introduces api mocking into your tests.

## The Solution

Typical Data helps bridge the gap between your tests and your mock API. This library provides an expressive factory DSL for creating objects, and an in-memory database for querying and mutating those objects in your mock API.

## Installation

Install with npm:

```
npm install --save-dev typical-data
```

Install with yarn:

```
yarn add --dev typical-data
```

## Quick Start

Define a factory for creating an object.

```typescript
import { Factory } from 'typical-data';
import { Contact } from './your-types';

const contactFactory = Factory.define((factory) =>
  factory.attributes<Contact>({
    id: ({ sequence }) => sequence,
    email: 'email@example.com',
    phone: '(555) 123-4567',
    name: 'name',
  })
);
```

Create a database with factories.

```typescript
import { Database } from 'typical-data';
import { contactFactory, userFactory } from './factories';

const db = Database.create({
  factories: {
    contacts: contactFactory,
    users: userFactory,
  },
});
```

Now you can create and query data in your mock API and in your tests. Example with Mock Service Worker and React Testing Library:

```typescript
setupServer(
  rest.post<Contact>('/api/contacts', (req, res, ctx) => {
    const { name, email, phone } = req.body;

    const contact = db.contacts.create({
      name,
      email,
      phone
    });

    return res(ctx.json({ contact });
  }),
  rest.get<any, any, { id: number }>('/api/contacts/:id', (req, res, ctx) => {
    const { id } = req.params;

    const contact = db.contacts.find(contact => contact.id === id);

    if (!contact) {
      return res(ctx.status(404));
    } else {
      return res(ctx.json({ contact });
    }
  }),
)
```

```typescript
it('creates a contact', async () => {
  await render(<CreateContactScreen />);

  user.type(screen.getByLabelText('name'), 'Bob');
  user.type(screen.getByLabelText('email'), 'bob@example.com');
  user.type(screen.getByLabelText('phone'), '(555) 123-4567');
  user.click(screen.getByRole('button', { name: /created/ }));

  await screen.findByText(/contact created!/);
  expect(db.contacts).toHaveLength(1);
  expect(db.contacts[0].name).toBe('Bob');
});

it('fetches and displays contact info', async () => {
  // create a contact and persist it in the database
  const contact = db.contacts.create({
    name: 'Alice',
    email: 'test@example.com',
    phone: '(555) 248-1632',
  });

  // ContactDetails will fetch the contact with the provided id from the api
  await render(<ContactDetails id={contact.id} />);

  await screen.findByText(contact.name);
  screen.getByText(contact.email);
  screen.getByText(contact.phone);
});
```

## Factories

Factories provide a flexible DSL to customize how your objects are created. Factories can be used standalone or in combination with a database.

### Attributes

This simplest factory defines default attributes for an object. Providing an explicit type to the `attributes` method will enable type-checking in the factory definition and when building objects.

```typescript
import { Factory } from 'typical-data';
import { Contact } from './your-types';

const contactFactory = Factory.define((factory) =>
  factory.attributes<Contact>({
    id: 1,
    type: 'individual',
    phone: '(555) 123-4567',
    name: 'Alice',
  })
);

const contact = contactFactory.build();
```

The build method accepts attributes that will override the defaults defined on the factory

```typescript
const businessContact = contactFactory.build({
  type: 'business',
  name: 'Mega Lo Mart',
});
```

> Note: Typing for the build method requires TypeScript >= 4.0.0 due to the use of variadic tuple types

### Sequences

A sequence is an integer that increments on each invocation of the factory `build` method. This is helpful for generating unique IDs or varying the data returned by the factory.

```typescript
const contactFactory = Factory.define((factory) =>
  factory.attributes<Contact>({
    id({ sequence }) {
      return sequence;
    },
    type({ sequence }) {
      const types = ['individual', 'business'];
      return types[sequence % 2];
    },
    phone: '(555) 123-4567',
    name: 'Alice',
  })
);

const contact1 = contactFactory.build();
contact1.id; // 0
contact1.type; // individual
const contact2 = contactFactory.build();
contact2.id; // 1
contact2.type; // business
```

Sequences can be reset back to 0 with the `rewindSequence` method.

```typescript
contactFactory.rewindSequence();
```

### Dependent Attributes

Attributes can be derived from other attributes with the `params` option.

```typescript
const userFactory = Factory.define((factory) =>
  factory.attributes<User>({
    id: 1,
    firstName: 'Alice',
    lastName: 'Smith',
    fullName({ params }) {
      return `${params.firstName} ${params.lastName}`;
    },
  })
);

userFactory.build().fullName; // 'Alice Smith'
```

### Transient Params

Transient params are arguments that can be passed to the build method that are not merged into the returned object. They can be used to provide options to attribute builders and afterCreate hooks.

The `transient` method defines the default values for transient params. The types for transient params are inferred by the compiler and will be type-safe in the build method, just like regular attributes.

```typescript
const contactFactory = Factory.define(factory =>
  factory
    .transient({ areaCode: 555, downcaseName: false })
    .attributes<Contact>({
      id: 1,
      email: 'email@example.com',
      phone({ transientParams }) {
        return `(${transientParams.areaCode}) 123-4567`,
      }
      name: 'Alice',
    })
    .afterCreate((entity, { transientParams }) => {
      if (transientParams.downcaseName) {
        entity.name = entity.name.toLowerCase();
      }
    })
);

// no overrides provided, will use default transient param values
contactFactory.build()
contact.phone // '(555) 123-4567'
contact.name  // 'Alice'

// will use provided transient params
contactFactory.build({ areaCode: 530, downcaseName: true })
contact.phone // '(530) 123-4567'
contact.name  // 'alice'
```

### Traits

Traits allow you to group attributes together and apply them by passing the trait name to the `build` method.

```typescript
const userFactory = Factory.define((factory) =>
  factory
    .attributes<User>({
      id: 1,
      type: 'member',
      isAdmin: false,
      isActive: true,
      firstName: 'Alice',
      lastName: 'Smith',
    })
    .trait('admin', {
      type: 'admin',
      isAdmin: true,
    })
    .trait('inactive', {
      isActive: false,
    })
);

const adminUser = userFactory.build('admin');
user.type; // 'admin'
user.isAdmin; // true

const inactiveUserContact = userFactory.build('inactive', 'admin');
user.type; // 'admin'
user.isAdmin; // true
user.isActive; // false
```

Traits can define their own transient params and after create hooks using the alternative builder syntax.

```typescript
import { postFactory } from './post-factory';

const userFactory = Factory.define((factory) =>
  factory
    .attributes<User>({
      id: 1,
      email: 'email@example.com',
      name: 'Alice',
      type: 'admin',
      posts: () => []
    })
    .trait('withPosts', (trait) =>
      trait
        .transient({ postCount: 0 })
        .attributes({
          type: 'author'
        })
        .afterCreate((entity, { transientParams }) => {
          const { postCount } = transientParams;
          for (let i = 0; i < postCount; i++) {
            entity.posts.push(...postFactory.buildList(postCount))
          }
        })
    })
);

const user = userFactory.build('withPosts', { postCount: 5 })
users.posts.length // 5
```

### After Create Hooks

After create hooks allow you to run custom logic after an entity has been created. The created entity is passed to the callback as well as any transient params.

```typescript
const contactFactory = Factory.define((factory) =>
  factory
    .transient({ upcaseName: false })
    .attributes<Contact>({
      id: 1,
      email: 'email@example.com',
      phone: '(555) 123,4567',
      name: 'Alice',
    })
    .afterCreate((entity, { transientParams }) => {
      if (transientParams.upcaseName) {
        entity.name = entity.name.toUpperCase();
      }
    })
);

// no overrides provided, will use default transient param values
contactFactory.build();
contact.name; // 'Alice'

// will use provided transient params
contactFactory.build({ upcaseName: true });
contact.name; // 'ALICE'
```

### Extending Factories

Factories can extend from one or more parent factories. This is helpful for sharing logic between factories and modeling inheritance. Transient params, attributes, traits, and after create hooks defined on the parent will be inherited.

#### Sharing logic

```typescript
const phoneFactory = Factory.define((factory) =>
  factory.transient({ areaCode: 555 }).attributes<{ phone: string }>({
    countryCode: 1,
    phoneNumber({ transientParams }) {
      return `(${transientParams.areaCode}) 123-4567`;
    },
    extension: '248',
  })
);

const timestampFactory = Factory.define((factory) =>
  factory
    .transient({ timeZone: 'UTC' })
    .attributes<{ createdAt: string; updatedAt: string }>({
      createdAt({ transientParams }) {
        return dateInTimezone(transientParams.timeZone);
      },
      updatedAt({ transientParams }) {
        return dateInTimezone(transientParams.timeZone);
      },
    })
);

const contactFactory = Factory.define((factory) =>
  factory.extends(phoneFactory, timestampFactory).attributes<{
    id: number;
    name: string;
    phone: string;
    createdAt: string;
    updatedAt: string;
  }>({
    id: 1,
    name: 'Alice',
  })
);

const contact = contactFactory.build({
  areaCode: 530,
  timeZone: 'America/Los_Angeles',
});
```

#### Inheritance

```typescript
interface BaseContact {
  id: number;
  email: string;
}
interface BusinessContact extends BaseContact {
  businessName: string;
}

const baseContactFactory = Factory.define((factory) =>
  factory.attributes<BaseContact>({
    id: 1,
    email: 'email@example.com',
  })
);

const businessContactFactory = Factory.define((factory) =>
  factory.attributes<BusinessContact>({
    businessName: 'Mega Lo Mart',
  })
);
```

> By providing a type to both the parent and child factories' `attributes` methods, Typical Data will infer which attributes the child shares with the parent and will not require redefining them in the child factory.

## Database

### Database Setup

Databases are created by passing factories to the `factories` config option.

```typescript
import { Database } from 'typical-data';
import { userFactory, contactFactory } from './factories';

const db = Database.create({
  factories: {
    users: userFactory,
    contacts: contactFactory,
  },
});
```

Now you can create and query objects through the database. The `create` and `createList` methods have the same signature as the factory `build` and `buildList` methods.

```typescript
db.users.create({ name: 'Bob' });
db.users.createList(10, { tenantId: 20 });
const contact = db.users.find((contact) => contact.name === 'Bob');
```

#### Inheritance

Factories can be [extended](#extending-factories) to model inheritance relationships. To store child objects in the same "table", for example to model single-table inheritance, you can nest child factories under a shared key. In the example below, both individual and business contacts will be persisted in `db.contacts`.

```typescript
const db = Database.create({
  contacts: {
    individual: individualContactFactory,
    business: businessContactFactory,
  },
});

db.contacts.individual.create();
db.contacts.business.create();
db.contacts.length; // 2
```

### Fixtures

You can seed your database with pre-defined objects using the `fixtures` option. This option accepts a callback function that will be passed the database instance.

The fixtures method can optionally return an object of 'named' fixtures. These fixtures are made accessible on the `db.fixtures` property.

```typescript
const db = Database.create({
  factories: {
    tenants: tenantFactory,
    users: userFactory,
    contacts: contactFactory,
  },
  fixtures(self) {
    const currentTenant = self.tenants.create();
    const currentUser = self.users.create({ tenantId: currentTenant.id });
    return {
      tenants: { currentTenant },
      users: { currentUser },
    };
  },
});

const { currentTenant } = db.fixtures.tenants;
const { currentUser } = db.fixtures.users;
```

If you don't need direct access to the fixtures, you can just create objects in the fixtures method and return nothing.

```typescript
const db = Database.create({
  factories: {
    contacts: contactFactory,
  },
  fixtures(self) {
    self.contacts.createList(10);
  },
});
```

### Querying

Support for database-like querying is on the roadmap. For now, the object stores are just extended JavaScript arrays, so you can use normal array methods to find and manipulate data.

```typescript
db.users.find((user) => user.id === id);
db.users.filter((user) => user.type === 'admin');
```

### Reset

The state of the database can be reset back to its original state with the `reset` method. This will delete everything in the database and also re-initialize any fixtures. Calling this in your test framework's global hook before each test can be useful to get your database back to a clean slate for each test. Example with Jest:

```typescript
// jest.setup-after-env.js
import { db } from './your-db';

beforeEach(() => {
  db.reset();
});
```

## Credits

- The factory DSL is modeled after the [Factory Bot](https://github.com/thoughtbot/factory_bot) gem.
- The idea for an in-memory database composed of factories came from [Mirage JS](https://miragejs.com/).
