import { build } from 'esbuild';
import { minify as minifyWasm } from 'shader-minifier-wasm';
import fs from 'node:fs/promises';
import path from 'node:path';

const glslAdvancedMinifyPlugin = {
  name: 'glsl-advanced-minify',
  setup(build) {
    build.onLoad({ filter: /\.(vert|frag|glsl)$/ }, async (args) => {
      try {
        const shaderContent = await fs.readFile(args.path, 'utf8');
        const minifiedShader = await minifyWasm(shaderContent, { preserveExternals: true, format: 'text' }); 
        return {
          contents: `export default \`${minifiedShader}\`;`,
          loader: 'js',
        };
      } catch (error) {
        error.message = `Error processing shader ${args.path}: ${error.message}`;
        return {
          errors: [{ text: error.message, detail: error.stack }],
        };
      }
    });
  },
};

async function runBuild() {
  try {
    await build({
      entryPoints: ['src/webgl-page-curl.js'],
      bundle: true,
      outfile: 'dist/webgl-page-curl.js',
      format: 'esm',
      minify: true,
      sourcemap: true,
      plugins: [glslAdvancedMinifyPlugin],
    });
    console.log('Build successful with shader-minifier-wasm!');
  } catch (error) {
    console.error('Build failed:', error.errors || error);
    process.exit(1);
  }
}

runBuild(); 