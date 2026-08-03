# Claude Code Instructions

## Package Manager

This project uses pnpm only.

- Use `pnpm@11.18.0`, matching `packageManager` in `package.json`.
- Do not use `npm`, `npx`, `yarn`, `yarn dlx`, `package-lock.json`, or `yarn.lock`.
- If pnpm is missing, run:

```cmd
corepack enable
corepack prepare pnpm@11.18.0 --activate
```

Common commands:

```cmd
pnpm install
pnpm run dev
pnpm run lint
pnpm test
pnpm run build
pnpm exec prisma generate
pnpm exec prisma migrate deploy
```

Dependency changes:

```cmd
pnpm add <package>
pnpm add -D <package>
pnpm remove <package>
```

Keep `pnpm-lock.yaml` committed. Do not create or commit npm/yarn lockfiles.
