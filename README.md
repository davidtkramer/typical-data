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

Typical Data is a library for building and querying mock data with factories and a lightweight in-memory database. Although it's designed with [Mock Service Worker](https://github.com/mswjs/msw), [React Testing Library](https://github.com/testing-library/react-testing-library), and TypeScript in mind, Typical Data can be used with any API mocking or testing framework.

## The Problem

[Mock Service Worker](https://github.com/mswjs/msw) makes it easy to create mock APIs and helps you avoid testing implementation details by eliminating repetitive request mocking in your tests. But removing API mocking from your tests can make it harder to customize the data returned by your API on test-by-test basis. Hard-coded fixtures can be cumbersome and endpoint overriding is verbose and re-introduces api mocking into your tests.

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

const contactFactory = Factory.define(factory =>
  factory
    .attributes<Contact>({
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
  }
})
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
  user.click(screen.getByRole('button', { name: /created/ }))

  await screen.findByText(/contact created!/)
  expect(db.contacts).toHaveLength(1);
  expect(db.contacts[0].name).toBe('Bob')
})

it('fetches and displays contact info', async () => {
  // create a contact and persist it in the database
  const contact = db.contacts.create({
    name: 'Alice',
    email: 'test@example.com',
    phone: '(555) 248-1632'
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

const contactFactory = Factory.define(factory =>
  factory
    .attributes<Contact>({
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
const businessContact = contactFactory.build({ type: 'business', name: 'Mega Lo Mart' });
```

> Note: Typing for the build method requires TypeScript >= 4.0.0 due to the use of variadic tuple types

### Sequences

A sequence is an integer that increments on each invocation of the factory `build` method. This is helpful for generating unique IDs or varying the data returned by the factory.

```typescript
const contactFactory = Factory.define(factory =>
  factory
    .attributes<Contact>({
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
contact1.id   // 0
contact1.type // individual
const contact2 = contactFactory.build();
contact2.id   // 1
contact2.type // business
```

Sequences can be reset back to 0 with the `rewindSequence` method.

```typescript
contactFactory.rewindSequence();
```

### Dependent Attributes

Attributes can be derived from other attributes with the `params` option.

```typescript
const userFactory = Factory.define(factory =>
  factory
    .attributes<User>({
      id: 1,
      firstName: 'Alice',
      lastName: 'Smith',
      fullName({ params }) {
        return `${params.firstName} ${params.lastName}`;
      }
    })
);

userFactory.build().fullName; // 'Alice Smith'
```

### Transient Params

Transient params are arguments that can be passed to the build method that are not merged into the returned object. They can be used to provide options to attribute builders and afterCreate hooks.

The `transient` method defines the default values for transient params. The types for transient params are inferred by the compiler and will be strongly-typed in the build method, just like regular attributes.

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

### After Create Hooks

### Extending Factories

## Database

### Creating a database

### Fixtures

### Handling Extended Factories

### Resetting
