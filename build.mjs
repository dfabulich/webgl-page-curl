import { build } from 'esbuild';
import { glsl } from 'esbuild-plugin-glsl';

async function runBuild() {
  try {
    await build({
      entryPoints: ['src/webgl-page-curl.js'],
      bundle: true,
      outfile: 'dist/webgl-page-curl.js',
      format: 'esm',
      minify: true,
      plugins: [glsl()],
    });
    console.log('Build successful!');
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

runBuild(); 