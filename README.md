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

Typical Data is a library for building and querying mock data in tests. 

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

Define a factory 

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

Register factories with the database.

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

Create and query data in your mock API. Example with Mock Service Worker:

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


