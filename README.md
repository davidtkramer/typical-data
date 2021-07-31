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

Create objects using factories. 

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

