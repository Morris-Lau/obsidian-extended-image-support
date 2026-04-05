const esbuild = require('esbuild');

const isWatch = process.argv.includes('--watch');

const config = {
  entryPoints: ['src/main.ts'],
  bundle: true,
  outfile: 'main.js',
  target: 'es2020',
  platform: 'browser',
  external: ['obsidian'],
  format: 'cjs',
  sourcemap: true,
};

if (isWatch) {
  esbuild.context(config).then(ctx => ctx.watch());
} else {
  esbuild.build(config);
}