# Local Database Setup

The API uses PostgreSQL through Drizzle.

Default local connection:

```txt
postgres://bankroll:bankroll@localhost:5432/bankroll_mafia
```

Start Postgres with Docker:

```sh
pnpm db:up
```

Generate migrations:

```sh
pnpm db:generate
```

Apply migrations:

```sh
pnpm db:migrate
```

Outside production, `@bankroll/db` defaults to the Docker URL above when
`DATABASE_URL` is not set. Production must set `DATABASE_URL` explicitly.

The API uses Postgres by default outside `NODE_ENV=test`. Tests keep an
in-memory adapter so they do not require Docker.
