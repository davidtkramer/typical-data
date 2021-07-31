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
      email: 'email@exmaple.com',
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
it('fetches and displays an individual contact info', async () => {
  const contact = db.contacts.create({
    name: 'Alice',
    email: 'test@example.com',
    phone: '(555) 248-1632'
  });

  await render(<ContactDetails id={contact.id} />);
  
  await screen.findByText(contact.name);
  screen.getByText(contact.email);
  screen.getByText(contact.phone);
});
```

