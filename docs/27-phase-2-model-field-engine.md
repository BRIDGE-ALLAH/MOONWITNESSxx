# Phase 2 — Programmatic Model and Field Declaration Engine

**Status:** Initial implementation slice; acceptance gate open  
**Branch:** `feat/phase-2-model-field-engine`  
**Architecture:** Static TypeScript declarations are canonical. No separate schema DSL or hand-maintained schema file.

## Implemented

- `Model` base class for static declarations.
- `ModelDeclaration` metadata contract and a reader that does not instantiate model classes.
- Typed field factories for Char, Text, Boolean, Integer, Float, Decimal, Date, DateTime, Time, UUID, JSON, Selection, Binary, ManyToOne, OneToMany, ManyToMany, Computed and Related.
- Immutable field descriptor objects and option snapshots.
- Decimal precision/scale checks and unique-index default behavior.
- Selection value uniqueness and relation target non-empty checks.
- Declaration validation for model/module identifiers, field identifiers, nullability, unique/index semantics, relation targets and computed/related metadata.
- Type inference helpers for field values and model field maps.
- Registry composition now invokes declaration validation before accepting a model.
- Initial Node 24 type-stripping unit tests for field factories and validation.

## Canonical declaration example

```ts
import { Model, fields } from "@riotworks/orm";

export class Customer extends Model {
  static modelName = "crm.customer";
  static module = "crm";

  static fields = {
    name: fields.Char({ required: true, maxLength: 160 }),
    email: fields.Char({ unique: true }),
    active: fields.Boolean({ default: true }),
    creditLimit: fields.Decimal({ precision: 18, scale: 2 }),
    companyId: fields.ManyToOne("res.company", { onDelete: "restrict" }),
  };
}
```

## Not yet claimed

- No CRUD/query engine, database-backed Recordset, Environment runtime or identity map.
- No computed-field evaluator/dependency graph.
- No inheritance or explicit override semantics.
- No full create/update/read type projections yet; current inference helper exposes declared field value types only.
- No concrete PostgreSQL/SQLite adapters or System Mode persistence.
- No TypeScript, ESLint, test runner, clean install or CI result has been executed in this editing session.

## Acceptance gates

1. Type-check the ORM package and a downstream addon fixture.
2. Run field/declaration tests under the repository's Node 24 CI runtime.
3. Verify lint and formatting.
4. Verify field inference with compile-time type assertions.
5. Extend registry tests to prove invalid declarations are rejected before snapshot creation.
6. Add inheritance/override semantics with explicit conflict rules.
7. Do not mark Phase 2 complete until all gates pass.
