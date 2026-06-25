// O pacote `@g-loot/react-tournament-brackets` aponta o campo `types` para um
// ficheiro inexistente (`dist/index.d.ts`), pelo que o TypeScript não encontra
// as declarações. Reexportamos as declarações reais que existem em `dist/esm`.
declare module '@g-loot/react-tournament-brackets' {
  export * from '@g-loot/react-tournament-brackets/dist/esm/index'
}
