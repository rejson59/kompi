/* Typy dla surowego modułu emscripten z pakietu php-wasm (bez własnych .d.ts). */
declare module 'php-wasm/php8.4-web.mjs' {
  const PHP: (args?: Record<string, unknown>) => Promise<unknown>;
  export default PHP;
}
